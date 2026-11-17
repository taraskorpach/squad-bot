---
date: 2026-11-17
phase: 2
chunk: phase-2 (all five deliverables)
lens: preflight
recon: 2026-11-17-phase-2-recon.md
---

# Phase 2 preflight — the баян and 👀

*Source of record — do not edit.* Scaled to the chunk: one feature file and three small helpers,
with the seam read in full.

## Findings that change the plan

1. **The year is two helpers, not string-building in the format.** design.md's `{when}` needs "is
   it this year?" and `12.11.2026`; building `${dayAndMonth(at)}.${year}` in `share-format.ts`
   would put a date format outside `src/kyiv-time.ts`, the one place the zone and its formats
   live (`src/kyiv-time.ts:1-3`). `kyiv-time.ts` gains `fullDate` and `sameYear`, each tested.
2. **`firstEventAbout` returns a `StatEvent`**, not a row: the handler and the format then speak
   the event store's types (`src/stats/event-store.ts:7-14`), and `messageId` stays optional for
   a first share with none.

## Canon against phase 2

| Pass | Rule | Verdict | Concrete consequence |
|---|---|---|---|
| Clean Code | Small functions | Bites | `bayanText` maps `bayanLine`; `sentWhen` alone picks today, yesterday or a date |
| Clean Code | Command/query separation | Bites | The commit returns what it found (`firsts`, `names`); the answers read that result, never the store again |
| Clean Architecture | Humble object | Bites | The handler stays glue; the words live in the pure `src/shares/share-format.ts`, as `stats-format.ts` is to `/stats` |
| SOLID | SRP | Bites | `messageLink` serves two features, so it leaves pools for `src/telegram.ts` |
| SOLID | OCP, LSP, ISP, DIP | Inert | — |
| DDD | Invariant ownership | Bites | "first" is the record's order (`ORDER BY id`), stated once in `firstEventAbout` |

## Guard blindness

None new: phase 1's `freshRoom()` test already holds `trackShares` first in `FEATURES`.

## Amendments

1. `kyiv-time.ts` gains `fullDate(ms)` (`16.11.2026`) and `sameYear(a, b)`, tested beside
   `dayAndMonth`.
2. `firstEventAbout(sql, kind, ref): StatEvent | undefined`.

## Defaults applied

- The reaction goes before the reply when a message has both a new post and a баян.
- `messageLink` moves in a commit of its own, and `/pools` keeps its output.

## Forks for you

None.
