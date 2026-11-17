---
date: 2026-11-17
phase: 1
chunk: phase-1 (all five deliverables)
lens: preflight
recon: 2026-11-17-phase-1-recon.md
---

# Phase 1 preflight — posts on the board

*Source of record — do not edit.* Scaled to the chunk: the recon had read the seam in full, so
most rows are `Inert` or `Bites`.

## Findings that change the plan

1. **"First in `FEATURES`, so a command's message is seen too" has no guard.** The planned test
   `roomWith([trackShares, tagAll])` sets the order inside the test, not in `src/bot.ts:21-30`,
   where a later edit could move `trackShares` after the commands and every test would stay
   green. Add one test through `freshRoom()` (the production `FEATURES`), as
   `test/stats/stats-handlers.test.ts:108-113` does for `/stats`: `/all глянь <link>` both tags and
   records a `share` event.
2. **The `share` path itself makes no Telegram call, but the update can.** Deliverable 4's "no
   Telegram call" holds for `roomWith([trackShares])`; with a command in the message the command
   still answers. Assert "no call" only in the share-only tests.

## Clean Code against phase 1

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Intention-revealing names | Bites | One word per concept: the event is a `share`, the thing shared is a `Post`; `postOf`, `postRefs`, `trackShares`, `texts.stats.shares` |
| Small functions, one level | Bites | `postOf` parses and dispatches by host to one small function per platform (`instagramPost`, `threadsPost`, `tiktokPost`, `youtubePost`); none of them parses |
| No null / Special Case | Bites | `undefined` for "no post", the codebase's idiom (`personSending`, `src/telegram.ts:76-81`) |
| Comments | Bites | House style wins over principle 1: a one-line WHY doc on each export, as `src/stats/event-store.ts:1-14` |
| Tests: one concept each | Bites | The matcher's table test runs a row per link (`it.each`), one file per platform group |
| Boundaries | Inert | `URL` is the platform's; no third-party parser |

## Clean Architecture against phase 1

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Dependency rule | Bites | `share-links.ts` imports nothing; `share-handlers.ts` imports `recordEvent` from `src/stats/event-store.ts`, as `src/members/all-handlers.ts:4` does |
| Humble object | Bites | The handler is glue (entities → refs → `commit`); every rule sits in the pure matcher and the stats query |
| Component cohesion | Bites | `src/shares/` holds the matcher and the handler; the board stays in `src/stats/`, as `/all`'s count does |

## SOLID against phase 1

| Rule | Verdict | Concrete consequence |
|---|---|---|
| SRP (actors) | Bites | Two actors: whoever decides what counts (the matcher, `share-links.ts`) and whoever decides how it's tallied (`COUNTED.share`, `stats-queries.ts:29-35`) |
| OCP | Bites | The next variant is a new link form or platform: one function and one `Platform` member in `share-links.ts`, one table row in its test |
| LSP, ISP, DIP | Inert | No hierarchies or ports in scope |

## DDD against phase 1

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Ubiquitous language | Bites | Domain words `share`/`post`, customer word «контент» in `texts.ts` only |
| Invariant ownership | Bites | "Each post once per person" lives in the query, not in a unique index (mvp decision; `src/chat/schema.ts:34-37`) |
| Value object | Bites | A post's identity is `{platform}:{id}`, built in one place (`postRefs`), never concatenated elsewhere |
| Aggregates, events, contexts | Inert | One append-only record, one chat |

## Guard blindness

- `tsc` sees every `Record<EventKind, …>` (`COUNTED`, `Stats.tallies` via `readStats`, the
  tests' `NOBODY`): not blind.
- The migration numbering test (`test/chat/schema.test.ts:18-22`) sees migration 6's id: not
  blind.
- The `FEATURES` order is unguarded (finding 1).

## Seam and testability (deltas from the recon)

None beyond finding 1. The recon's size-cap note stands: `test/helpers/updates.ts` (246 lines)
stays as it is, and the link builders go in `test/helpers/links.ts`.

## Amendments

1. Add to deliverable 4's commit a test through `freshRoom()`: `/all глянь https://youtu.be/…`
   tags and records one `share` event.
2. `postOf` dispatches by host to one function per platform; `postRefs` alone builds
   `{platform}:{id}`.

## Defaults applied

- Link builders in a new `test/helpers/links.ts`, decorating `textMessage`/`command` updates, with
  a test in `test/helpers/helpers.test.ts`.
- The matcher's tests split as the deliverables do: Instagram and Threads, then TikTok and YouTube.

## Forks for you

None.

No ledger entry: nothing here outlives the phase.
