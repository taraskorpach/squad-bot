# Squad Bot MVP — Technical

Ground truth for every mechanism here is in `research/`: Telegram platform and prior art
(wave 0), hosting, framework and state (wave 1), the Cloudflare fit (wave 2), and layout, tests
and reuse (craft). This file is the contract the phases build to.

## Stack

| Piece | Version on 2026-11-16 | Notes |
|---|---|---|
| Runtime | Cloudflare Workers Free + one SQLite-backed Durable Object per chat | No card; over a limit means errors until 00:00 UTC |
| Language | TypeScript 6.0 | 6.0 types `Temporal` through `lib: ["esnext"]` |
| Bot framework | grammy 1.46.x | Bot API 10.3; 10.4 isn't needed |
| Retries | @grammyjs/auto-retry 2.0.x | Capped, see *Telegram calls* |
| CLI | wrangler 4.x, at least 4.107 | `exports` declarations |
| Tests | vitest 5.x, @cloudflare/vitest-plugin 1.8.x, msw 3.x, @msw/cloudflare 0.2.x | The plugin replaced `@cloudflare/vitest-pool-workers` on 2026-08-20 |
| Lint and format | @biomejs/biome 2.x | |
| Node | 26 (`.nvmrc`) | CI and the setup script |

## Architecture

```
Telegram ── POST /webhook ──▶ Worker  (src/index.ts)
                              │ secret check · chat id · allow-list
                              ▼ RPC handleUpdate(update)
                     ChatRoom Durable Object  (src/chat/chat-room.ts)
                       serial queue ──▶ grammY bot (src/bot.ts)
                       │                 ├─ members/   learning, /all, 👋
                       │                 ├─ pools/     /pool, taps, /join, /pools
                       │                 └─ stats/     /domikpisik, /stats
                       │ SQLite (src/chat/schema.ts migrations)
                       └ alarm() ──▶ serial queue ──▶ due jobs (src/chat/jobs.ts, src/pools/pool-timers.ts)
                              │
                              ▼ fetch, auto-retry ≤2 × ≤5 s
                       api.telegram.org
```

The Worker is framework-free: it authenticates, finds the chat and forwards. All bot logic,
storage and timers live in the chat's object, so everything for one chat runs in one thread.

## Worker contract (`src/index.ts`)

`POST /webhook` (`WEBHOOK_PATH` in `src/telegram.ts`):

| Condition | Response |
|---|---|
| `X-Telegram-Bot-Api-Secret-Token` missing or ≠ `WEBHOOK_SECRET` (constant-time compare; lengths first, then `crypto.subtle.timingSafeEqual`) | `401` |
| Body isn't JSON | `400` |
| No chat id in the update | `200`, ignored |
| Chat id ≠ `ALLOWED_CHAT_ID` | `200`; when it is `my_chat_member` adding the bot (`member` or `administrator`) to a group or supergroup, `leaveChat` first, best effort |
| Allowed chat | `await env.CHAT_ROOM.getByName(String(chatId)).handleUpdate(update)` → `200`; a rejection → `500`, and Telegram redelivers |

Chat id is the first present of `message.chat.id`, `callback_query.message.chat.id`,
`chat_member.chat.id`, `my_chat_member.chat.id`. Any other method or path answers `404`.

## Object contract (`src/chat/chat-room.ts`)

`export class ChatRoom extends DurableObject<Env>`, binding `CHAT_ROOM`, re-exported from
`src/index.ts`.

- **Constructor.** `ctx.blockConcurrencyWhile(() => migrate(ctx.storage.sql))`: applies the
  ordered list in `src/chat/schema.ts`, each once, recording it in `_sql_schema_migrations(id, applied_at)`.
- **`handleUpdate(update: Update): Promise<void>`.** Appends the update to a per-object serial
  queue (a promise chain) and resolves when it has been processed. Each queued update runs to the
  end, Telegram calls included, before the next starts. It rejects only when the update failed
  before its commit.
- **`alarm(): Promise<void>`.** Appends "run due jobs" to the same queue.
- **Seams for tests.** Fields `clock: () => number` (default `Date.now`) and
  `random: () => number` (default a `crypto.getRandomValues` draw); tests replace them through
  `runInDurableObject`.

### Processing one update
1. If `processed_updates` holds the `update_id`, stop (a redelivery).
2. Run `bot.handleUpdate(update)`. The bot is built once per object instance with
   `botInfo: JSON.parse(env.BOT_INFO)`, so there is no `getMe` call.
3. Handlers follow **decide and write, then call Telegram**:
   - `ctx.room.commit(fn)` runs `ctx.storage.transactionSync(() => { recordUpdateOnce(); fn(); })`.
     Every non-idempotent change goes through it (answers, events, pools, jobs), so the change
     and the update id commit together.
   - `ctx.room.write(fn)` runs a plain transaction for idempotent writes (member upserts); a
     redelivery repeats them harmlessly.
   - No `await` between reading state and writing it: inside the object, an awaited `fetch`
     lets other events in (wave 2 §3). The serial queue already prevents interleaving between
     updates; this rule keeps alarms and future entry points safe too.
4. If the update committed nothing, record its id at the end.
5. An error **before** the commit rethrows (the Worker answers 500, Telegram redelivers, nothing
   was written). An error **after** it, which can only be a Telegram call failing after retries,
   is logged and swallowed: the state is already right, and the next render repairs the card.
6. Delete `processed_updates` rows older than 48 h; re-arm the alarm when jobs are pending and
   no alarm is set (phase 8).

Never return a 200 from a failed update the way grammY's Deno Workers guide does
(`new Response(e.message)`): it acknowledges failures and Telegram never redelivers (wave 2 §3).

## Data model (object SQLite)

Times are epoch milliseconds, UTC. Tables are snake_case plurals (Cloudflare's rules).

```sql
-- migration 1 (phase 2)
CREATE TABLE processed_updates (
  update_id    INTEGER PRIMARY KEY,
  processed_at INTEGER NOT NULL
);

-- migration 2 (phase 3)
CREATE TABLE members (
  user_id    INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name  TEXT,
  username   TEXT,
  in_chat    INTEGER NOT NULL DEFAULT 1,
  seen_at    INTEGER NOT NULL
);
CREATE TABLE events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  kind    TEXT NOT NULL CHECK (kind IN ('all', 'domikpisik', 'pool_open', 'join', 'pass')),
  user_id INTEGER NOT NULL,
  pool_id INTEGER,
  at      INTEGER NOT NULL
);
CREATE INDEX idx_events_kind_at ON events (kind, at);
CREATE UNIQUE INDEX idx_events_once_per_pool ON events (kind, pool_id, user_id)
  WHERE pool_id IS NOT NULL;   -- join / pass / pool_open count once per pool and person

-- migration 3 (phase 6)
CREATE TABLE pools (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  game            TEXT NOT NULL,
  size            INTEGER NOT NULL CHECK (size BETWEEN 2 AND 10),
  author_id       INTEGER NOT NULL,
  opened_at       INTEGER NOT NULL,
  starts_at       INTEGER,                 -- NULL: a pool "now"
  closes_at       INTEGER NOT NULL,        -- (starts_at ?? opened_at) + 3 h
  message_id      INTEGER,                 -- the card
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_by       TEXT CHECK (closed_by IN ('auto', 'author')),
  squad_announced INTEGER NOT NULL DEFAULT 0,
  drawn           INTEGER NOT NULL DEFAULT 0,
  card_render     TEXT                     -- last text + keyboard sent, to skip no-op edits
);
CREATE INDEX idx_pools_status_opened ON pools (status, opened_at);
CREATE TABLE answers (
  pool_id     INTEGER NOT NULL REFERENCES pools (id),
  user_id     INTEGER NOT NULL,
  choice      TEXT NOT NULL CHECK (choice IN ('play', 'pass')),
  rank        INTEGER NOT NULL,            -- order among 'play'; the draw renumbers it
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (pool_id, user_id)
);

-- migration 4 (phase 8)
CREATE TABLE jobs (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  pool_id INTEGER NOT NULL REFERENCES pools (id),
  kind    TEXT NOT NULL CHECK (kind IN ('start_ping', 'close')),
  due_at  INTEGER NOT NULL,
  done_at INTEGER
);
CREATE INDEX idx_jobs_pending ON jobs (done_at, due_at);
```

Nothing stores message text. `pools.game` is the word the author typed.

## Pure modules

None of these imports grammY or touches storage; time and randomness come in as arguments.

### Roster (`src/members/roster.ts`, phase 3)
- A member is a non-bot user seen in a message or a tap, or added by a `chat_member` update
  whose new status is `member`, `administrator`, `creator`, or `restricted` with `is_member`.
- `left` and `kicked` set `in_chat = 0`. Names refresh on every sighting.
- Tag targets for `/all`: members in the chat minus the caller.

### Mentions (`src/members/mentions.ts`, phase 3)
- `escapeHtml`: `&`, `<`, `>` only (Telegram's HTML mode).
- `mention(member)`: `<a href="tg://user?id={id}">{escaped display name}</a>`.
- Display name: the first name; when two members in the chat share it, the last name's initial
  (`Олег К.`), else `@username`.
- `chunk(mentions, size)`: groups of `MENTION_CHUNK` (`vars.MENTION_CHUNK`, default `"5"`).

### `/pool` arguments (`src/pools/pool-args.ts`, phase 6)
- Tokens split on whitespace. A **time** matches `^([01]?\d|2[0-3])[:.]([0-5]\d)$`; a **size**
  matches `^\d{1,2}$`; anything else is the **game**, allowed only as the first token, up to 32
  characters. A token like `^\d{1,2}[:.]\d{2}$` that isn't a valid time is a time error.
- Defaults: game `CS2`, size 5, start "now". A repeated size or time, or a second game word, is an error.
- Errors map to the copy in `design.md` → *Errors and empty states*.
- Start resolution in Europe/Kyiv with `Temporal`: today's date plus the wall time, with
  `disambiguation: 'compatible'`. In the future → that instant. Less than 60 minutes past →
  "now" (`starts_at` NULL). Older → the same wall time tomorrow.
- Labels: `зараз`; `сьогодні о HH:MM` or `завтра о HH:MM` relative to the render time in Kyiv;
  closed cards `dd.MM о HH:MM`.

### Pool rules (`src/pools/pool-rules.ts`, phases 6–7)
- **Lineup.** `play` answers by `rank`: the first `size` are players, the rest the bench.
  `pass` answers by `answered_at`. Unanswered: members in the chat minus everyone who answered.
- **Answer.** Граю from not-playing → `rank = max(rank) + 1`. Пас from playing → removed from
  play; a departing player is replaced by the bench head, who is reported as moved up. The same
  answer twice changes nothing.
- **Full.** The players reach `size` and `squad_announced` is 0 → announce, then set it to 1.
- **Draw.** Allowed while plays exceed `size` and `drawn = 0`. Picks `size` players uniformly at
  random from all plays, renumbers ranks (the drawn first, in their join order, then the rest in
  join order), sets `drawn = 1`, and reports who moved in and who moved out.
- **`/join` target.** The replied-to card's pool if it is open; else the newest open pool by `opened_at`.

### Card and keyboard (`src/pools/pool-format.ts`, `src/pools/pool-keyboards.ts`, phases 6–7)
- `render(pool, lineup, names, now) → { text, keyboard }`, deterministic. The handler compares
  it with `card_render` and edits only when it differs.
- Keyboard rows: `[✅ Граю (style success), ❌ Пас (style danger)]`, then whichever apply of
  `🎲 Жереб`, `🔔 Нагадати`, `✖️ Закрити`. Closed cards have no keyboard.
- Callback data: `p:{poolId}:{in|out|ping|draw|close}` and `hi` (the 👋 button); far under
  Telegram's 64 bytes. Anything else gets an empty `answerCallbackQuery`.

### Stats (`src/stats/stats-windows.ts`, `src/stats/stats-format.ts`, phase 9)
- `monthWindow(now)`: the first day of the current Kyiv month at 00:00 Europe/Kyiv to the first
  day of the next, as `[startMs, endMs)`. SQLite can't do this itself: its `localtime` is the
  host's UTC and it has no IANA zones.
- Boards: per kind, `COUNT(*) GROUP BY user_id` within the window and without it; total joins
  is `COUNT(*)` of `join` events. Names come from `members`, including people who left.
- Sort by month count, then all-time count, then name; leave out rows that are zero in both.
- Month name: `Intl.DateTimeFormat('uk', { month: 'long', timeZone: 'Europe/Kyiv' })` (standalone
  nominative, "листопад").

### Job planner (`src/chat/jobs.ts`, phase 8)
- A pool's jobs: `start_ping` at `starts_at` when set; `close` at `closes_at`.
- `nextAlarm(pending)`: the earliest pending `due_at`, or none.

## Timers (phase 8)

- Jobs are inserted in the same commit that creates the pool. Closing a pool for any reason
  marks its pending jobs done in its commit.
- `arm()`: the earliest pending `due_at` → `setAlarm` if it differs from `getAlarm()`; none →
  `deleteAlarm()`. Called after every commit that touched jobs and at the end of every update.
- `alarm()`, in the queue: pending jobs with `due_at <= clock()`, oldest first. Each job commits
  its done mark with its state change (close: `status = 'closed'`, `closed_by = 'auto'`), then
  calls Telegram (the start ping, the final card). A failing job is logged. Finally `arm()`.
  Any unexpected error: `setAlarm(clock() + 60_000)`, never a silent stop (alarms stop after 6
  failed retries until the next `setAlarm`, wave 2 §4).
- Alarms fire at least once and can be up to a minute late. Done marks make a second firing a no-op.
- **Budget.** Don't keep the object resident: a Durable Object bills 128 MB for its wall time,
  and a full day resident is about 10,800 of the free 13,000 GB-s. So no per-minute cron and no
  long `setTimeout`s.

## Telegram calls

| Method | Where | Parameters that matter |
|---|---|---|
| `sendMessage` | cards, pings, replies | `parse_mode: 'HTML'`, `link_preview_options: { is_disabled: true }`, `reply_parameters: { message_id, allow_sending_without_reply: true }` |
| `editMessageText` | the card | the same parse mode and keyboard; "message is not modified" is ignored |
| `answerCallbackQuery` | every tap, always | `text` ≤ 200 characters (toasts in `design.md`) |
| `setMessageReaction` | `/join` | 👌 |
| `leaveChat` | Worker, foreign groups | best effort |
| `getMe`, `getUpdates`, `deleteWebhook`, `setWebhook`, `setMyCommands` | setup script only | |

- `allowed_updates`: `["message", "callback_query", "chat_member", "my_chat_member"]`.
  `chat_member` arrives only because it is listed and the bot is an admin.
- Retries: `bot.api.config.use(autoRetry({ maxRetryAttempts: 2, maxDelaySeconds: 5,
  rethrowInternalServerErrors: true, rethrowHttpErrors: true }))`. The worst case stays well
  inside one update's processing; unbounded defaults would sleep past the webhook and cause
  redelivery (wave 2 §3).
- Commands: grammY's `bot.command()` accepts `/cmd` and `/cmd@ourbot` and ignores
  `/cmd@otherbot` (wave 1).
- HTTP client timeout: set grammY's `client.timeoutSeconds` to 10. Its default of 500 could hold
  the queue for minutes (wave 2 §3).

## Configuration

`wrangler.jsonc` (sketch):
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "squad-bot",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-16",
  "compatibility_flags": ["temporal"],  // on by default only from 2026-12-01
  "exports": { "ChatRoom": { "type": "durable-object", "storage": "sqlite" } },
  "durable_objects": { "bindings": [{ "name": "CHAT_ROOM", "class_name": "ChatRoom" }] },
  "vars": { "MENTION_CHUNK": "5" },
  "secrets": { "required": ["BOT_TOKEN", "WEBHOOK_SECRET", "ALLOWED_CHAT_ID", "BOT_INFO"] },
  "observability": { "enabled": true }
}
```
- Secrets are set with `wrangler secret put`, never committed: `BOT_TOKEN`; `WEBHOOK_SECRET`
  (32+ characters of `A-Za-z0-9_-`); `ALLOWED_CHAT_ID`, kept out of the repo so it never names
  the group; `BOT_INFO`, the JSON of `getMe`.
- `worker-configuration.d.ts` comes from `wrangler types` and is committed; `wrangler types --check` runs in CI.
- Local: `.dev.vars` holds the dev bot's values; `.dev.vars.example` is committed.

## Setup script (`scripts/configure-telegram.ts`, phase 4)

It runs in Node 26 (`node --env-file-if-exists=.dev.vars scripts/configure-telegram.ts …`)
and imports only the import-free leaf modules `src/telegram.ts` and `src/texts.ts`, with
explicit `.ts` extensions (Node's type stripping needs them).

| Subcommand | Does |
|---|---|
| `discover` | Calls `getMe` and prints `BOT_INFO`; reads pending updates with `getUpdates` (no offset, so nothing is consumed) and lists the groups the bot was added to, with id and title. Works only while no webhook is set |
| `webhook <worker-url>` | `setWebhook(<url>/webhook, secret_token, allowed_updates, drop_pending_updates: true)`, then `setMyCommands` for group chats |
| `welcome` | Posts the welcome with the 👋 button to `ALLOWED_CHAT_ID` |

Go-live order (phase 5): add the bot and make it an admin → `discover` → set the four secrets →
deploy (merge to `main`) → `webhook` → `welcome`.

Local development: a dev bot in a test group, `wrangler dev --tunnel`, then
`webhook <tunnel-url>` with the dev token. A Quick Tunnel's host changes every session, so
`webhook` runs again each time.

## CI/CD

- `.github/workflows/check.yml`, on every push and pull request: `setup-node` from `.nvmrc`,
  `npm ci`, `npm run check`, `npm test`.
- `.github/workflows/deploy.yml`, on push to `main`: the same checks, then
  `cloudflare/wrangler-action@v4` running `deploy` with `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` from GitHub secrets.
- npm scripts: `check` = `biome check . && tsc --noEmit && tsc --noEmit -p test && wrangler types --check`;
  `test` = `vitest run`; `dev` = `wrangler dev`; `deploy` = `wrangler deploy`;
  `cf-typegen` = `wrangler types`; `telegram:configure` = the setup script.

## Testing

- **Runner.** One Vitest project inside workerd: `vitest.config.mts` uses
  `cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' }, miniflare: { bindings: … } })`
  with fake secrets, so a call nobody faked fails instead of reaching people. Pure modules run
  there too, and native `Temporal` is available through the compatibility flag.
- **Layout.** `test/` mirrors `src/`; files are `*.test.ts`; `test/tsconfig.json` as in
  Cloudflare's starter.
- **Telegram fake.** `test/helpers/telegram.ts`: one `@msw/cloudflare` network enabled in a setup
  file, matching `https://api.telegram.org/bot:token/:method`. It records `{ method, payload }`
  and answers `{ ok: true, result }` (`sendMessage` returns a message with an increasing id).
  Tests can make a call fail (429 with `retry_after`, 500). Build the bot only after the network
  is enabled: grammY captures `fetch` when it is constructed.
- **Updates.** `test/helpers/updates.ts`: builders for a command message (with its `bot_command`
  entity), a reply, a tap, a member joining or leaving, and the bot being added. A sequence
  counter supplies `update_id` and `message_id`. Typed with `grammy/types`.
- **Isolation.** Storage is isolated per test file, not per test, so object tests use a unique
  chat id each (`env.CHAT_ROOM.getByName(uniqueChatId())`). Worker tests use the configured chat id.
- **Time and randomness.** Pure modules get `now` and `random` as arguments. Object tests set
  `clock` and `random` through `runInDurableObject`. Alarms: backdate a job's `due_at`, `arm()`,
  then `runDurableObjectAlarm(stub)`. Vitest fake timers never move alarms.
- **Must-have cases.** A redelivered update changes nothing; two taps for the last seat give one
  seat and one bench place; a tap on a closed pool; a Telegram failure after the commit leaves
  correct state and returns 200; a failure before it returns 500; an alarm firing twice pings once.

## File tree

```
.github/workflows/check.yml, deploy.yml        phases 2, 4
scripts/configure-telegram.ts                  phase 4
src/
  index.ts          Worker: webhook, routing, foreign chats                  phase 2
  telegram.ts       WEBHOOK_PATH, ALLOWED_UPDATES, COMMANDS (import-free)    phases 2, 4
  texts.ts          every Ukrainian string, plural helper (import-free)      phase 3+
  bot.ts            createBot(): grammY with botInfo, auto-retry, features   phase 2+
  context.ts        BotContext with ctx.room (commit, write, clock, random)  phase 2
  chat/
    chat-room.ts    ChatRoom: migrations, serial queue, dedupe, alarm        phases 2, 8
    schema.ts       ordered migrations                                       phases 2, 3, 6, 8
    jobs.ts         job planner and arming                                   phase 8
  members/
    roster.ts, member-store.ts, member-handlers.ts                           phase 3
    mentions.ts, all-handlers.ts                                             phase 3
  pools/
    pool-args.ts, pool-rules.ts, pool-format.ts, pool-keyboards.ts           phases 6, 7
    pool-store.ts, pool-handlers.ts, pool-callbacks.ts                       phases 6, 7
    pool-timers.ts  start ping, auto-close                                   phase 8
  stats/
    event-store.ts, domikpisik-handlers.ts                                   phase 3
    stats-windows.ts, stats-queries.ts, stats-format.ts, stats-handlers.ts   phase 9
test/               mirrors src/, plus helpers/telegram.ts, helpers/updates.ts
wrangler.jsonc, worker-configuration.d.ts, package.json, tsconfig.json,
vitest.config.mts, biome.json, .nvmrc, .dev.vars.example, .gitignore, README.md
```

## Free-plan budget

| Limit (Free) | Our use |
|---|---|
| 100,000 Worker requests a day | Hundreds |
| 100,000 Durable Object requests and 13,000 GB-s a day | Hundreds of requests; GB-s grow with time resident, so never keep the object awake |
| 100,000 rows written a day | Hundreds |
| 10 ms CPU per request | Not measured; checked in phase 5 from the dashboard |
| Workers Logs: 0.5 GB a day from 2026-12-01 | Log ignored updates and errors only |

## Gotchas from research

- An awaited `fetch` inside the object lets other events in; decide and write in one synchronous block (wave 2 §3).
- Button taps from different members arrive in parallel; messages in one chat arrive one at a time (wave 1).
- After a week with no updates, the next `update_id` is random: dedupe by remembered ids, never "highest seen" (wave 1).
- Telegram drops taps after 150 s and messages after 24 h while it can't deliver (wave 1).
- `@cloudflare/vitest-plugin` replaced `vitest-pool-workers`, `fetchMock` is gone, storage is
  isolated per file, and `SELF` is deprecated: most online guides predate this (craft).
- `PRAGMA user_version` doesn't work in Durable Objects; don't put object migrations in a root
  `migrations/` folder, which is D1's default; don't name the class `Chat`, which is grammY's type (craft).
- Cloudflare's starters still use the legacy `migrations` array; we use `exports`, and there is no
  going back after the first deploy with it (wave 2 §4).
