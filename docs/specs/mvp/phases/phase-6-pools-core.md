---
needs: [3]
pr: B
---

# Phase 6 — Pools: open, answer, bench

**Goal:** `/pool` opens a card that everyone answers with ✅ Граю, ❌ Пас or `/join`; seats fill in order, extras wait on the bench and move up when a player drops out, and a complete squad is announced once.

**Outcome:** The group gathers a game on one card instead of a pile of replies. Free. Medium risk: most of the rules live here, so they are pure and tested by tables.

**Files to touch:**
- `src/chat/schema.ts` (migration 3)
- `src/pools/pool-args.ts`, `src/pools/pool-rules.ts`, `src/pools/pool-format.ts`, `src/pools/pool-keyboards.ts`
- `src/pools/pool-store.ts`, `src/pools/pool-handlers.ts`, `src/pools/pool-callbacks.ts`
- `src/texts.ts`, `src/bot.ts`
- `test/pools/*.test.ts`

## Implementation guidance

- **Pure first.** `pool-args`, `pool-rules`, `pool-format` and `pool-keyboards` follow
  `technical.md` → *Pure modules* and are table-tested before any handler exists. PartitelleBot's
  shape is the model: a rule returns a decision (who joined where, who moved up, whether the squad
  just completed) and the handler applies it (craft, E1).
- **Handlers decide and write, then call Telegram.** A tap reads the pool and its answers, applies
  the rule, and writes answers and events through `ctx.room.commit` with no `await` in between;
  only then does it answer the tap, edit the card if its render changed, and post any announcement.
- **Opening a pool** writes the pool, the author's `play` answer and the `pool_open` and `join`
  events in one commit, then sends the card as a reply to `/pool`, stores its `message_id`, and
  posts the tag message (everyone except the author, chunked) as a reply to the card.
- **The card** has ✅ and ❌ only in this phase; phase 7 adds 🎲, 🔔 and ✖️ to the same keyboard module.
- **Two taps for the last seat** must give one seat and one bench place: a test sends both to the
  object at once.

## Deliverables

- [ ] Migration 3: `pools` and `answers` tables
- [ ] `/pool` arguments (pure): game word first, size 2–10 and time in any order, Kyiv time with the under-an-hour-means-now rule, each error from `design.md`
- [ ] Pool rules (pure): lineup by rank, switching answers, the bench head moving up, the squad completing for the first time
- [ ] Card and keyboard (pure): open and closed renders with the ✅ and ❌ buttons and the `p:<id>:<action>` codec, identical output for identical input
- [ ] `/pool`: the pool with its author playing, the card as a reply, then the tag message; `pool_open` and the author's `join` recorded
- [ ] ✅ and ❌ taps: the answer committed, the toast, the card edited only when changed, `join` and `pass` counted once per pool, "squad complete" posted once, a move-up pinged
- [ ] `/join`: a reply joins that card's pool, otherwise the newest open pool, with a 👌 reaction; replies for no open pool and for a closed one

## Phase-local notes

- Pools never close in this phase; phase 8 adds the timers. PR B ships phases 6–8 together, so the chat never sees that gap.
- Always answer a tap, even a stale or unknown one, or the client keeps spinning (wave 0 §5).
