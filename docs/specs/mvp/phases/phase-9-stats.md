---
needs: [3]
pr: C
---

# Phase 9 — Stats

**Goal:** `/stats` shows five leaderboards for this month and all time, read from the event record, with months cut at Kyiv midnight.

**Outcome:** The group's running jokes get a scoreboard. Free. Low risk.

**Files to touch:**
- `src/kyiv-time.ts` (`monthWindow`, the month's name; created here if phase 6 hasn't yet)
- `src/stats/stats-queries.ts`, `src/stats/stats-format.ts`, `src/stats/stats-handlers.ts`
- `src/texts.ts`, `src/bot.ts`
- `test/stats/*.test.ts`

## Implementation guidance

- **Windows are computed in code** with `Temporal` in `src/kyiv-time.ts`: SQLite's `localtime` is
  the host's UTC and it knows no zones (craft). Test month starts in winter (UTC+2) and summer
  (UTC+3), and a month that starts the day after a DST change.
- **Queries** run over the append-only `events`, with and without the window (`technical.md` →
  *Stats*).
  - `all` and `domikpisik` count every event.
  - `join`, `pass` and `pool_open` count once per pool and person, placed by the pair's first event.
  - Seed events directly in tests, including a person who toggled ✅ → ❌ → ✅. This phase doesn't
    need pools.
- **Format** is pure: rows sorted by month, then all time, then name; zero rows left out; empty
  boards say `— поки порожньо`.

## Deliverables

- [ ] Stats windows (pure, in `src/kyiv-time.ts`): the current Kyiv month as a UTC range, right across DST changes
- [ ] Leaderboard queries: per-person counts for the five kinds, this month and all time, with `join`, `pass` and `pool_open` counted once per pool and person by their first event; total joins as distinct pool-and-person pairs
- [ ] Leaderboard format (pure): the header with the month's Ukrainian name, five boards, sorting, empty boards
- [ ] `/stats`: replies with the boards

## Phase-local notes

- Until PR B is live there are no pool events, so the Граю, pools and Пас boards are empty; that is expected.
