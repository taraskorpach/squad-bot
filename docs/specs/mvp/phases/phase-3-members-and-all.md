---
needs: [2]
pr: A
---

# Phase 3 — Members, /all and /domikpisik

**Goal:** The bot learns who is in the chat, tags everyone except the caller with `/all`, counts `/all` and `/domikpisik` calls, and greets the chat with a 👋 button.

**Outcome:** Once live (phase 5), `/all` replaces the old tag bot and `/domikpisik` starts counting. Free. Low risk: someone who never writes or taps 👋 isn't tagged until they do.

**Files to touch:**
- `src/chat/schema.ts` (migration 2)
- `src/members/roster.ts`, `src/members/member-store.ts`, `src/members/member-handlers.ts`
- `src/members/mentions.ts`, `src/members/all-handlers.ts`
- `src/stats/event-store.ts`, `src/stats/domikpisik-handlers.ts`
- `src/texts.ts`, `src/welcome.ts`, `src/telegram.ts` (`HI_CALLBACK`, `personSending`), `src/bot.ts` (the catch-all for unknown callback data)
- `src/settings.ts`, `src/chat/room.ts`, `src/chat/chat-room.ts`, `src/context.ts` (`MENTION_CHUNK`
  and the in-memory tag window reach features through `ctx.room`), `src/chat/throttle.ts`
- `wrangler.jsonc` (`MENTION_CHUNK`) and the regenerated `worker-configuration.d.ts`
- `tsconfig.json` (`allowImportingTsExtensions`, for `welcome.ts`'s `.ts` imports)
- `test/members/*.test.ts`, `test/stats/*.test.ts`, `test/welcome.test.ts`, `test/chat/throttle.test.ts`,
  and the phase 2 tests whose shapes grow: `test/telegram.test.ts`, `test/settings.test.ts`, `test/chat/schema.test.ts`

## Implementation guidance

- **Middleware order** in `src/bot.ts`: member learning runs first for every update (an idempotent
  upsert through `ctx.room.write`), then the feature composers. One `Composer` per feature module,
  exported by name (craft). Service messages aren't sightings. `left_chat_member` marks that user
  out, because its `from` is the leaver, and `new_chat_members` marks the added users in. The
  rules must hold whichever of a member's `chat_member` update and their service message
  arrives first (`technical.md` → *Roster*).
- **Roster and mentions are pure** (`technical.md` → *Pure modules*) and tested on their own with
  tables of users: bots, people who left, shared first names, names with `<` and `&`.
- **Counting** goes through `ctx.room.commit`, so a redelivered `/all` never counts twice.
  `events` is append-only, and its kinds are a TypeScript union at one `recordEvent` writer.
  "Once per pool and person" is a rule of the stats queries (phase 9), not a constraint.
- **`src/texts.ts`** starts here. Every Ukrainian string the bot sends lives in it, added by the
  phase that first sends it: here the welcome, the 👋 toast and `/all`. The plural helper on
  `Intl.PluralRules('uk')` comes with its first caller, phase 6's card header (preflight
  2026-11-16: no dead code in PR A). Keep it import-free: the setup script imports it in phase 4.
- **Learning runs before the gate**, right after `ctx.room` is attached, so the roster refuses
  bots and `sender_chat` messages itself, through the same `personSending(update)` the gate uses
  (`src/telegram.ts`).
- **The welcome** is built by `welcomeMessage({ isAdmin })` in `src/welcome.ts`, which the setup
  script uses too.
  - `welcome.ts` imports only `src/texts.ts` and `src/telegram.ts`, with `.ts` extensions.
  - It is sent when a `my_chat_member` update adds the bot: `isInChat` false before, true
    after. So a promotion doesn't greet twice.
  - The ⚠️ line shows when the new status isn't `administrator`.
  - The 👋 tap (`HI_CALLBACK`) upserts the presser and toasts `Запам'ятав 👌`.
  - Unknown callback data gets an empty answer from a catch-all registered last in `src/bot.ts`.
- **`MENTION_CHUNK`** is read from `env` (a `vars` entry, default `"5"`), so phase 5's live test
  can change it without touching code. Regenerate `worker-configuration.d.ts` with
  `npm run cf-typegen` after editing `wrangler.jsonc`, or `wrangler types --check` fails CI.
- **`/all` tags at most once per 30 s** (Taras, review 2026-11-16). Every call is counted, and a
  repeat inside the window gets a 👌 reaction: Telegram allows 20 messages a minute in a group.
  The time of the last tagging lives in memory (`technical.md` → *Telegram calls*). A stale
  `/all`, more than 10 minutes late, is only counted.

## Deliverables

- [x] Migration 2: `members` and the append-only `events` table, with no unique index and no CHECK on `kind`
- [x] Roster rules (pure): `isInChat` from `chat_member` updates; ordinary messages and taps mark their sender in, `left_chat_member` marks that user out, `new_chat_members` the added users in; bots excluded; names refreshed
- [x] Member learning: every ordinary message and tap upserts its sender; joins and leaves update `in_chat` in either arrival order
- [ ] Mentions (pure): escaped `tg://user` links, shared first names told apart, chunks of `MENTION_CHUNK`
- [ ] `/all`: records an `all` event every time; replies with chunked mentions of every member except the caller (or the empty-state text), at most once per 30 s, a repeat getting 👌; a stale call is only counted
- [ ] `/domikpisik`: no reply; records a `domikpisik` event, once per update
- [ ] Welcome: `welcomeMessage({ isAdmin })` from `src/welcome.ts`, sent when the bot is added (`isInChat` false → true); 👋 registers the presser with its toast; unknown callback data gets an empty answer

## Phase-local notes

- A member who hasn't written since the bot arrived is unknown: the Bot API has no member list
  (wave 0 §1). The welcome's 👋 is the fix, not an API call.
- `chat_member` updates arrive only when listed in `allowed_updates` (phase 4 sets it) and the bot is an admin.
