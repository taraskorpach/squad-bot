---
date: 2026-11-17
phase: 8
chunk: the whole phase (deliverables 1–7)
inputs: [phases/phase-8-pool-timers.md, technical.md, ledger/decision-timers-from-pools.md, research/phase-7/2026-11-17-pool-buttons-preflight.md, principles.md]
---

# Phase 8 recon and preflight — pool timers

*Source of record — do not edit.*

## The seam

- **`ChatRoom`** (`src/chat/chat-room.ts`):
  - It has no `alarm()`. Updates run through `#queue.run` and `#process`.
  - `#ensureRuntime` builds `Room` with `storage`, `chatId`, `mentionChunk`, `api`, `clock` and `random`.
  - `chat/` imports `createBot` and `FEATURES` from `src/bot.ts` and no feature module.
- **`Room`** (`src/chat/room.ts`) holds the storage. It is the one place that can call
  `setAlarm`, which is a storage write.
- **The phase 6 and 7 actions:**
  - `postCard(room, poolId, replyTo?)` resolves to nothing and swallows a failed send through `attempt`.
  - `closePool(room, poolId, by)` commits only an open pool, then shows it.
  - `refreshCard` edits only a changed render.
- **`cloudflare:test`'s `runDurableObjectAlarm(stub)`** runs a scheduled alarm at once
  (`types/cloudflare-test.d.ts:31-37`). Time is the object's `clock` seam, so tests backdate
  nothing. They set the clock past `starts_at` or `closes_at` instead.

## Findings that change the plan

1. **The alarm can't be pointed from `chat/` without the planner.** `Room` gets the planner as
   an option, `nextDue: (sql, now) => number | undefined`. `src/bot.ts` exports it with the
   alarm's runner as `TIMERS`, so `chat/` still imports no feature. `ChatRoom.timers` is a
   seam beside `features`, so a test can make the alarm fail.
2. **"Arm in the same block as the commit" needs a call an action can make.** `RoomAccess`
   gains `arm()`. It reads `nextDue` synchronously and calls `setAlarm` or `deleteAlarm` without
   awaiting, in the same turn as the commit before it. `openPool` and `commitClose` call it.
   At the end of every queued task, `ChatRoom` compares `getAlarm()` and sets it when they
   differ. That step restores a lost alarm too.
3. **`postCard` must say whether the card went out.** A missing card is a timer action whose
   failure is retried, so `postCard` returns `true` once the card is posted.
4. **One retry state per pool can loop on a given-up card.**
   - `timer_attempts` and `timer_retry_at` belong to the pool, not to one action.
   - A missing card stays due only while `timer_attempts < 3`. Giving up then holds.
   - Giving up a start ping marks it done, and giving up a close closes the pool with a
     minimal update. Neither can come back.
5. **"The midnight that changes a day label" has an exact test.** It is the next Kyiv midnight
   for an open card whose `startLabel` at that midnight differs from its label now. Most of the
   time that is today's or tomorrow's start. At the alarm, refreshing every open card is enough,
   since an unchanged render is never edited.

## Rules that bite

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Pure core | Bites | `nextDue(pools, now)` and `dueActions(pool, now)` are pure, in `pool-timers.ts`. The runner applies them |
| Idempotent actions | Bites | `start_pinged` commits before the ping, and `status` before the close's render. An alarm firing twice pings once |
| Bounded failure | Bites | A failed action waits 1, 2, then 4 minutes, and is given up after the third failure. An unexpected error in `alarm()` sets the alarm 60 s ahead and skips the end-of-task arming |
| Dependency rule | Bites | `chat-room.ts` knows `TIMERS` only as `{ nextDue, run }` from `bot.ts` |

## Amendments

1. Migration 4, and the `Pool` record gains `startPinged`, `timerAttempts` and `timerRetryAt`.
2. `nextMidnight(ms)` in `kyiv-time.ts`.
3. `RoomAccess.arm()`, and `Room` takes `nextDue`. `ChatRoom` gets `alarm()`, the end-of-task
   check and the `timers` seam.
4. `pool-timers.ts`:
   - the pure part, `nextDue` and `dueActions`;
   - `runDueTimers(room)`: post the missing cards, ping the starts, close, and refresh every open card.
5. `postCard` returns whether the card went out.

## Defaults applied

- A missing card is due at once, so `openPool`'s arming wakes the object right after the card's send
  if that send fails or the object dies mid-send. If the card did go out, the alarm finds nothing
  due and re-arms. The cost is one wake-up per `/pool`.
- The start ping is one message (ledger: `decision-announcements-in-one-message.md`), a reply to
  the card when there is one.
- A start ping more than 15 minutes late, or with nobody playing, is marked done without a message.

## Forks for you

None.
