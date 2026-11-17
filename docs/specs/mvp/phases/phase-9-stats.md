---
needs: [3]
pr: C
---

# Phase 9 — Stats

**Goal:** `/stats` shows five all-time leaderboards, read from the event record. The phase first built them for this month and all time; on 2026-11-17 Taras chose all time only (`ledger/decision-stats-all-time-only.md`), so the month window below is history.

**Outcome:** The group's running jokes get a scoreboard. Free. Low risk.

**Files to touch:**
- `src/kyiv-time.ts` (`monthWindow`, the month's name; phase 6 created the module)
- `src/stats/stats-queries.ts`, `src/stats/stats-format.ts`, `src/stats/stats-handlers.ts`
- `src/texts.ts`, `src/bot.ts`
- `test/stats/*.test.ts`

## Implementation guidance

- **Windows are computed in code** with `Temporal` in `src/kyiv-time.ts`: SQLite's `localtime` is
  the host's UTC and it knows no zones (craft). Test month starts in winter (UTC+2) and summer
  (UTC+3), and months whose boundary and `now` sit on opposite sides of a DST change: only those
  catch a window built from the offset at `now` (preflight, finding 2).
- **Queries** run over the append-only `events`, with and without the window (`technical.md` →
  *Stats*).
  - `all` and `domikpisik` count every event.
  - `join`, `pass` and `pool_open` count once per pool and person, placed by the pair's first event.
  - Seed events directly in tests, including a person who toggled ✅ → ❌ → ✅. This phase doesn't
    need pools.
- **Format** is pure: rows sorted by month, then all time, then name; zero rows left out; empty
  boards say `— поки порожньо`.

## Deliverables

- [x] Stats windows (pure, in `src/kyiv-time.ts`): the current Kyiv month as a UTC range, right across DST changes
- [x] Leaderboard queries: per-person counts for the five kinds, this month and all time, with `join`, `pass` and `pool_open` counted once per pool and person by their first event; total joins as distinct pool-and-person pairs
- [x] Leaderboard format (pure): the header with the month's Ukrainian name, five boards, sorting, empty boards
- [x] `/stats`: replies with the boards
- [x] `/stats` counts all time only: no Kyiv month, one count per row (Taras, 2026-11-17, while trying it in the test group)

## Phase-local notes

- PR C is stacked on PR B, which merges first, so the Граю, pools and Пас boards fill from the
  pools' events as soon as PR C is live.
- Preflight defaults (`research/phase-9/2026-11-17-stats-preflight.md`): "this month" is read at
  the room's clock; equal counts share a place (1, 1, 3); names are told apart among every member
  the bot knows.
