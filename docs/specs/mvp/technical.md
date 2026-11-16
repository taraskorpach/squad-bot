# Squad Bot MVP — Technical

The ground truth for every mechanism here is in `research/`:
- wave 0: the Telegram platform and prior art;
- wave 1: hosting, framework and state;
- wave 2: the Cloudflare fit;
- craft: layout, tests and reuse.

The review of 2026-11-16 (`reviews/2026-11-16-failure-paths-and-go-live.md`) reshaped the failure paths, the timers and the go-live path. This file is the contract the phases build to.

## Stack

| Piece | Version on 2026-11-16 | Notes |
|---|---|---|
| Runtime | Cloudflare Workers Free + one SQLite-backed Durable Object | No card; over a limit means errors until 00:00 UTC |
| Language | TypeScript 6.0 | 6.0 types `Temporal` through `lib: ["esnext"]` |
| Bot framework | grammy 1.46.x | Bot API 10.3; 10.4 isn't needed |
| Retries | @grammyjs/auto-retry 2.0.x | Capped, see *Telegram calls* |
| CLI | wrangler 4.x, at least 4.107 | `exports` declarations; `secrets.required` checked on deploy |
| Tests | vitest 5.x, @cloudflare/vitest-plugin 1.8.x, msw 3.x, @msw/cloudflare 0.2.x | The plugin replaced `@cloudflare/vitest-pool-workers` on 2026-08-20 |
| Lint and format | @biomejs/biome 2.x | |
| Node | 26 (`.nvmrc`) | CI and the setup script |

## Architecture

```
Telegram ── POST /webhook ──▶ Worker  (src/index.ts)
                              │ secret check · chatIdOf · allow-list
                              ▼ RPC handleUpdate(update)
                     ChatRoom Durable Object, the one named ROOM_NAME  (src/chat/chat-room.ts)
                       serial queue ──▶ grammY bot (src/bot.ts)
                       │                 ├─ members/   learning, /all, 👋
                       │                 ├─ pools/     /pool, taps, /join, /pools
                       │                 └─ stats/     /domikpisik, /stats
                       │ SQLite through Room (src/chat/room.ts, migrations in src/chat/schema.ts)
                       └ alarm() ──▶ serial queue ──▶ due timer actions (src/pools/pool-timers.ts, wired in src/bot.ts)
                              │
                              ▼ fetch, auto-retry ≤2 × ≤5 s
                       api.telegram.org
```

The Worker is framework-free: it authenticates, finds the chat and forwards. All bot logic, storage and timers live in the one object, so everything for the chat runs in one thread.

`chat/` is the mechanism: the queue, storage, the room and the alarm. It imports no feature. `src/bot.ts` is the glue: it assembles the features and hands the object its timer entry points.

## Worker contract (`src/index.ts`)

`POST /webhook` (`WEBHOOK_PATH` in `src/telegram.ts`):

| Condition | Response |
|---|---|
| `X-Telegram-Bot-Api-Secret-Token` missing or ≠ `WEBHOOK_SECRET` (constant-time compare; lengths first, then `crypto.subtle.timingSafeEqual`) | `401` |
| Body isn't JSON | `400` |
| No chat id in the update | `200`, ignored |
| Chat id ≠ `ALLOWED_CHAT_ID` | `200`. If it is a `my_chat_member` update that adds the bot to a group or supergroup (`isInChat` false before, true after), first `leaveChat` through grammY's `Api`, best effort |
| Allowed chat | `await env.CHAT_ROOM.getByName(ROOM_NAME).handleUpdate(update)` → `200`; a rejection → `500`, and Telegram redelivers |

- `chatIdOf(update)` in `src/telegram.ts` reads the chat id of each type in `ALLOWED_UPDATES`: `message.chat.id`, `callback_query.message.chat.id`, `chat_member.chat.id` and `my_chat_member.chat.id`. A test checks that every allowed type yields one, so adding a type can't silently drop its updates.
- A message in the allowed chat that carries `migrate_to_chat_id` is logged at error level: the group was upgraded, and `ALLOWED_CHAT_ID` must change.
- Any other method or path answers `404`.

## Object contract (`src/chat/chat-room.ts`)

`export class ChatRoom extends DurableObject<Env>`, binding `CHAT_ROOM`, re-exported from `src/index.ts`.

There is one object. The Worker addresses it by the constant `ROOM_NAME` (`'chat'`, exported from this module), and its chat id is `ALLOWED_CHAT_ID`. The bot serves one chat by design. A fixed name gives `alarm()` its chat id from one source, and a group upgrade that changes the id means a new secret, not a new, empty object.

- **Constructor.**
  - `ctx.blockConcurrencyWhile(() => migrate(ctx.storage.sql))` applies the ordered list in `src/chat/schema.ts`. Each migration and its `_sql_schema_migrations(id, applied_at)` row run in one `transactionSync`, so a migration that fails halfway leaves nothing behind.
  - Then it checks the settings: `BOT_INFO` parses, `ALLOWED_CHAT_ID` is an integer, and `MENTION_CHUNK` is an integer of at least 1. A bad setting throws with its name.
- **`handleUpdate(update: Update): Promise<void>`.** Appends the update to a per-object serial queue (a promise chain) and resolves once it has been processed. Each queued update runs to the end, Telegram calls included, before the next starts. It rejects only as the failure policy below says.
- **`alarm(): Promise<void>`.** Appends "run the due timer actions" to the same queue.
- **Seams for tests.** Three fields can be replaced:
  - `clock: () => number`, default `Date.now`;
  - `random: () => number`, default a `crypto.getRandomValues` draw;
  - `features`, default every feature composer from `src/bot.ts`.

  The bot is built lazily on the first queued task, so tests can replace any of them through `runInDurableObject` before the first update.

### Room (`src/chat/room.ts`)

The storage and Telegram handle shared by every write path, updates and alarms alike. It doesn't know about grammY's context.

- `room.tx(fn: (sql) => T): T` runs `ctx.storage.transactionSync` and returns `fn`'s result. Reading, deciding and writing all happen inside `fn`, and the decision comes out.
- `room.write(fn)` does the same for idempotent writes: member upserts, `message_id`, `card_render`, `pool_messages`.
- It also carries `room.clock`, `room.random`, `room.chatId`, and `room.api`: the bot's `Api` with auto-retry and the delivered marker.
- And the object's memory: `room.mentionChunk` (the `MENTION_CHUNK` setting) and `room.throttle`, which remembers when each keyed action last ran (`/all`'s 30 s window; 🔔's per pool in phase 7). It lives on the room because feature modules are shared by every object in the isolate.
- `ctx.room` (`src/context.ts`) wraps the room for one update:
  - `ctx.room.commit(fn)` is `room.tx((sql) => { recordUpdateOnce(sql); return fn(sql); })`.
  - `recordUpdateOnce` is an `INSERT OR IGNORE` into `processed_updates`, so a second commit in the same update is harmless.
  - It carries the update's flags: `committed`, `delivered` and `stale`.

### Processing one update
1. If `processed_updates` holds the `update_id`, stop: it is a redelivery.
2. Run `bot.handleUpdate(update)`. The bot has `botInfo: JSON.parse(env.BOT_INFO)`, so there is no `getMe` call.
3. Member learning runs first (phase 3), as soon as `ctx.room` is attached and before the gate below, so the roster refuses bots and `sender_chat` messages itself (`personSending`). Then:
   - Messages and taps from a bot, or with `sender_chat` (anonymous admins, channel identities), stop.
   - A message older than 10 minutes by `message.date` is marked `stale`. Features count it where they count, and do nothing else.
4. Handlers follow **decide and write, then call Telegram**:
   - Every non-idempotent change goes through `ctx.room.commit`: answers, events, pools. The change and the update id commit together.
   - Idempotent writes go through `ctx.room.write`. A redelivery repeats them harmlessly.
   - No `await` between reading state and writing it. Inside the object, an awaited `fetch` lets other events in (wave 2 §3). The serial queue already prevents interleaving between updates, and this rule keeps alarms safe too.
   - Each Telegram call after a commit is caught on its own and logged, so a failed toast doesn't skip the card edit or an announcement.
5. When processing ends without a rethrow, record the update id, if no commit has already done so.
6. **Failure policy.** An error rethrows, so the Worker answers 500 and Telegram redelivers, only when all of these hold:
   - Nothing was committed and nothing reached Telegram in this update. `committed` and `delivered` are false; a transformer on the bot's API sets `delivered` after any successful call.
   - It isn't a permanent Telegram error, meaning a 4xx other than 429.
   - The update hasn't yet failed 3 times with its first failure at least 5 minutes ago. Each failure is counted in `failed_updates` in its own transaction, outside the one that rolled back.

   Any other failure is logged at error level and the update is recorded as processed, so the Worker answers 200. As a result:
   - A retry can never duplicate a change or a message.
   - A deploy reset still gets its redelivery.
   - A deterministic failure blocks the chat for minutes, not until Telegram's 24-hour expiry. Wave 1 found that one failing message stalls the chat's later messages.
7. Delete `processed_updates` and `failed_updates` rows older than 48 h. Re-arm the alarm when it differs from the next due time (*Timers*).

Never answer 200 for a failed update the way grammY's Deno Workers guide does (`new Response(e.message)`): it acknowledges failures before the policy above has decided (wave 2 §3).

## Data model (object SQLite)

Times are epoch milliseconds, UTC. Tables are snake_case plurals (Cloudflare's rules).

An event's `at` is when the person acted: a command's message `date`, or the room's clock for a tap, which carries no date. So a late `/all` counts in the month it was made.

The schema holds identity and structure. Tunable domain rules (event kinds, size bounds, counting rules) live in code, for two reasons:
- SQLite can't change a CHECK without rebuilding the table.
- `events` is history that nothing can regenerate.

```sql
-- migration 1 (phase 2)
CREATE TABLE processed_updates (
  update_id    INTEGER PRIMARY KEY,
  processed_at INTEGER NOT NULL
);
CREATE TABLE failed_updates (
  update_id       INTEGER PRIMARY KEY,
  attempts        INTEGER NOT NULL,
  first_failed_at INTEGER NOT NULL
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
CREATE TABLE events (                       -- append-only; kinds are a TypeScript union
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  kind    TEXT NOT NULL,                    -- all | domikpisik | pool_open | join | pass
  user_id INTEGER NOT NULL,
  pool_id INTEGER,
  at      INTEGER NOT NULL
);
CREATE INDEX idx_events_kind_at ON events (kind, at);

-- migration 3 (phase 6)
CREATE TABLE pools (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  game            TEXT NOT NULL,
  size            INTEGER NOT NULL,         -- 2–10, checked by the parser
  author_id       INTEGER NOT NULL,
  opened_at       INTEGER NOT NULL,
  starts_at       INTEGER,                  -- NULL: a pool "now"
  closes_at       INTEGER NOT NULL,         -- (starts_at ?? opened_at) + 3 h
  message_id      INTEGER,                  -- the card; NULL: no card yet
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_by       TEXT CHECK (closed_by IN ('auto', 'author')),
  squad_announced INTEGER NOT NULL DEFAULT 0,
  drawn           INTEGER NOT NULL DEFAULT 0,
  card_render     TEXT                      -- the last text + keyboard Telegram accepted
);
CREATE INDEX idx_pools_status_opened ON pools (status, opened_at);
CREATE TABLE answers (
  pool_id     INTEGER NOT NULL REFERENCES pools (id),
  user_id     INTEGER NOT NULL,
  choice      TEXT NOT NULL CHECK (choice IN ('play', 'pass')),
  rank        INTEGER NOT NULL,             -- order among 'play'; the draw renumbers it
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (pool_id, user_id)
);
CREATE TABLE pool_messages (                -- every message the bot posts for a pool
  message_id INTEGER PRIMARY KEY,
  pool_id    INTEGER NOT NULL REFERENCES pools (id)
);

-- migration 4 (phase 8)
ALTER TABLE pools ADD COLUMN start_pinged   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pools ADD COLUMN timer_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pools ADD COLUMN timer_retry_at INTEGER;   -- a failed timer action's next try
```

Nothing stores message text. `pools.game` is the word the author typed.

## Pure modules

None of these imports grammY or touches storage; time and randomness come in as arguments.

### Telegram shapes (`src/telegram.ts`, phases 2–4; import-free)
- `WEBHOOK_PATH` and `ALLOWED_UPDATES` (phase 2), `HI_CALLBACK` (phase 3), `COMMANDS` (phase 4).
- `chatIdOf(update)`: the chat id of any allowed update type, or none.
- `isInChat(member)`: true for `member`, `administrator`, `creator`, or `restricted` with `is_member`. "Added" means false before and true after; the Worker and the welcome use the same test.
- `personSending(update)`: the person behind a message or a tap, or none for bots and `sender_chat` messages (anonymous admins, channels, a linked channel's forwards, whose `from` is Telegram's own non-bot account). The gate and the roster share it.

### Roster (`src/members/roster.ts`, phase 3)
- A member is a non-bot user. Every `chat_member` update sets `in_chat` from `isInChat` of the new status.
- An ordinary message or a tap marks its sender as in the chat and refreshes their name. An ordinary message carries one of grammY's content kinds (text, photo, sticker, poll, …); one without any is a service message.
- Service messages aren't sightings:
  - `new_chat_members` marks the added users as in.
  - `left_chat_member` marks that user as out. Its `from` is the person who left, so it must not count as a sighting.
- Messages and `chat_member` updates sit on different Telegram queues, so these rules must hold in either arrival order.
- Tag targets for `/all`: members in the chat, minus the caller.

### Mentions (`src/members/mentions.ts`, phase 3)
- `escapeHtml` escapes `&`, `<` and `>` only (Telegram's HTML mode). Every string a user provides goes through it: names and the game word.
- `mention(member)`: `<a href="tg://user?id={id}">{escaped display name}</a>`.
- Display name: the first name. When two members in the chat share it, add the last name's initial (`Олег К.`), or else `@username`.
- `chunk(mentions, size)`: groups of `MENTION_CHUNK` (`vars.MENTION_CHUNK`, default `"5"`).

### Kyiv time (`src/kyiv-time.ts`, phases 6 and 9; whichever comes first creates it)
- The zone `Europe/Kyiv` is named only here.
- Wall time → instant uses `Temporal` with `disambiguation: 'compatible'`:
  - A time in the spring-forward gap moves later by the gap's length (03:30 → 04:30).
  - In the repeated autumn hour, the earlier one is used.
- Labels:
  - `зараз`;
  - `сьогодні о HH:MM` or `завтра о HH:MM`, relative to the render time;
  - `dd.MM о HH:MM` on closed cards.
- `nextMidnight(now)`: the next Kyiv midnight, when a label can change.
- `monthWindow(now)`: from the first day of the current Kyiv month at 00:00 to the first day of the next, as `[startMs, endMs)`. SQLite can't do this itself: its `localtime` is the host's UTC, and it has no IANA zones.
- The month's name: `Intl.DateTimeFormat('uk', { month: 'long' })` in Kyiv, which gives the standalone nominative ("листопад").

### `/pool` arguments (`src/pools/pool-args.ts`, phase 6)
- Tokens split on whitespace:
  - A **time** matches `^([01]?\d|2[0-3])[:.]([0-5]\d)$`.
  - A **size** matches `^\d{1,2}$`.
  - Anything else is the **game**. It is allowed only as the first token, up to 32 characters.
  - A token like `^\d{1,2}[:.]\d{2}$` that isn't a valid time is a time error.
- Defaults: game `CS2`, size 5, start "now".
- Errors: a repeated size or time, a second game word, or a size outside 2–10.
- Errors map to the copy in `design.md` → *Errors and empty states*.
- Start resolution uses the message's date, not the processing time:
  - Take the wall time's occurrences yesterday, today and tomorrow, counted as calendar days, not ±24 h.
  - If the latest occurrence in the past is less than 60 minutes ago, the pool is for "now" (`starts_at` NULL).
  - Otherwise, use the next occurrence in the future.
  - So `/pool cs2 23:45` sent at 00:10 means now, and `/pool cs2 21:00` sent at 22:30 means tomorrow.

### Pool rules (`src/pools/pool-rules.ts`, phases 6–7)
- **Lineup.** `play` answers are ordered by `rank`: the first `size` are players, the rest the bench. `pass` answers are ordered by `answered_at`. Unanswered: members in the chat, minus everyone who answered.
- **Answer.**
  - Граю from not-playing → `rank = max(rank) + 1`.
  - Пас removes the person from play.
  - The same answer twice changes nothing.
  - **Move-ups** are the squad after the answer minus the squad before it, leaving out the person who acted. A player who passes is replaced by the bench head; a bench member who passes moves nobody.
- **Full.** When the players reach `size` and `squad_announced` is 0, the decision sets the flag to 1 in the same commit, and the handler announces after it.
- **Draw.**
  - Allowed while plays exceed `size` and `drawn = 0`.
  - Picks `size` players uniformly at random from all plays.
  - Renumbers the ranks: the drawn players first, in their join order, then the rest in join order.
  - Sets `drawn = 1`, and reports the whole squad and the whole bench.
- **`/join` target.**
  - A reply resolves its pool through `pool_messages`: an open pool → join that pool; a closed one → the closed reply.
  - No reply, or a reply to anything else → the newest open pool by `opened_at`.

### Card and keyboard (`src/pools/pool-format.ts`, `src/pools/pool-keyboards.ts`, phases 6–7)
- `render(pool, lineup, names, now) → { text, keyboard }` is deterministic.
  - The handler compares the result with `card_render` and edits only when they differ.
  - `card_render` is written only after Telegram accepts the edit or answers "message is not modified". Until then the next render retries.
  - With no card yet (`message_id` NULL), there is nothing to edit (*Timers* posts it).
- Keyboard rows:
  - `[✅ Граю (style success), ❌ Пас (style danger)]`;
  - then whichever apply of `🎲 Жереб`, `🔔 Нагадати`, `✖️ Закрити`.
  - Closed cards have no keyboard.
  - Style values are checked against `grammy/types`.
- Callback data:
  - `p:{poolId}:{in|out|ping|draw|close}`, far under Telegram's 64 bytes.
  - The welcome's `HI_CALLBACK` lives in `src/telegram.ts`.
  - Anything else gets an empty `answerCallbackQuery` from a catch-all registered last in `src/bot.ts`.

### Stats (`src/stats/stats-queries.ts`, `src/stats/stats-format.ts`, phase 9)
- Boards, per kind, within the month window and without it:
  - `all` and `domikpisik` count every event.
  - `join`, `pass` and `pool_open` count once per pool and person, placed by that pair's first event (`MIN(at)`), so toggling can't inflate a board.
  - Total joins: distinct (pool, person) pairs of `join`.
- Names come from `members`, including people who left.
- Sort by month count, then all-time count, then name. Leave out rows that are zero in both.

### Timer planner (`src/pools/pool-timers.ts`, phase 8)
- `nextDue(pools, now)` (pure): the earliest of these, over the open pools:
  - a missing card;
  - `starts_at`, while `start_pinged` is 0;
  - `closes_at`;
  - `nextMidnight(now)`, while an open card shows a day label that midnight changes.

  A pool with `timer_retry_at` set is due no earlier than that time.

## Pool actions (`src/pools/pool-actions.ts`, phases 6–8)

The side effects shared by callbacks, `/join` and timers. They are written against `Room`, never against a grammY context, because `alarm()` has none.

- `applyAnswer(room, poolId, userId, choice)` commits the answer and its event. It returns what changed: the toast, move-ups, and whether the squad just completed.
- `refreshCard(room, poolId)` renders the card and edits it when it changed.
- `postCard(room, poolId)` posts the card and the opening tag message, records both in `pool_messages`, and stores `message_id`.
- `closePool(room, poolId, reason)` (phase 7) commits the close and renders the final card. When the author closes, it tags everyone else who said Граю.
- The announcements: squad complete, a move-up, the draw.
- A tap on a card of a pool whose `message_id` is NULL adopts the tapped message as the card: the card was posted, but its id was never stored.

## Timers (phase 8)

- **The pools table is the schedule.** A pool is due to be:
  - posted, while it has no card;
  - pinged, once `starts_at` has passed and `start_pinged` is 0;
  - closed, once `closes_at` has passed.

  There is no `jobs` table: a closed pool can't fire by construction, and nothing has to be cancelled.
- **Arming.**
  - After a commit that changes timing (a pool opened or closed, a ping or a retry recorded), compute `nextDue` with synchronous SQL. Call `setAlarm` (or `deleteAlarm`) without awaiting, in the same synchronous block, so the alarm commits with the change (alarm operations follow the storage rules, wave 2 §4).
  - At the end of every queued task, compare `getAlarm()` with `nextDue` and set it when they differ. An alarm lost for any reason comes back with the next update.
- **`alarm()`** runs in the queue, each due action in its own `try`:
  - A missing card: `postCard`.
  - A start ping: commit `start_pinged = 1`, then tag the players (not the bench), with the fill when the squad isn't complete. No ping when nobody plays. A ping more than 15 minutes late is skipped and marked done.
  - A close: `closePool(room, id, 'auto')`, silently.
  - Kyiv midnight while a day label is shown: re-render every open card.
- **Retries.**
  - A failing action sets `timer_attempts + 1` and `timer_retry_at = now + 1, 2 or 4 min` in its own write. Failing means its commit failed, or, for the card and the start ping, the Telegram call after the commit failed. For the start ping, the flag goes back to 0.
  - A success clears both columns.
  - After 3 attempts the action is given up and logged: the card stays missing, the ping is skipped, or the pool is closed by a minimal update.
  - Other messages that are sent once aren't retried (`design.md` → *Edge cases*).
- **Unexpected errors.** On any unexpected error in `alarm()`, call `setAlarm(clock() + 60_000)` and skip the end-of-task re-arm to a past time. After 6 failed retries, alarms stop until the next `setAlarm` (wave 2 §4). Without the retry columns, a failing action would point the alarm at the past and fire in a loop, burning the free plan's daily requests and rows within minutes.
- Alarms fire at least once and can be up to a minute late. The flags and `status` commit before the Telegram calls, so a second firing does nothing.
- **Budget.**
  - A Durable Object is billed for duration only while it runs or sits idle but unable to hibernate (Cloudflare's pricing page), so wake-ups cost little.
  - The single alarm is chosen for exact minutes and for having no cron propagation gaps.
  - Still no long `setTimeout`s: a pending timer keeps the object from hibernating.

## Telegram calls

| Method | Where | Parameters that matter |
|---|---|---|
| `sendMessage` | cards, pings, replies; the setup script's welcome | `parse_mode: 'HTML'`, `link_preview_options: { is_disabled: true }`, `reply_parameters: { message_id, allow_sending_without_reply: true }` (none when there is nothing to reply to) |
| `editMessageText` | the card | the same parse mode and keyboard; "message is not modified" counts as accepted |
| `answerCallbackQuery` | every tap, always | `text` ≤ 200 characters (toasts in `design.md`) |
| `setMessageReaction` | `/join`, a repeated `/all` | 👌 |
| `leaveChat` | Worker, foreign groups, through grammY's `Api` | best effort |
| `getMe`, `getUpdates`, `getChatMember`, `deleteWebhook`, `setWebhook`, `getWebhookInfo`, `setMyCommands` | setup script only, through grammY's `Api` | |

- `allowed_updates`: `["message", "callback_query", "chat_member", "my_chat_member"]`. `chat_member` arrives only because it is listed and the bot is an admin.
- Retries: `bot.api.config.use(autoRetry({ maxRetryAttempts: 2, maxDelaySeconds: 5, rethrowInternalServerErrors: true, rethrowHttpErrors: true }))`.
  - The worst case is about 15 s for one call that keeps getting 429s: auto-retry sleeps before it checks the attempt count, so it can sleep three times (phase 2 preflight). `rethrowHttpErrors` is what bounds network errors: without it their backoff ignores `maxRetryAttempts`. Unbounded defaults would hold the serial queue and sleep past the webhook (wave 2 §3).
  - Whatever still fails is handled by the failure policy, and for cards and start pings by timer retries.
- Commands: grammY's `bot.command()` accepts `/cmd` and `/cmd@ourbot` and ignores `/cmd@otherbot` (wave 1).
- HTTP client timeout: set grammY's `client.timeoutSeconds` to 10. Its default of 500 could hold the queue for minutes (wave 2 §3).
- **Group limit.** Telegram allows a bot 20 messages a minute in a group (wave 0 §5).
  - `/all` tags at most once per 30 s, and 🔔 at most once per 30 s per pool. Every `/all` is still counted, and a repeat is answered with 👌 or a toast.
  - The window's last time is kept in memory. An evicted object has been idle for over a minute, so a lost value can only mean the window has passed.

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
- Secrets are set with `wrangler secret put` and never committed:
  - `BOT_TOKEN`.
  - `WEBHOOK_SECRET`: 32+ characters of `A-Za-z0-9_-`, generated once and kept in the password manager. The same value goes to `wrangler secret put` and to the setup script.
  - `ALLOWED_CHAT_ID`, kept out of the repo so the repo never names the group.
  - `BOT_INFO`: the JSON of `getMe`.
- `secrets.required` makes `wrangler deploy` fail while any of the four is missing on the Worker (wrangler ≥ 4.77). Production secrets are therefore set before the first deploy (phase 5).
- `worker-configuration.d.ts` comes from `wrangler types` and is committed.
  - It is regenerated whenever `wrangler.jsonc` changes.
  - `wrangler types --check` runs in CI.
  - Biome ignores it.
- Local development: `.dev.vars` holds the dev bot's values, and `.dev.vars.example` is committed. The setup script reads production values from `.prod.vars`, which is gitignored and has the same keys.

## Setup script (phase 4)

- `scripts/configure-telegram.ts` is the Node 26 shell: `node scripts/configure-telegram.ts --env .prod.vars <subcommand>`, with `--env` defaulting to `.dev.vars`.
  - It parses arguments, calls Telegram through grammY's `Api`, and prints.
  - Tests never import it.
  - Every subcommand first prints the target bot's `@username` (from `getMe`), so the dev and production bots can't be confused.
- Its pure parts live in `scripts/telegram-setup.ts`: finding groups in `getUpdates` results, and building the `setWebhook` and `setMyCommands` payloads.
  - It imports only `src/telegram.ts`, `src/texts.ts` and `src/welcome.ts`, with explicit `.ts` extensions, which Node's type stripping needs.
  - It is tested in workerd.
- `scripts/tsconfig.json` types `scripts/` with Node's types.

| Subcommand | Does |
|---|---|
| `discover` | Prints `BOT_INFO`, then reads pending updates with `getUpdates` (no offset, so nothing is consumed). Lists every group seen in them, of any update type, with id, title and type. Follows `migrate_to_chat_id` to the supergroup and marks groups that aren't supergroups. Works only while no webhook is set. If a group is missing, post a message in it and run it again |
| `webhook <worker-url>` | `setWebhook(<url>/webhook, secret_token, allowed_updates, drop_pending_updates: true)`, then `setMyCommands` for group chats, then `getWebhookInfo`. Fails when that reports `last_error_message` |
| `welcome` | Posts `welcomeMessage({ isAdmin })` to `ALLOWED_CHAT_ID`, with `isAdmin` from `getChatMember` for the bot |

Go-live order (phase 5):
1. Add the bot to the chat as an admin with only the pin right.
2. `discover`. Use the supergroup's `-100…` id; upgrade a basic group first.
3. Set the four production secrets.
4. Merge PR A, which deploys.
5. `webhook`.
6. `welcome`.

Local development: a dev bot in a test group, `wrangler dev --tunnel`, then `webhook <tunnel-url>` with `.dev.vars`. A Quick Tunnel's host changes every session, so `webhook` runs again each time.

## CI/CD

- `.github/workflows/check.yml` runs on every push and pull request: `setup-node` from `.nvmrc`, `npm ci`, `npm run check`, `npm test`.
- `.github/workflows/deploy.yml` runs on push to `main` and on manual dispatch: the same checks, then `cloudflare/wrangler-action@v4` running `deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from GitHub secrets.
- npm scripts:
  - `check` = `biome check . && tsc --noEmit && tsc --noEmit -p test && tsc --noEmit -p scripts && wrangler types --check`;
  - `test` = `vitest run`;
  - `dev` = `wrangler dev`;
  - `deploy` = `wrangler deploy`;
  - `cf-typegen` = `wrangler types`;
  - `telegram:configure` = the setup script.

## Testing

- **Runner.** One Vitest project inside workerd.
  - `vitest.config.mts` uses `cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' }, miniflare: { bindings: … } })` with fake secrets, so a call nobody faked fails instead of reaching people.
  - Pure modules run there too, and native `Temporal` is available through the compatibility flag.
- **Layout.**
  - `test/` mirrors `src/` and `scripts/`; files are `*.test.ts`.
  - `test/tsconfig.json` is as in Cloudflare's starter.
  - The setup script is tested through its pure module only.
- **Telegram fake.** `test/helpers/telegram.ts` sets up one `@msw/cloudflare` network, enabled in a setup file, matching `https://api.telegram.org/bot:token/:method`.
  - It records `{ method, payload }` and answers `{ ok: true, result }`. `sendMessage` returns a message with an increasing id.
  - Tests can make a call fail: a 429 with `retry_after`, a 500, or a 400.
  - Build the bot only after the network is enabled: grammY captures `fetch` when it is constructed.
- **Updates.** `test/helpers/updates.ts` has builders for:
  - a command message, with its `bot_command` entity;
  - a reply;
  - a tap;
  - a member joining or leaving, both as a `chat_member` update and as a service message;
  - the bot being added;
  - a message from a bot or a `sender_chat`.

  A sequence counter supplies `update_id` and `message_id`. The builders are typed with `grammy/types`.
- **Isolation.** Storage is isolated per test file, not per test.
  - Object tests use a unique object name each: `env.CHAT_ROOM.getByName(uniqueName())`.
  - Worker tests go through the one fixed name and call `reset()` before each test. Check what it resets in plugin 1.8 when building the harness.
- **Time, randomness and features.**
  - Pure modules get `now` and `random` as arguments.
  - Object tests set `clock`, `random` and `features` through `runInDurableObject` before the first update. Phase 2's contract tests register a test feature that commits, calls Telegram or throws.
  - Alarms: backdate a pool's `starts_at` or `closes_at`, re-arm, then `runDurableObjectAlarm(stub)`.
  - Vitest fake timers never move alarms.
- **Must-have cases.**
  - A redelivered update changes nothing.
  - Two taps for the last seat give one seat and one bench place.
  - ✅ → ❌ → ✅ leaves the person playing, and the boards count one join and one pass.
  - A tap on a closed pool.
  - A Telegram failure after the commit leaves correct state and returns 200.
  - A failure before anything was committed or sent returns 500 until the cap, then 200, and the next message goes through.
  - The card's send fails at `/pool`, and the alarm posts it later.
  - An alarm firing twice pings once.
  - A timer action that always throws stops after 3 attempts.
  - A member's "left" message and their `chat_member` update, in both orders.

## File tree

```
.github/workflows/check.yml, deploy.yml        phases 2, 4
scripts/
  configure-telegram.ts  Node shell: --env, grammY Api, printing           phase 4
  telegram-setup.ts      pure parts, tested in workerd                     phase 4
  tsconfig.json          Node types for scripts/                           phase 4
src/
  index.ts          Worker: webhook, routing, foreign chats                  phase 2
  telegram.ts       WEBHOOK_PATH, ALLOWED_UPDATES, chatIdOf, isInChat,
                    personSending, HI_CALLBACK, COMMANDS (import-free)       phases 2, 3, 4
  texts.ts          every Ukrainian string, plural helper (import-free)      phase 3+
  welcome.ts        welcomeMessage({ isAdmin }); imports only the leaves     phase 3
  kyiv-time.ts      zone, wall time → instant, labels, month window          phases 6, 9
  bot.ts            createBot(features), the feature list, timer wiring      phase 2+
  context.ts        BotContext with ctx.room                                 phase 2
  chat/
    chat-room.ts    ChatRoom: migrations, settings, queue, dedupe, failure
                    policy, alarm, arming                                    phases 2, 8
    room.ts         Room: tx, write, clock, random, chatId, api              phase 2
                    mentionChunk, throttle                                   phase 3
    throttle.ts     when each keyed action last ran, in memory              phase 3
    schema.ts       ordered migrations                                       phases 2, 3, 6, 8
  members/
    roster.ts, member-store.ts, member-handlers.ts                           phase 3
    mentions.ts, all-handlers.ts                                             phase 3
  pools/
    pool-args.ts, pool-rules.ts, pool-format.ts, pool-keyboards.ts           phases 6, 7
    pool-store.ts, pool-actions.ts, pool-handlers.ts, pool-callbacks.ts      phases 6, 7, 8
    pool-timers.ts  timer planner and actions                                phase 8
  stats/
    event-store.ts, domikpisik-handlers.ts                                   phase 3
    stats-queries.ts, stats-format.ts, stats-handlers.ts                     phase 9
test/               mirrors src/ and scripts/, plus helpers/telegram.ts, helpers/updates.ts
wrangler.jsonc, worker-configuration.d.ts, package.json, tsconfig.json,
vitest.config.mts, biome.json, .nvmrc, .dev.vars.example, .gitignore, README.md
```

## Free-plan budget

| Limit (Free) | Our use |
|---|---|
| 100,000 Worker requests a day | Hundreds |
| 100,000 Durable Object requests and 13,000 GB-s a day | Hundreds of requests. GB-s are billed while the object runs, not while it idles, so far below the cap |
| 100,000 rows written a day | Hundreds. A looping alarm would burn this, hence bounded timer retries |
| 10 ms CPU per request | Not measured; checked in phase 5 from the dashboard |
| Workers Logs: 0.5 GB a day from 2026-12-01 | Log ignored updates and errors only |

## Gotchas from research and review

- An awaited `fetch` inside the object lets other events in; decide and write in one synchronous block (wave 2 §3).
- Button taps from different members arrive in parallel; messages in one chat arrive one at a time (wave 1).
- One update that fails on every delivery holds the chat's later messages for up to 24 h, because Telegram has no attempt limit (wave 1). Hence the failure policy's cap.
- After a week with no updates, the next `update_id` is random: dedupe by remembered ids, never by "highest seen" (wave 1).
- Telegram drops taps after 150 s and messages after 24 h while it can't deliver them (wave 1).
- `secrets.required` fails `wrangler deploy` until every listed secret exists on the Worker: set them before the first deploy.
- Giving the bot a custom admin role most likely upgrades a basic group to a supergroup with a new `-100…` id (core.telegram.org/api/channel). Use the id `discover` reports after the upgrade.
- A member's own "left the group" message has the leaver as `from`: never count service messages as sightings.
- `@cloudflare/vitest-plugin` replaced `vitest-pool-workers`, `fetchMock` is gone, storage is isolated per file, and `SELF` is deprecated: most online guides predate this (craft).
- `PRAGMA user_version` doesn't work in Durable Objects. Don't put object migrations in a root `migrations/` folder, which is D1's default. Don't name the class `Chat`, which is grammY's type (craft).
- Cloudflare's starters still use the legacy `migrations` array. We use `exports`, and there is no going back after the first deploy with it (wave 2 §4).
- `wrangler dev` can stop alarms after a hot reload until it restarts (wave 2 §4): restart it before trying timers.
