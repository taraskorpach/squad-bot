---
date: 2026-11-17
phase: 9
chunk: stats windows, leaderboard queries, format and /stats (deliverables 1–4)
inputs: [phases/phase-9-stats.md, technical.md, design.md, ledger/decision-events-append-only.md, ledger/decision-event-time-is-when-the-person-acted.md]
---

# Phase 9 recon — stats

*Source of record — do not edit.*

A direct read of every module the stats build on. The seam is six small files and the test
harness, so there was no agent wave. Two runtime facts were probed in workerd with a throwaway
test.

## The seam

- **Tree.** `feat/mvp-pr-c` was cut from `feat/mvp-pr-b` at `02aaac4` and fast-forwarded to
  `origin/feat/mvp-pr-b` (`f912359`, two spec commits). `pr-opening.md` says the PRs are stacked:
  "C from B". So pool events exist by the time PR C is live; the phase note about empty pool
  boards no longer holds.
- **Kyiv time** (`src/kyiv-time.ts`).
  - The zone is named once (:3); `inKyiv(ms)` (:56-58) reads an instant on the Kyiv calendar.
  - `nextMidnight` (:35-37) already takes a day's start with `PlainDate.toZonedDateTime(KYIV)`,
    which is the zone's start of day. `monthWindow` is the same move on the first of the month.
  - Nothing names a month yet.
- **The record** (`src/stats/event-store.ts`).
  - `EventKind` (:5) already holds all five kinds; `recordEvent` (:17-25) is the one writer.
  - Writers:
    - `/all`: `src/members/all-handlers.ts:18`, every call, stale ones too.
    - `/domikpisik`: `src/stats/domikpisik-handlers.ts:13`.
    - `openPool`: `src/pools/pool-actions.ts:50-51` writes `pool_open` and the author's `join`,
      both at the message's date.
    - `applyAnswer`: `src/pools/pool-actions.ts:75-78` writes `join` or `pass` only when the
      answer changed something. A toggle ✅ → ❌ → ✅ leaves `join`, `pass`, `join` for one pool
      and person.
- **Names** (`src/members`).
  - `membersById` (`member-store.ts:42-51`) reads members whether or not they are in the chat.
  - `displayNames` (`mentions.ts:13-22`) tells shared first names apart among the members it is
    given; `escapeHtml` (:5-7).
  - `cardState` (`src/pools/pool-card.ts:25-42`) tells names apart among the chat's members plus
    the card's leavers.
- **A command that only reads** is `/pools` (`src/pools/pool-handlers.ts:63-73`):
  - stale → return;
  - `ctx.room.read` → a pure text function;
  - `ctx.reply(text, replyingTo(id))`, not wrapped in `attempt`. Nothing has committed, so a
    failed reply is the failure policy's to judge.
- **The bot** (`src/bot.ts:18-24`): `FEATURES` lists the composers; `/stats` is a new entry. The
  command menu already has `stats: 'Статистика'` (`src/texts.ts:26`).
- **Texts** (`src/texts.ts`): every Ukrainian string in one `as const` object, functions for
  values; `compareNames` (:115-117) on `Intl.Collator('uk')`.

## Reuse

- `membersById`, `displayNames`, `escapeHtml`, `compareNames`, `replyingTo`.
- `inKyiv` and the start-of-day move from `nextMidnight`.
- `/pools`' handler shape for `/stats`.
- The test harness: `roomWith`, `rows`, `freshRoom` + `runInDurableObject` + `recordEvent` for
  seeding (`test/stats/event-store.test.ts`), `textMessage` to make members known,
  `memberChange(user, { from: 'member', to: 'left' })` for a leaver, `telegram.callsTo`.

## Testing-issue estimate

- **Month windows are pure** and native `Temporal` runs in the tests. DST cases with fixed instants:
  - winter: November 2026 is `[31.10 22:00Z, 30.11 22:00Z)`;
  - summer: July 2026 is `[30.06 21:00Z, 31.07 21:00Z)`;
  - months that hold a change: March 2026 (29.03) and October 2026 (25.10) are an hour shorter
    and an hour longer;
  - months that start the day after a change: in 2030 summer time starts on Sunday 31.03, so
    April 2030 starts at `31.03 21:00Z`; in 2027 it ends on Sunday 31.10, so November 2027 starts
    at `31.10 22:00Z`. A window built from the offset at `now` gets these wrong by an hour;
  - the first Kyiv hour of a month, while UTC is still in the last one.
- **The month's name.** Probed in workerd: `Intl.DateTimeFormat('uk', { month: 'long', timeZone })`
  gives all twelve nominatives, січень … грудень, and `31.10.2027 22:30Z` is already листопад.
- **SQL.** Probed in the object's SQLite:
  - `COUNT(*) FILTER (WHERE at >= ? AND at < ?)` works;
  - a `WITH` subquery binds its `?` in text order;
  - `MIN(at)` grouped by pool and person places a re-join by its first event.
  - `sqlite_version()` is not authorized there, which nothing needs.
- **Queries** run in workerd on a `freshRoom()` through `runInDurableObject`, seeded with
  `recordEvent`, as `event-store.test.ts` does. No pools, so no alarm fires mid-test.
- **The handler** runs through `roomWith([stats feature])`, with members learned from a message
  each.
- **Size.** `texts.ts` 123 lines, `kyiv-time.ts` 62, `bot.ts` 104, `test/kyiv-time.test.ts` 78:
  the stats add tens of lines to each, far from 250.
- **No smells on the path.** The one judgement call is whose names a board tells apart: the
  people on the boards, or the chat plus them, as `cardState` does.
