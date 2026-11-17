---
date: 2026-11-17
phase: 7
chunk: 🔔, 🎲, ✖️ and /pools (deliverables 1–4)
inputs: [phases/phase-7-pool-buttons.md, design.md, research/phase-6/2026-11-17-answers-preflight.md, principles.md]
---

# Phase 7 recon and preflight — pool buttons and /pools

*Source of record — do not edit.*

The same session built phase 6, so phase 7's seam is that code. Recon and preflight share one
note.

## The seam

- **Buttons and the card.**
  - `pool-keyboards.ts` has the action list (`in`, `out`) and `poolKeyboard(poolId)`, a
    single row.
  - `renderCard` (`pool-format.ts`) passes no lineup to the keyboard, so it can't decide 🎲 or 🔔.
- **Taps.** `pool-callbacks.ts` switches on the answer's result. The new actions branch before
  `applyAnswer`, since none of them is an answer.
- **The throttle.** `room.throttle.claim(key, now, windowMs)` (`src/chat/throttle.ts`) keeps
  `/all`'s window per object. 🔔's key is per pool. `RoomAccess` has no throttle; the tap
  handler uses `ctx.room.throttle`.
- **Randomness.** `room.random()` is the object's seam (`chat-room.ts`), which tests replace.
- **Store.** `pool-store.ts` lacks closing, the draw's new ranks and the list of open pools.

## Findings that change the plan

1. **The keyboard depends on the lineup now.**
   - 🎲 shows only while plays exceed the seats and before the draw.
   - 🔔 shows only while someone hasn't answered.
   - ✖️ shows on every open card, for everyone; only the author's press works.

   So `poolKeyboard` takes the pool and its lineup, and `renderCard` passes both. The phase-6
   tests of a one-row keyboard change with it.
2. **The draw's "join order" is rank order before the draw.** The draw renumbers ranks: the
   drawn first, then the rest, each in their old rank order. A later Граю still goes to
   `max(rank) + 1`, so it lands at the end of the bench.
3. **The 🔔 message's later chunks have no copy in the design.** The first is
   `🔔 Чекаємо на відповідь: {mentions}`. The rest are `🔔 {mentions}`, the way the opening
   message continues with `📢 {mentions}`.

## Rules that bite

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Pure core | Bites | `draw(size, answers, random)` returns the new answers in rank order, plus the squad and the bench, so a test with a fixed `random` pins the outcome |
| One closing path | Bites | `closePool(room, poolId, reason)` commits `status` and `closed_by` only while open (`WHERE status = 'open'`) and renders the final card. For the author, it also tags the others who said Граю. Phase 8 calls it with `auto` |
| Who may press | Bites | ✖️ checks the author; 🎲 checks a current Граю. The check happens inside the commit, against the pool as stored |
| OCP | Bites | The action list in `pool-keyboards.ts` gains `ping`, `draw` and `close`. The tap handler dispatches on the action |

## Amendments

1. `poolKeyboard(pool, lineup)`; `renderCard` adds `🎲 Склад визначено жеребом` under the author line once drawn.
2. `draw` in `pool-rules.ts`, a partial Fisher–Yates over the plays in rank order with the
   injected `random`. Table-tested with fixed draws.
3. `closePool`, `drawPool` and `pingPool` as actions. `/pools` in `pool-handlers.ts`, its list built
   in `pool-messages.ts` with `cardLink(chatId, messageId)` → `https://t.me/c/<id without -100>/<id>`.

## Defaults applied

- 🎲's refusals are checked in this order: already drawn, then not playing, then nobody on the
  bench. Once the draw is used, nobody can draw, so that comes first.
- `/pools` lists pools in the order they opened. A stale `/pools` does nothing, like every other
  late command.
- The author's close says `Пул закрито` as its toast, then edits the card, then tags the others.

## Forks for you

None.
