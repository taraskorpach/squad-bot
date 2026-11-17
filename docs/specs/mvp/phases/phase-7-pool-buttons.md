---
needs: [6]
pr: B
---

# Phase 7 — Pool buttons and /pools

**Goal:** The card gets its extra buttons (🔔 pings whoever hasn't answered, a one-time 🎲 draws who sits out, ✖️ lets the author close the pool), and `/pools` lists the open pools.

**Outcome:** Fewer "хто ще?" messages, a fair way to settle a sixth player, and a way to cancel a mistaken pool. Free. Low risk.

**Files to touch:**
- `src/pools/pool-rules.ts` (the draw), `src/pools/pool-keyboards.ts`, `src/pools/pool-format.ts`
- `src/pools/pool-callbacks.ts`, `src/pools/pool-handlers.ts` (`/pools`), `src/pools/pool-store.ts`, `src/pools/pool-actions.ts` (`closePool`)
- `src/texts.ts`
- `test/pools/*.test.ts`

## Implementation guidance

- **The draw is pure:** given the plays, the size and a `random` function, it returns the new
  ranks and who moved in and out (`technical.md` → *Pool rules*). The object passes its `random`
  field, which tests replace through `runInDurableObject`.
- **Who may press:** 🎲 only someone who said Граю in that pool; ✖️ only the author. Anyone else
  gets the toast from `design.md`, and nothing changes.
- **Closing** goes through one `closePool(room, poolId, reason)` in `pool-actions.ts`, introduced
  here for the author; phase 8's alarm reuses it for auto-close. It takes `Room`, not a grammY
  context, so the alarm can call it.
- **`/pools` links** to cards as `https://t.me/c/<chat id without -100>/<message_id>`. That works
  in supergroups, and phase 5 makes sure the chat is one. A pool with no card yet is listed
  without a link.
- **Outdated keyboards.** A client can still show 🎲 or 🔔 after the card has changed.
  - 🎲 with nobody on the bench, and 🔔 with everyone answered, get their toasts and re-render
    the card.
  - 🔔 tags at most once per 30 s per pool (Taras, review 2026-11-16); a repeat gets its toast.
- **The draw message** lists the whole squad and the whole bench. A draw of 6 for 5 keeps the same
  squad 1 time in 6, and a list of only who moved would then be empty.

## Deliverables

- [x] 🔔: tags the members who haven't answered, chunked, as a reply to the card, at most once per 30 s per pool; a toast with the count, or its own toast for a repeat or when everyone has answered; the button shows only while someone hasn't answered
- [x] 🎲 (pure draw plus handler): shown only while plays exceed seats and before use, pressable only by players of that pool; renumbers the lineup, posts the whole squad and the whole bench, and the card notes the draw; an outdated 🎲 with nobody on the bench gets its toast
- [x] ✖️: only the author closes, through `closePool` in `pool-actions.ts`; the card turns final with "закрито автором"; everyone else who said Граю is tagged
- [x] `/pools`: open pools with time, fill, bench count and a link to each card (none while a pool has no card); the empty-state reply

## Phase-local notes

- 🔔 tags at most once per 30 s per pool, like `/all` (`design.md` → *Decisions*).
