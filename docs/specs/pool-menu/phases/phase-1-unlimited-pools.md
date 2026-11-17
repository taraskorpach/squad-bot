---
needs: []
---

# Phase 1 — Pools without a seat limit

**Goal:** A pool can have no seat limit: everyone who says Граю plays, with no bench, draw or "squad complete" message.

**Outcome:** Nothing changes in the chat yet: only the menu (phase 2) opens such a pool. Free. Low risk: pools with a size behave as before.

**Files to touch:**
- `src/pools/pool-store.ts`, `src/pools/pool-rules.ts`
- `src/pools/pool-format.ts`, `src/pools/pool-messages.ts`
- `src/pools/pool-alarm.ts`, `src/pools/pool-handlers.ts`, `src/pools/pool-actions.ts`, `src/pools/pool-card.ts`
- `src/texts.ts`
- `test/pools/*.test.ts`

## Implementation guidance

- **Start at the store's boundary** (`technical.md` → *Pools without a limit*): `size` 0 in the
  table is `undefined` in the domain, and nowhere else knows the 0. Make `size` optional on the
  pool type and let `tsc` list every caller.
- **Rules next**, pure and table-tested: `lineupOf` without a size, `answer` without a bench or a
  squad-complete, the draw refused by an empty bench.
- **Then the words**: the card's header and players line, the start ping and `/pools`, with
  design.md's copy word for word.
- No command opens such a pool yet, so tests insert one directly with no size.

## Deliverables

- [ ] Store: a size of 0 reads as no limit (`size` undefined), and no limit is written as 0
- [ ] Rules: with no limit everyone who says Граю plays; no bench, no move-up, no squad-complete
- [ ] Card: `🎮 {game} · без ліміту · {when}` and `✅ Грають ({n}): …`, never with 🎲
- [ ] Messages: the start ping without `({n}/{size})`, and `/pools` showing `{n} у грі`

## Phase-local notes

- This phase has no way in from the chat; phase 2's menu is the first to open such a pool.
