---
needs: [1]
---

# Phase 2 — The баян and 👀

**Goal:** The bot answers reels: 👀 on a reel new to the chat, and «🪗 Баян! Уже було — …» with who sent it first, when, and a link to their message, on a reel the chat has seen.

**Outcome:** The chat sees the bot counting: a 👀 on each new reel, and a баян called out with a link to the original. Free. Low risk: the answers go out after the count, so a failed one never loses or doubles a reel.

**Files to touch:**
- `src/stats/event-store.ts`
- `src/reels/reel-handlers.ts`, `src/reels/reel-format.ts` (new)
- `src/telegram.ts`, `src/pools/pool-messages.ts`
- `src/kyiv-time.ts`, `src/texts.ts`
- `test/reels/reel-handlers.test.ts`, `test/reels/reel-format.test.ts` (new)
- `test/stats/event-store.test.ts`, `test/telegram.test.ts`, `test/pools/pool-messages.test.ts`,
  `test/kyiv-time.test.ts`

## Implementation guidance

- **The lookup first.** `firstEventAbout` orders by `id`, the order the bot took them, so "first"
  is whoever the bot counted first (technical.md → *The баян*).
- **Then the link and the line.** Move `cardLink` to `src/telegram.ts` as `messageLink` in a commit
  of its own, with its test, and `/pools` unchanged. The баян's line is pure, in `reel-format.ts`:
  the name, `{when}` and the link, with design.md's copy word for word.
- **Then the answers** in `trackReels`. The lookup runs inside the phase-1 commit, before the
  inserts. The reply and the reaction go out after the commit, through `attempt`, and only when the
  message isn't stale.

## Deliverables

- [ ] `firstEventAbout`: the first event about a reel, in the order the bot recorded them, with who, when and which message
- [ ] `messageLink` in `src/telegram.ts`, and `/pools` links its cards as before
- [ ] The баян's line: `🪗 Баян! Уже було — {name}, {when} → оригінал`, with `{when}` as `сьогодні о 21:40`, `вчора о 21:40`, `12.11` or `12.11.2026`
- [ ] A reel the chat has seen gets the баян reply, a line per such reel, the sender's own repeat included; the count is unchanged
- [ ] A reel new to the chat gets 👀; a stale message gets neither; a failed reply or reaction is logged and the count stands

## Phase-local notes

- A баян gets no 👀: the reply is its answer. A message with a new reel and a баян gets both.
