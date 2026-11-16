---
needs: [6]
pr: B
---

# Phase 7 — Pool buttons and /pools

**Goal:** The card gets its extra buttons (🔔 pings whoever hasn't answered, a one-time 🎲 draws who sits out, ✖️ lets the author close the pool), and `/pools` lists the open pools.

**Outcome:** Fewer "хто ще?" messages, a fair way to settle a sixth player, and a way to cancel a mistaken pool. Free. Low risk.

**Files to touch:**
- `src/pools/pool-rules.ts` (the draw), `src/pools/pool-keyboards.ts`, `src/pools/pool-format.ts`
- `src/pools/pool-callbacks.ts`, `src/pools/pool-handlers.ts` (`/pools`), `src/pools/pool-store.ts`
- `src/texts.ts`
- `test/pools/*.test.ts`

## Implementation guidance

- **The draw is pure:** given the plays, the size and a `random` function, it returns the new
  ranks and who moved in and out (`technical.md` → *Pool rules*). The object passes its `random`
  field, which tests replace through `runInDurableObject`.
- **Who may press:** 🎲 only someone who said Граю in that pool; ✖️ only the author. Anyone else
  gets the toast from `design.md`, and nothing changes.
- **Closing** goes through one `closePool(pool, reason)` path, introduced here for the author;
  phase 8 reuses it for auto-close and makes it cancel pending jobs.
- **`/pools` links** to cards as `https://t.me/c/<chat id without -100>/<message_id>`, which works
  in supergroups (a group with an admin bot is one).

## Deliverables

- [ ] 🔔: tags the members who haven't answered, chunked, as a reply to the card; toast with the count; the button shows only while someone hasn't answered
- [ ] 🎲 (pure draw plus handler): shown only while plays exceed seats and before use, pressable only by players of that pool; renumbers the lineup, posts who moved in and out, and the card notes the draw
- [ ] ✖️: only the author closes; the card turns final with "закрито автором"; everyone else who said Граю is tagged
- [ ] `/pools`: open pools with time, fill, bench count and a link to each card; the empty-state reply

## Phase-local notes

- 🔔 has no cooldown on purpose, like `/all` (`design.md` → *Decisions*).
