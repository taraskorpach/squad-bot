---
created: 2026-11-17T15:51:01+02:00
updated: 2026-11-17T15:51:01+02:00
status: draft
area: [bot]
domain: [pools]
scope: [feature]
related:
  - mvp: the pool card, its answers and its start ping come from its phases 6–8
  - pool-menu: pools without a seat limit, which a maybe answers the same way
---

# Pool Maybe Spec

A third answer on the pool card, `🤷 ±`, for people who might come. A maybe takes no seat and
shows on its own line, `🤷 Може: …`. 🔔 leaves maybes alone (they answered), and the start ping
asks them in a line of their own: `🤷 …, ви з нами?`.

## Files

| File | Purpose |
|------|---------|
| `design.md` | Decisions, the card with a maybe, toasts and the start ping |
| `technical.md` | The answers table without its CHECK, the rules and files |
| `progress.md` | Thin index of phases (checkboxes + pointers) |
| `pr-opening.md` | PR-readiness gate — spec state + pre-PR checks (not a phase) |
| `code-map.md` | Load-bearing files inventory |
| `phases/` | Per-phase detail |
| `ledger/INDEX.md` | Forward-propagating learnings |

## Relationship to code

This spec is a *design document*, not a live mirror. For ground truth:
- `docs/specs/mvp/design.md` — the pool card and its answers, which this spec extends
- `src/pools/` — the pools feature; `src/chat/schema.ts` — the migrations
