---
needs: [1]
---

# Phase 2 — The pool menu

**Goal:** `/pool` with nothing after it opens a menu of buttons that builds a pool: the game, the seats or no limit, and the time.

**Outcome:** `/pool` alone, or a tap on it in the command menu, opens a menu where the game, the seats and the time are picked with buttons. Free. Low risk: typed `/pool cs2 5 21:00` works as before.

**Files to touch:**
- `src/pools/pool-menu.ts` (new), `src/pools/pool-menu-taps.ts` (new)
- `src/pools/pool-handlers.ts`, `src/bot.ts`, `src/kyiv-time.ts`, `src/texts.ts`
- `test/pools/pool-menu.test.ts` (new), `test/pools/pool-menu-taps.test.ts` (new), `test/kyiv-time.test.ts`

## Implementation guidance

- **Pure first**: the button data (`technical.md` → *Button data*), then `upcomingHours`, then the
  screens, then the taps through the object as the pool tap tests do.
- **One way to post a card**: the last step calls `openPool` with the menu's `reply_to_message` as
  the command, so the card, the tags and the alarm's recovery of a lost card stay one path.
- **The double-tap guard** is the room's throttle, in memory. An object restarted between two taps
  in the same second could let both through; that is rare enough to accept.
- Register the menu's Composer in `src/bot.ts` before the catch-all that answers stray taps.

## Deliverables

- [ ] Button data (pure): `m:{author}:{game}:{seats}:{time}` encoded and decoded, other data left alone, every state under 64 bytes
- [ ] `upcomingHours(now)`: the full hours after now, today in Kyiv, up to 23
- [ ] Screens (pure): game, seats, time, the other hour and its minutes, with design.md's copy and buttons
- [ ] `/pool` with nothing after it replies with the menu; with anything after it, opens as before
- [ ] Taps: forward and back, cancel deletes the menu, someone else's tap gets a toast, a passed hour re-renders the time step
- [ ] A chosen time opens the pool: the menu goes, the card posts as a reply to `/pool`, and a second tap opens nothing

## Phase-local notes

- A bot can delete its own message only within 48 hours: past that, edit the menu to
  `✅ Пул відкрито` with no buttons instead.
