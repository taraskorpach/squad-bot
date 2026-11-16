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
- `src/texts.ts`, `src/telegram.ts` (the 👋 callback data), `src/bot.ts`, `wrangler.jsonc` (`MENTION_CHUNK`)
- `test/members/*.test.ts`, `test/stats/domikpisik-handlers.test.ts`

## Implementation guidance

- **Middleware order** in `src/bot.ts`: member learning runs first for every update (an idempotent
  upsert through `ctx.room.write`), then the feature composers. One `Composer` per feature module,
  exported by name (craft).
- **Roster and mentions are pure** (`technical.md` → *Pure modules*) and tested on their own with
  tables of users: bots, people who left, shared first names, names with `<` and `&`.
- **Counting** goes through `ctx.room.commit`, so a redelivered `/all` never counts twice. `events`
  gets its per-pool unique index now, though only `all` and `domikpisik` exist until phase 6.
- **`src/texts.ts`** starts here and holds every Ukrainian string from `design.md`, plus a plural
  helper on `Intl.PluralRules('uk')`. Keep it import-free: the setup script imports it in phase 4.
- **The welcome** is sent when a `my_chat_member` update adds the bot; the ⚠️ line shows only when
  the new status isn't `administrator`. The 👋 tap (`hi`) upserts the presser and toasts
  `Запам'ятав 👌`.
- **`MENTION_CHUNK`** is read from `env` (a `vars` entry, default `"5"`), so phase 5's live test
  can change it without touching code.

## Deliverables

- [ ] Migration 2: `members` and `events` tables, with the per-pool unique index
- [ ] Roster rules (pure): membership from messages, taps and `chat_member` updates; bots excluded; names refreshed
- [ ] Member learning: every message and tap upserts its sender; joins and leaves update `in_chat`
- [ ] Mentions (pure): escaped `tg://user` links, shared first names told apart, chunks of `MENTION_CHUNK`
- [ ] `/all`: replies to the caller with chunked mentions of every member except the caller (or the empty-state text) and records an `all` event
- [ ] `/domikpisik`: no reply; records a `domikpisik` event, once per update
- [ ] Welcome: on the bot being added, the welcome with the 👋 button and, when not an admin, the ⚠️ line; 👋 registers the presser with its toast

## Phase-local notes

- A member who hasn't written since the bot arrived is unknown: the Bot API has no member list
  (wave 0 §1). The welcome's 👋 is the fix, not an API call.
- `chat_member` updates arrive only when listed in `allowed_updates` (phase 4 sets it) and the bot is an admin.
