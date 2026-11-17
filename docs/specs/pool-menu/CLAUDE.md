---
created: 2026-11-17T15:03:57+02:00
updated: 2026-11-17T15:03:57+02:00
status: done
area: [bot]
domain: [pools]
scope: [feature]
related:
  - mvp: /pool, the pool card and its timers come from its phases 6–8; this spec extends them
---

# Pool Menu Spec

`/pool` with nothing after it opens a menu of buttons: the game (CS2 or Мафія), the seats (2–10 or
no limit) and the time (now, the next full hours, or any hour and minute). A pool can also have no
seat limit: whoever says Граю plays. Typed `/pool cs2 5 21:00` works as before.

## Files

| File | Purpose |
|------|---------|
| `design.md` | Product & UX spec — decisions, the menu's screens and copy, pools without a limit |
| `technical.md` | The menu's button data, the no-limit size, files and tests |
| `progress.md` | Thin index of phases (checkboxes + pointers) |
| `pr-opening.md` | PR-readiness gate — spec state + pre-PR checks (not a phase) |
| `code-map.md` | Load-bearing files inventory |
| `phases/` | Per-phase detail — one entry per phase, flat file or folder |
| `ledger/INDEX.md` | Forward-propagating learnings — scan here first |
| `in-flight/` | Ephemeral pending state, one file per phase (on-demand) |
| `reviews/` | Collegium review snapshots (on-demand) |
| `research/` | Deep research output snapshots (on-demand) |

## Relationship to code

This spec is a *design document*, not a live mirror. For ground truth:
- `/CLAUDE.md` — Ukrainian in the chat, English in code and docs
- `docs/specs/mvp/design.md` — the pool card, its copy and rules, which this spec extends
- `src/pools/` — the pools feature: commands, card, buttons, timers
