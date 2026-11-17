---
needs: []
---

# Phase 1 — Posts on the board

**Goal:** The bot counts every post sent to the chat from Instagram, Threads, TikTok and YouTube as one kind of event, and `/stats` shows a `🍿 Скидає контент` board with each post once per person.

**Outcome:** The friends see who sends the most reels, TikToks, videos and posts in `/stats`, counted from the day it ships; the bot says nothing in the chat yet. Free. Low risk: one migration that only adds two empty columns, tested on old data.

**Files to touch:**
- `src/chat/schema.ts`
- `src/stats/event-store.ts`, `src/stats/stats-queries.ts`, `src/stats/stats-format.ts`
- `src/shares/share-links.ts` (new), `src/shares/share-handlers.ts` (new)
- `src/bot.ts`, `src/texts.ts`
- `test/helpers/updates.ts`, `test/chat/schema.test.ts`, `test/stats/*.test.ts`
- `test/shares/share-links.test.ts` (new), `test/shares/share-handlers.test.ts` (new)
- `docs/specs/mvp/design.md`: `/stats` has six boards

## Implementation guidance

- **The migration first**, tested on an object holding old events (`technical.md` → *Storage*).
  It is the one change a live object can't take back. Phase 2's баян needs `message_id` from the
  first counted post on, so both columns land now.
- **Then the matcher**, pure and table-driven from design.md → *What counts*, one platform's rules
  at a time (technical.md → *What a post is*). It takes link strings and knows nothing of grammY,
  so a link form a platform adds later is one row.
- **Then the feature.** `trackShares` listens on `['::url', '::text_link']`, reads the links with
  `ctx.entities(['url', 'text_link'])`, and records after `await next()` (technical.md → *The
  feature*). It goes first in `FEATURES`, so a command's message is seen too.
- **Then the board.** Adding `'share'` to `EventKind` makes `tsc` list every
  `Record<EventKind, …>` that needs it: `COUNTED`, `readStats`, and the tests' `NOBODY`.
- The test helper builds the `url` entities Telegram adds, with UTF-16 offsets, a caption with
  `caption_entities`, and a `text_link`.

## Deliverables

- [ ] Migration 6: `events` gains `ref` and `message_id`, indexed on `(kind, ref)`; old events kept and the five boards unchanged
- [ ] `postOf` for Instagram and Threads: every such link in design.md → *What counts* gives its id, and their non-posts give nothing
- [ ] `postOf` for TikTok and YouTube: the same, and `postRefs` gives each post of a message once
- [ ] A message with posts records one `share` event per distinct post (sender, sent time, `{platform}:{id}`, message id) from its text, caption or hidden links, a command's message included; once per update, and no Telegram call
- [ ] `/stats` shows `🍿 Скидає контент` after `🏠 /domikpisik`, each post once per person, and mvp's design.md says six boards

## Phase-local notes

- Stale messages count: `trackShares` records whatever `ctx.room.stale` says. Only phase 2's
  answers check it.
