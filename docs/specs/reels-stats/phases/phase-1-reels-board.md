---
needs: []
---

# Phase 1 — Reels on the board

**Goal:** The bot counts every Instagram reel sent to the chat, and `/stats` shows a `🎬 Рілси` board with each reel once per person.

**Outcome:** The friends see who sends the most reels in `/stats`, counted from the day it ships; the bot says nothing in the chat yet. Free. Low risk: one migration that only adds two empty columns, tested on old data.

**Files to touch:**
- `src/chat/schema.ts`
- `src/stats/event-store.ts`, `src/stats/stats-queries.ts`, `src/stats/stats-format.ts`
- `src/reels/reel-links.ts` (new), `src/reels/reel-handlers.ts` (new)
- `src/bot.ts`, `src/texts.ts`
- `test/helpers/updates.ts`, `test/chat/schema.test.ts`, `test/stats/*.test.ts`
- `test/reels/reel-links.test.ts` (new), `test/reels/reel-handlers.test.ts` (new)
- `docs/specs/mvp/design.md`: `/stats` has six boards

## Implementation guidance

- **The migration first**, tested on an object holding old events (`technical.md` → *Storage*).
  It is the one change a live object can't take back. Phase 2's баян needs `message_id` from the
  first counted reel on, so both columns land now.
- **Then the matcher**, pure and table-driven from design.md → *What counts*. It takes link
  strings and knows nothing of grammY, so the forms Instagram adds later are one row each.
- **Then the feature.** `trackReels` listens on `['::url', '::text_link']`, reads the links with
  `ctx.entities(['url', 'text_link'])`, and records after `await next()` (technical.md → *The
  feature*). It goes first in `FEATURES`, so a command's message is seen too.
- **Then the board.** Adding `'reel'` to `EventKind` makes `tsc` list every
  `Record<EventKind, …>` that needs it: `COUNTED`, `readStats`, and the tests' `NOBODY`.
- The test helper builds the `url` entities Telegram adds, with UTF-16 offsets, a caption with
  `caption_entities`, and a `text_link`.

## Deliverables

- [ ] Migration 6: `events` gains `ref` and `message_id`, indexed on `(kind, ref)`; old events kept and the five boards unchanged
- [ ] `reelCode`: every form in design.md → *What counts* gives its code, and the rest give nothing
- [ ] A message with reels records one `reel` event per distinct reel (sender, sent time, code, message id) from its text, caption or hidden links, a command's message included; once per update, and no Telegram call
- [ ] `/stats` shows `🎬 Рілси` after `🏠 /domikpisik`, each reel once per person, and mvp's design.md says six boards

## Phase-local notes

- Stale messages count: `trackReels` records whatever `ctx.room.stale` says. Only phase 2's
  answers check it.
