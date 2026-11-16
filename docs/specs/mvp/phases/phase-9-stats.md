---
needs: [3]
pr: C
---

# Phase 9 — Stats

**Goal:** `/stats` shows five leaderboards for this month and all time, read from the event record, with months cut at Kyiv midnight.

**Outcome:** The group's running jokes get a scoreboard. Free. Low risk.

**Files to touch:**
- `src/stats/stats-windows.ts`, `src/stats/stats-queries.ts`, `src/stats/stats-format.ts`, `src/stats/stats-handlers.ts`
- `src/texts.ts`, `src/bot.ts`
- `test/stats/*.test.ts`

## Implementation guidance

- **Windows are computed in code** with `Temporal` in Europe/Kyiv: SQLite's `localtime` is the
  host's UTC and it knows no zones (craft). Test month starts in winter (UTC+2) and summer
  (UTC+3), and a month that starts the day after a DST change.
- **Queries** are plain `COUNT(*) … GROUP BY user_id` over `events`, with and without the window
  (`technical.md` → *Stats*). Seed events directly in tests; this phase doesn't need pools.
- **Format** is pure: rows sorted by month, then all time, then name; zero rows left out; empty
  boards say `— поки порожньо`.

## Deliverables

- [ ] Stats windows (pure): the current Kyiv month as a UTC range, right across DST changes
- [ ] Leaderboard queries: per-person counts for the five kinds, this month and all time, plus total joins
- [ ] Leaderboard format (pure): the header with the month's Ukrainian name, five boards, sorting, empty boards
- [ ] `/stats`: replies with the boards

## Phase-local notes

- Until PR B is live there are no pool events, so the Граю, pools and Пас boards are empty; that is expected.
