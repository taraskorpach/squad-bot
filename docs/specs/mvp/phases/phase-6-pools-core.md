---
needs: [3]
pr: B
---

# Phase 6 — Pools: open, answer, bench

**Goal:** `/pool` opens a card that everyone answers with ✅ Граю, ❌ Пас or `/join`; seats fill in order, extras wait on the bench and move up when a player drops out, and a complete squad is announced once.

**Outcome:** The group gathers a game on one card instead of a pile of replies. Free. Medium risk: most of the rules live here, so they are pure and tested by tables.

**Files to touch:**
- `src/chat/schema.ts` (migration 3)
- `src/kyiv-time.ts` (created here, or by phase 9 if it runs first)
- `src/pools/pool-args.ts`, `src/pools/pool-rules.ts`, `src/pools/pool-format.ts`, `src/pools/pool-keyboards.ts`
- `src/pools/pool-store.ts`, `src/pools/pool-actions.ts`, `src/pools/pool-handlers.ts`, `src/pools/pool-callbacks.ts`
- `src/texts.ts` (the pool copy, and the plural helper on `Intl.PluralRules('uk')` for the
  header's `місце|місця|місць`), `src/bot.ts`
- `test/kyiv-time.test.ts`, `test/pools/*.test.ts`

## Implementation guidance

- **Pure first.** `pool-args`, `pool-rules`, `pool-format` and `pool-keyboards` follow
  `technical.md` → *Pure modules* and are table-tested before any handler exists. PartitelleBot's
  shape is the model: a rule returns a decision (who joined where, who moved up, whether the squad
  just completed) and the handler applies it (craft, E1).
- **Handlers decide and write, then call Telegram.**
  - The shared side effects live in `pool-actions.ts`, written against `Room`, never against a
    grammY context, because phase 8's alarm calls them too.
  - A tap reads the pool and its answers, applies the rule, and writes answers and events in one
    `commit` that returns the decision, with no `await` in between.
  - Only then does it answer the tap, edit the card if its render changed, and post any
    announcement, each call caught on its own.
  - `card_render` is written only after Telegram accepts the edit.
- **Opening a pool.**
  - One commit writes the pool, the author's `play` answer and the `pool_open` and `join` events.
  - Then the bot sends the card as a reply to `/pool` and stores its `message_id`. It posts the
    tag message as a reply to the card: everyone except the author, chunked, with the author's
    name in plain text. Each message is recorded in `pool_messages`.
  - If the card fails to send, the pool stays open with no card: edits are skipped, `/pools`
    shows no link, and phase 8's alarm posts it later.
  - A tap on a card the bot didn't record adopts that message as the card.
- **Times** resolve against the message's date, taking the nearest occurrence among yesterday,
  today and tomorrow (`technical.md` → *`/pool` arguments*). A `/pool` or `/join` more than 10
  minutes late does nothing.
- **Every string a user provides** is escaped, the game word included (`/pool R&D`, `/pool <3`).
- **The card** has ✅ and ❌ only in this phase; phase 7 adds 🎲, 🔔 and ✖️ to the same keyboard module.
- **Two taps for the last seat** must give one seat and one bench place: a test sends both to the
  object at once.

## Deliverables

- [ ] Migration 3: `pools`, `answers` and `pool_messages` tables
- [ ] `/pool` arguments (pure) with `src/kyiv-time.ts`: game word first, size 2–10 and time in any order; the nearest occurrence among yesterday, today and tomorrow in Kyiv time, against the message's date, with the under-an-hour-means-now rule and both DST nights; each error from `design.md`
- [ ] Pool rules (pure): lineup by rank, switching answers, move-ups as the squad after minus the squad before (the actor left out), the squad completing for the first time
- [ ] Card and keyboard (pure): open and closed renders with the ✅ and ❌ buttons and the `p:<id>:<action>` codec, every user-provided string escaped, identical output for identical input
- [ ] `/pool`: one commit for the pool, the author's answer and the `pool_open` and `join` events; then the card and the tag message, recorded in `pool_messages`; a card that fails to send leaves the pool open with no card; a stale `/pool` does nothing
- [ ] ✅ and ❌ taps through `pool-actions.ts`: the answer and its `join` or `pass` event committed, the toast, the card edited only when its render changed (`card_render` written after Telegram accepts); a tap on an unrecorded card adopts it
- [ ] `/join`: a reply resolves its pool through `pool_messages` (open → join, closed → the closed reply), anything else joins the newest open pool, with a 👌 reaction; the no-open-pool reply; a stale `/join` does nothing
- [ ] Squad complete: `squad_announced` set in the commit that fills the squad, then the message posted once
- [ ] Move-up: a player who passes is replaced by the bench head, who is pinged; a bench member passing moves nobody

## Phase-local notes

- Pools never close in this phase; phase 8 adds the timers. PR B ships phases 6–8 together, so the chat never sees that gap.
- Always answer a tap, even a stale or unknown one, or the client keeps spinning (wave 0 §5).
