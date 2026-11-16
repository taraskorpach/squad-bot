---
kind: decision
applies-to: [phase 3, 6, 9]
created: 2026-11-16T18:40:58+02:00
---

# Events are append-only; counting rules live in the stats queries

`events` has no unique index and no CHECK on `kind`. The kinds are a TypeScript union at the one `recordEvent` writer.

The rule "Граю, Пас and opened pools count once per pool and person" is applied in `stats-queries.ts`:
- each (kind, pool, person) counts once, placed by its first event (`MIN(at)`);
- total joins are distinct (pool, person) pairs.

- **Why:** the planned `idx_events_once_per_pool` broke switching back to Граю unless every insert remembered `OR IGNORE`, and a violation became a stalled update (adversarial-tester, integration-architect). It also froze a stats rule into the one table whose history can't be regenerated, and SQLite can't change a CHECK without rebuilding the table (principal-engineer).
- **Standing rule:** the schema holds identity and structure. Tunable domain rules (event kinds, size bounds, counting rules) live in code. `pools.size` lost its CHECK for the same reason.
- **Result:** the boards come out the same as with the index, and a future board, such as "хто найчастіше передумує", can be computed from the history.
- **Source:** `reviews/2026-11-16-failure-paths-and-go-live.md` (R6).
