---
date: 2026-11-16
phase: 3
chunk: /domikpisik and the welcome (deliverables 6–7)
inputs: [phases/phase-3-members-and-all.md, research/phase-3/2026-11-16-members-and-all-preflight.md, design.md]
---

# Phase 3 recon — /domikpisik and the welcome

*Source of record — do not edit.*

Same session as chunk 1, which left every file of this seam freshly read; one wave of direct
reads, no agents.

## The seam

- **`/domikpisik`** mirrors `/all`'s counting (`src/members/all-handlers.ts:19-24`): a `Composer`
  with `.command`, one `ctx.room.commit` with `recordEvent`. `EventKind` already has
  `domikpisik` (`src/stats/event-store.ts:5`). No reply, so no Telegram call at all.
- **The welcome** is a feature in `FEATURES` (`src/bot.ts:9`): `on('my_chat_member')`, added
  means `isInChat` false before and true after (`src/telegram.ts`, the Worker's test at
  `src/index.ts:59-67`). A `my_chat_member` update passes the gate, which only looks at
  messages and taps (`src/bot.ts`, `ignoringBotsAndChannels`).
- **The 👋 tap** needs only its toast: member learning already saved the presser, because a tap
  is a sighting (`src/members/roster.ts`, `presencesOf`; pinned by
  `test/members/member-handlers.test.ts`).
- **The catch-all** goes after `bot.use(...options.features)` in `createBot` (`src/bot.ts`), so it
  is last whatever features a test installs.
- **`welcome.ts`'s `.ts` imports** need `allowImportingTsExtensions` (`tsconfig.json:2-15`;
  chunk 1 preflight, finding 2).

## Reuse

- `MESSAGE_FORMAT` (`src/telegram.ts`) for the welcome's send options; the setup script will send
  the same object.
- The message date as epoch ms is now computed three times: `flaggingStale` (`src/bot.ts`),
  `/all` (`src/members/all-handlers.ts:23`) and `/domikpisik`. One `sentAt(message)` in
  `src/telegram.ts` holds the rule "an event happened when the message was sent".
- The welcome's second line names the button (`«👋 Я тут»`): build it from the button's label,
  so the two can't drift.
- Builders: `botAdded`, `botChange` and `tap` exist (`test/helpers/updates.ts`).

## Testing-issue estimate

- No new fixtures. The Telegram fake answers `answerCallbackQuery` with `true` and records its
  payload, so "an empty answer" is a payload of only `callback_query_id`.
- `welcomeMessage` is pure: table-test both shapes. The handlers get object tests.
- The design's copy uses an ASCII apostrophe (`Запам'ятав`, `design.md:249`): keep it, the
  pre-PR check compares word for word.
