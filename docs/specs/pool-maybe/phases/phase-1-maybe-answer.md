---
needs: []
---

# Phase 1 — The 🤷 ± answer

**Goal:** A pool card has a third answer, `🤷 ±`: listed on its own line, holding no seat, left out of 🔔 and asked at the start.

**Outcome:** Friends who might come can say so on the card, and the start ping asks them whether they're in. Free. Low risk: one rebuild of the answers table, tested on old data.

**Files to touch:**
- `src/chat/schema.ts`
- `src/pools/pool-rules.ts`, `src/pools/pool-actions.ts`, `src/pools/pool-keyboards.ts`, `src/pools/pool-callbacks.ts`
- `src/pools/pool-format.ts`, `src/pools/pool-messages.ts`, `src/pools/pool-alarm.ts`
- `src/texts.ts`
- `test/chat/schema.test.ts`, `test/pools/*.test.ts`

## Implementation guidance

- **The migration first**, tested on the old table holding answers (`technical.md` → *Storage*):
  it is the one change a live object can't take back.
- **Then the rules**: `Choice` gains `maybe`, and `tsc` lists every switch that must answer it.
- **Then the words**: the card line, the button, the toasts and the start ping's second line, with
  design.md's copy word for word.

## Deliverables

- [ ] Migration 5: `answers` without the CHECK on `choice`, every existing answer carried over
- [ ] Rules: a maybe holds no seat, keeps its rank, frees a seat for the bench's first; outcomes `maybe` and `already-maybe`
- [ ] The card: `[ ✅ Граю ] [ 🤷 ± ] [ ❌ Пас ]` and `🤷 Може: …`; the toasts; a 🤷 tap answers through the object, with no event recorded
- [ ] The start ping: the maybes in a line of their own, `🤷 …, ви з нами?`

## Phase-local notes

- A maybe is "answered": 🔔 doesn't ping it, and it isn't in `⏳ Ще не відповіли`.
