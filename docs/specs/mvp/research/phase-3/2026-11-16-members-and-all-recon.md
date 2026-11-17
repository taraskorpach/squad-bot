---
date: 2026-11-16
phase: 3
chunk: migration 2, roster rules, member learning, mentions, /all (deliverables 1–5)
inputs: [phases/phase-3-members-and-all.md, technical.md, design.md, principles.md]
---

# Phase 3 recon — members, mentions and /all

*Source of record — do not edit.*

Method: every file under `src/` (≈600 lines) and `test/` was read in this session, and the open
library questions were probed directly in workerd 1.20261116.1 (grammy 1.46.0, @grammyjs/types
5.0.0). No Explore wave: the seam was already in view, and the remaining unknowns were library
facts a probe answers better than a search.

## The seam

- **Migration 2** appends to `MIGRATIONS` (`src/chat/schema.ts:16-32`). The SQL binds nothing, so
  one multi-statement string is fine (`docs/specs/_ledger/gotcha-do-sql-multi-statement-bindings.md`).
- **The pipeline** is `attachingRoom → ignoringBotsAndChannels → flaggingStale → features`
  (`src/bot.ts:42-43`). Member learning goes right after `attachingRoom`, before the gate
  (`technical.md` → *Processing one update*, step 3), so it needs `ctx.room` and must exclude bots
  and `sender_chat` messages itself. `FEATURES` is empty (`src/bot.ts:8`).
- **Settings** are read once in the object's constructor (`src/chat/chat-room.ts:30`,
  `src/settings.ts:10-15`); `MENTION_CHUNK` joins `RoomSettings` there, so a bad value throws at
  construction like the other two (test pattern: `test/chat/schema.test.ts:73-81`).
- **What features can reach.** Features see `ctx.room`, an `UpdateRoom` (`src/context.ts:11-63`):
  `commit`, `write`, `clock` and the three flags. The chunk size and the in-memory tag window are
  per object, so they belong on `Room` (`src/chat/room.ts:15-29`, built at
  `src/chat/chat-room.ts:78-84`), with getters on `UpdateRoom`. Alarms (phase 8) tag people too
  and have only a `Room`.
- **`ctx.room.commit` returns its callback's result** (`src/context.ts:23-30`): `/all` can record
  its event and read the members in one transaction, then call Telegram.
- **Config:** `wrangler.jsonc` gets `vars.MENTION_CHUNK`; `worker-configuration.d.ts` must be
  regenerated with it (`docs/specs/_ledger/gotcha-wrangler-types-check-runtime-header.md`).
- **`src/telegram.ts`** is import-free apart from type imports (`src/telegram.ts:1-2`): the place
  for Telegram shapes the setup script shares, such as the HTML send options.

## Reuse

- `isInChat` (`src/telegram.ts:29-41`, tested in `test/telegram.test.ts:46-61`) decides a
  `chat_member` update's new status.
- grammY's `ctx.react('👌')` calls `setMessageReaction` with the update's chat and message
  (`node_modules/grammy/out/context.js:1203-1210`); `👌` is in `ReactionTypeEmoji`
  (`@grammyjs/types/message.d.ts:1477`).
- grammY's types already split service messages from ordinary ones
  (`@grammyjs/types/message.d.ts:9-110`): the content kinds built on `CommonMessage` are `text`,
  `rich_message`, `animation`, `audio`, `document`, `live_photo`, `paid_media`, `photo`, `sticker`,
  `story`, `video`, `video_note`, `voice`, `contact`, `dice`, `game`, `poll`, `venue`, `location`
  and `checklist`. Everything else (`new_chat_members`, `left_chat_member`, `pinned_message`,
  `boost_added`, …) is built on `ServiceMessage`. A typed list of those 20 keys defines "an
  ordinary message"; a new content kind Telegram adds later only delays learning someone, while a
  missed service kind could bring a non-member in.
- Harness: `roomWith(features, { clock })`, `rows()`, `failureOf()` (`test/helpers/rooms.ts`); the
  Telegram fake answers `setMessageReaction` and `answerCallbackQuery` with `true` and
  `sendMessage` with increasing ids (`test/helpers/telegram.ts:69-79`); `memberChange` and
  `chatMember` exist (`test/helpers/updates.ts:105-153`).
- Nothing to reuse for HTML escaping, chunking or Ukrainian strings: no helper exists, and
  grammY's own escaping lives in the parse-mode plugin, which the spec rejected.

## Probed in workerd

- `Intl.PluralRules('uk')` resolves `uk`: 1 one, 2–4 few, 5 many, 11 many, 21 one, 22 few, 1.5 other.
- `Intl.Collator('uk')` sorts Андрій, Гліб, Ґанна, Дмитро, Єва, Иван, Ігор, Іра, Їжак, Олег, Яна,
  then Latin. SQLite's default collation would put Ігор before Андрій (code point order).
- `Intl.DateTimeFormat('uk', { month: 'long', timeZone: 'Europe/Kyiv' })` gives `листопад`.
- `INTEGER PRIMARY KEY AUTOINCREMENT` works in object SQLite and adds `sqlite_sequence` to
  `sqlite_master`.

## Testing-issue estimate

- **Missing fixtures.** The builders have no service messages, though `technical.md` → *Testing*
  lists "a member joining or leaving, both as a `chat_member` update and as a service message".
  Add `new_chat_members` and `left_chat_member` builders, and five more people (seven, as in the
  chat), so `/all` splits six targets into chunks of 5 and 1 at the real `MENTION_CHUNK`.
- **Size caps.** `test/helpers/updates.ts` is 189 lines; the additions keep it under 250. Every
  `src/` file is under 100.
- **State that must not leak.** `FEATURES` are module constants shared by every object in the
  isolate, and the tests run many objects in one isolate. A module-level "last tagged at" would
  leak between tests (and between objects): keep the window on `Room`.
- **Existing tests that change.** The table list in `test/chat/schema.test.ts:27-31` (adds
  `events`, `members`, `sqlite_sequence`) and the settings shape in `test/settings.test.ts:37-44`.
- **Learning runs in every object test.** It sits in `createBot`'s fixed pipeline, so phase 2's
  tests now run it. That is harmless: an idempotent `write` doesn't set `committed`. One test
  should pin that a failure after learning is still redelivered.
- **Time.** Builders date messages with real time, and tests set the room's clock; window tests
  move the clock by seconds, far below the 10-minute stale cut-off.
- **Nothing to extract first.** Roster and mentions are new pure modules; the `/all` handler is glue.

## Smells on the path

- `UpdateRoom` and `Room` are drifting apart (`ledger/principle-actions-commit-through-update-room.md`,
  phase 6). This chunk adds two delegating getters, not the shared interface.
- The phase guidance asks `src/texts.ts` for "every Ukrainian string from `design.md`, plus a
  plural helper", but phase 3 uses only the welcome and `/all` strings and no plural.
