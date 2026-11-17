---
kind: decision
applies-to: [phase 6, 9]
created: 2026-11-16T23:20:39+02:00
---

# An event's `at` is when the person acted, not when the bot processed it

A command's event records its message's date (`sentAt(message)` in `src/telegram.ts`); a tap,
which carries no date, records the room's clock. Phase 6 applies the same rule to `pool_open`,
`join` and `pass`.

- **Why:** a late command is still counted (`design.md` → *Edge cases*, Outages), and phase 9
  places events into Kyiv months by `at`. Processing time would move a call made at 23:59 on the
  31st, delivered after an outage, into the next month.
- **Where:** `technical.md` → *Data model*; `/all` and `/domikpisik` (phase 3).
- **Source:** `research/phase-3/2026-11-16-members-and-all-preflight.md`, finding 5.
