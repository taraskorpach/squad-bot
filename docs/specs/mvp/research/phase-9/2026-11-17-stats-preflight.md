---
date: 2026-11-17
phase: 9
chunk: stats windows, leaderboard queries, format and /stats (deliverables 1–4)
inputs: [phases/phase-9-stats.md, research/phase-9/2026-11-17-stats-recon.md, principles.md, technical.md, design.md]
---

# Phase 9 preflight — stats

*Source of record — do not edit.*

The recon read the whole seam, so Stage 0 re-read only what the findings cite.

## Findings that change the plan

1. **Two lines of the phase file are out of date.**
   - "created here if phase 6 hasn't yet": phase 6 created `src/kyiv-time.ts` (:1-62).
   - "Until PR B is live there are no pool events": PR C is stacked on PR B (`pr-opening.md`,
     "C from B"), so PR B merges first. The Граю, pools and Пас boards fill as soon as PR C is
     live.

   Correct both in the phase file.
2. **The DST tests, as the phase words them, can't see the bug they are for.**
   - The likely bug is a window built from the UTC offset at `now`. It is right whenever `now` and
     the boundary share an offset.
   - "A month that starts the day after a DST change" doesn't catch it. November 2027 starts the
     day after the 31.10 change, and with `now` in November, 1.11 00:00 − 2 h is 31.10 22:00Z,
     the right answer. Both instants are already past the change.
   - The tests must put `now` across a change from the boundary they check:
     - October 2027 read after its 31.10 change: the start, 30.09 21:00Z, is still summer time;
     - March 2030 read before its 31.03 change: the end, 31.03 21:00Z, is already summer time;
     - the first Kyiv hour of a month, when UTC still says the previous month (1.04.2030 00:30 is
       31.03 21:30Z). That catches a month taken from the UTC calendar.

   A project lesson records this.
3. **`{place}` is undefined for ties.** `design.md` → *`/stats*` sorts by this month, then all
   time, then name, but doesn't say whether equal counts share a place. Seven friends tie often,
   most of all early in a month. Default: equal month and all-time counts share a place (1, 1, 3),
   and the name only orders them.
4. **Whose names the boards tell apart.**
   - `displayNames` (`src/members/mentions.ts:13-22`) tells apart only the members it is given.
   - `cardState` (`src/pools/pool-card.ts:25-42`) gives it the chat plus the card's leavers.
   - The boards are all-time, so they hold leavers too. Telling apart only the people on the
     boards would leave a second Олег, one who never did anything counted, unnoticed.

   Default: tell apart every member the bot knows, through one `knownMembers(sql)` in
   `member-store.ts`, next to `membersById`. Resolve an id to a name as `renderCard` does
   (`pool-format.ts:25`: the map, else the id), so a row never silently vanishes.
5. **"This month" needs an instant.** The phase doesn't say whose.
   - `/pools` labels by the room's clock (`pool-handlers.ts:71`).
   - A stale `/stats` is ignored (`bot.ts:99-104`), so the clock and the message's date differ by
     at most 10 minutes.

   Default: the room's clock.

## Clean Code against the stats

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Intention-revealing names | Bites | The domain words are the kinds (`join`, `pass`, `pool_open`); the chat's words (Граю, Пас, Відкриває пули) live only in `texts.stats` |
| Small functions, one level of abstraction | Bites | `statsText` lists the boards; each board's lines (filter, sort, place, row) is its own function |
| No flag arguments | Bites | Every event versus once per pool is data (`COUNTED`, by kind), not a boolean argument to `tallies` |
| Comments: WHY only | Bites | One line on why `MIN(at)` places a pair (toggling can't inflate a board); none on what the SQL does |
| Objects and data structures | Bites | Queries return plain `Tally` values, never rows (the `pool-store.ts:1` idiom) |
| Never return or pass null | Bites | A missing name falls back to the id; no `undefined` row reaches the text |
| Boundaries: wrap third-party | Bites | `Temporal` and `Intl.DateTimeFormat` stay inside `src/kyiv-time.ts`, which names the zone once (:3) |
| Tests: F.I.R.S.T. | Bites | Fixed instants and seeded events; no `Date.now()` in the stats tests |
| Classes | Inert | No classes |
| Simple design | Bites | No board engine or generic leaderboard: five boards, written out in design order |

## Clean Architecture against the stats

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Dependency Rule | Bites | `stats-format.ts` imports `texts`, `escapeHtml` and `compareNames` only: no grammY, no `SqlStorage`, as `pool-format.ts` |
| Crossing boundaries with plain data | Bites | The format takes tallies by kind, the joins' total, a names map and the month's name |
| Humble Object | Bites | `stats-handlers.ts` is about eight lines: stale check, one read, one reply, as `/pools` (`pool-handlers.ts:63-73`) |
| Component cohesion | Bites | Queries, format and handler sit in `src/stats` beside `event-store.ts`, the feature-folder idiom |
| Acyclic dependencies | Bites | `members/all-handlers.ts` already imports `stats/event-store.ts`, and `stats-queries.ts` will import `members/member-store.ts`. Folder to folder that is mutual; file to file it stays acyclic. Never import a `stats-*` module from `members/` |
| Stable dependencies, stable abstractions | Inert | Too small to matter |
| Screaming architecture | Bites | `src/stats/` names the feature |

## SOLID against the stats

| Rule | Verdict | Concrete consequence |
|---|---|---|
| SRP, by actor | Bites | Taras's copy changes `texts.ts`; what counts changes `COUNTED` in `stats-queries.ts`; order and places change `stats-format.ts`; the Kyiv calendar changes `kyiv-time.ts` |
| OCP | Bites | The next variant is a new board, such as "хто найчастіше передумує" (ledger). `COUNTED` is a `Record<EventKind, …>`, so a new kind can't compile without its rule |
| LSP | Inert | No subtypes |
| ISP | Bites | Queries take `SqlStorage` only; the handler uses `ctx.room.read`, `clock` and `stale`, nothing else of the room |
| DIP | Bites | Nothing above the queries names SQL; the queries are the detail |

## DDD against the stats

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Ubiquitous language | Bites | A board, a tally, the month window; the kinds are the record's words |
| Entity versus value object | Inert | `Tally` and `MonthWindow` are values |
| Which layer owns each invariant | Bites | "Once per pool and person, placed by the first" is the queries' (ledger `decision-events-append-only.md`). Zero rows left out, order and places are the format's. The Kyiv month is `kyiv-time.ts`' |
| Aggregates, repositories | Bites | `recordEvent` stays the one writer; the stats only read |
| Domain events | Bites | `events` is history: no query writes, and no rule moves into the schema |
| Side-effect-free functions | Bites | The window, the month's name and the format are pure |
| Specification, factories, ACL | Inert | None needed |

## Guard blindness

- The DST tests: finding 2.
- "Zero rows left out": no SQL row is zero in both, since a person appears only through an
  event. Only a format test with an explicit zero row can see the rule.
- The once-per-pool rule: only a toggle (`join`, `pass`, `join` in one pool) or a re-join in a
  later month can tell `MIN(at)` per pair from counting events. Seed both.

## Seam and testability (deltas from the recon)

- `member-store.ts` has no test file. `knownMembers` is covered by the handler's test: a leaver
  keeps a name, and shared first names are told apart.
- Nothing nears the 250-line cap.

## Amendments

1. `src/kyiv-time.ts`:
   - `MonthWindow { start, end }`, `[start, end)`;
   - `monthWindow(ms)`, from the first of the Kyiv month at its start of day to the next;
   - `monthName(ms)` through one `Intl.DateTimeFormat('uk', { month: 'long', timeZone })`;
   - a private `startOfDay(date)` shared with `nextMidnight`.
2. `src/stats/stats-queries.ts`:
   - `Counts { month, allTime }` and `Tally extends Counts { userId }`;
   - `COUNTED: Record<EventKind, string>`, each kind's counted subquery: every event, or each pool
     and person's first;
   - `tallies(sql, kind, month)` and `totalJoins(sql, month)` over the same subquery, so the rule
     is written once;
   - `readStats(sql, month)` gathers the five kinds' tallies, the total and the names.
3. `src/members/member-store.ts`: `knownMembers(sql)`, every member, leavers included.
4. `src/stats/stats-format.ts`, `statsText(stats, monthName)`:
   - the header, then the boards in design order, a blank line between them;
   - each board: rows named (else the id) and escaped, zero rows out, sorted (month, all time,
     `compareNames`), places shared on equal counts, or `— поки порожньо`;
   - the Граю title carries the joins' total.
5. `src/stats/stats-handlers.ts`: a `showStats` Composer, ignored when stale, replying to the
   command through `replyingTo`, not wrapped in `attempt`. Nothing has committed, so the failure
   policy decides. Registered in `FEATURES` after `countDomikpisik`.
6. `src/texts.ts`: `texts.stats`, the header, the five titles, a row and the empty line.
7. Tests:
   - `test/kyiv-time.test.ts`: winter; summer; October 2027 after its change; March 2030 before
     its change; the first Kyiv hour of April 2030; the start belongs to its month and the end
     to the next; the month's name at a Kyiv month's first hour;
   - `test/stats/stats-queries.test.ts`: every event versus once per pool; a toggle; a re-join in
     a later month; the window's edges; the total as distinct pairs;
   - `test/stats/stats-format.test.ts`: the design's mockup word for word; sort; ties; zero rows;
     empty boards; escaping;
   - `test/stats/stats-handlers.test.ts`: the reply, with a leaver's name; stale ignored.
8. The phase file: finding 1's two lines.

## Defaults applied

- "This month" is the Kyiv month at the room's clock, as `/pools` labels by it.
- Equal month and all-time counts share a place (1, 1, 3).
- Names are told apart among every member the bot knows, leavers included.
- The Граю title keeps `· разом 0 / 0` on an empty board: one shape for the title.
- `/stats` counts nothing and is ignored when it arrives over 10 minutes late.
- A tally whose person isn't in `members` shows the id, as the card does. It can't happen: every
  event's person is learned in the same update.

## Forks for you

None.
