---
date: 2026-11-17
phase: 6
chunk: taps, /join, squad complete, move-up (deliverables 6–9)
inputs: [phases/phase-6-pools-core.md, research/phase-6/2026-11-17-pools-core-preflight.md, principles.md]
---

# Phase 6 recon and preflight — answers

*Source of record — do not edit.*

The same session wrote chunk 1, so this chunk's seam is that code. Recon and preflight share one
note.

## The seam

- `answer()` (`src/pools/pool-rules.ts`) already decides an answer's row, its outcome, the
  move-ups and the squad's completion. The tap, `/join` and phase 8 apply it.
- `cardState()` and `postCard()` (`src/pools/pool-actions.ts`) read a card's state and post the
  card. Editing it is new: `refreshCard()`.
- `poolOfMessage()` and `newestOpenPool()` (`src/pools/pool-store.ts`) are `/join`'s two lookups.
- The catch-all in `src/bot.ts` answers taps no feature answered. The pool taps must answer
  every tap they take and never call `next()` after.

## Findings that change the plan

1. **`AnswerDecision.benchPlace` is optional on every outcome.** The toast for the bench would
   need a fallback that can't happen. The decision becomes a union, and `bench` carries its
   place.
2. **The card's leavers have names but no `Member`.** The squad's mentions need members for
   everyone seated, leavers included. `CardState` gains `people`, everyone on the card by id.
3. **`/join`'s target is a rule with no home yet.** A reply resolves through `pool_messages`: an
   open pool is joined, a closed one gets the closed reply. Anything else goes to the newest open
   pool. The rule, `joinTarget(replied, newestOpen)`, is pure in `pool-rules.ts`, and the handler
   does the two lookups.

## Amendments

1. `AnswerDecision` = a union on `outcome`; `bench` has `benchPlace: number`.
2. `CardState.people: Map<number, Member>`.
3. `joinTarget` in `pool-rules.ts`, with a table test.
4. `applyAnswer` (one `tx`: the answer, its event, the squad flag) and `showAnswer` (the card,
   then the squad's message, then the move-ups) in `pool-actions.ts`, shared by the tap and `/join`.
5. `refreshCard` edits only when the render changed. Telegram's "message is not modified" counts
   as accepted. `card_render` is written after Telegram accepts.

## Defaults applied

- A tap on an unknown pool gets an empty answer. A tap on a closed pool gets
  `Цей пул уже закрито` and re-renders that card.
- A tap is dated by the room's clock, and `/join` by its message (ledger).
- Messages under a card reply to it. Without a card yet, they go out on their own. Each is
  recorded as the pool's.
- The squad's mentions are in name order, like `/all`'s.

## Forks for you

None.
