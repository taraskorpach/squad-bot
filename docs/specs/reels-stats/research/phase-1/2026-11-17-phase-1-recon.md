---
date: 2026-11-17
phase: 1
chunk: phase-1 (all five deliverables)
lens: execute-recon
---

# Phase 1 recon — posts on the board

*Source of record — do not edit.* Recon ran inline (the create session had already read the
stats module, the schema and the helpers); one pass, no agents.

## The seam

- `src/chat/schema.ts:16-124` — `MIGRATIONS`; migration 6 appends after id 5. Multi-statement SQL
  without bindings is fine (`_ledger/gotcha-do-sql-multi-statement-bindings.md`; migration 4 does
  three `ALTER`s in one string).
- `src/stats/event-store.ts:5` `EventKind`, `:7-14` `StatEvent`, `:39-47` `recordEvent`'s
  `INSERT` (four columns today).
- `src/stats/stats-queries.ts:23-35` `COUNTED` (`Record<EventKind, string>`), `:41-53` `readStats`
  (a literal per kind).
- `src/stats/stats-format.ts:13-25` `statsText`: the boards in order; `/domikpisik` at `:20`.
- `src/texts.ts:147-156` `texts.stats`.
- `src/bot.ts:21-30` `FEATURES`; `createBot` puts `learningMembers`, `ignoringBotsAndChannels`
  and `flaggingStale` before the features (`:70-75`), so `roomWith` tests get the bot gate too
  (`src/chat/chat-room.ts:21,105-108`).
- No feature listens on plain messages today: every feature is a `.command()`, a
  `callback_query` listener or `my_chat_member`. `next()` is called only by the bot-level
  middlewares and the two tap routers.
- grammY 1.46.0: `ctx.entities(types)` reads `text`+`entities` or `caption`+`caption_entities`
  and slices each entity's text by its UTF-16 offset (`out/context.js`); filter shortcuts `''` →
  `message`, `channel_post` and `entities`, `caption_entities` (`out/filter.js` L1/L2), so
  `'::url'` matches a link in text or caption.
- `src/chat/update-log.ts:14-20` `recordProcessed` is `INSERT OR IGNORE`: two commits in one
  update (a command's and ours) are safe.

## Reuse

- `recordEvent`, `ctx.room.commit`, `sentAt` — as `/domikpisik` (`src/stats/domikpisik-handlers.ts`).
- `ONCE_IN_EACH_POOL`'s shape for `GROUP BY ref, user_id`.
- Tests: `roomWith`/`rows` (`test/helpers/rooms.ts`), `telegram.calls()`, `command()`,
  `textMessage()`, `serviceMessage()` (`test/helpers/updates.ts`); migration 5's test as the
  template for migration 6 on old data (`test/chat/schema.test.ts:135-172`).

## Testing-issue estimate

- **`test/helpers/updates.ts` is 246 lines**, at the 250 cap: messages with link entities go in a
  new `test/helpers/links.ts` that decorates `textMessage`/`command`/`serviceMessage` updates,
  with a test in `test/helpers/helpers.test.ts`.
- **Exact-text tests change by design:** `test/stats/stats-format.test.ts` ("words the design's
  mockup", and its `NOBODY` record, which `tsc` will flag) and `test/stats/stats-handlers.test.ts`
  ("answers with the all-time boards") gain the new board.
- `test/stats/event-store.test.ts` selects named columns, so the new columns don't disturb it.
- Nothing impure to extract first: the matcher is pure by design, and the handler is glue over
  `commit`.
- Sizes after the change stay under the caps: `schema.ts` 150 → ~162, `texts.ts` 177 → 178.

## Docs touched

`docs/specs/mvp/design.md`: the *Decisions* "Stats" row (five boards), *Core flows* → `/stats`,
and *Screens and copy* → `/stats`.
