---
needs: [6, 7]
pr: B
---

# Phase 8 — Pool timers

**Goal:** A pool with a start time tags its players at that time, and every pool closes by itself three hours after its start (or after it opened), driven by the object's alarm.

**Outcome:** Nobody has to remind the squad or clean up old pools. Free. Medium risk: alarms fire at least once and can be up to a minute late, so every timer action is idempotent, a failed action retries three times, and the alarm is re-armed with every change.

**Files to touch:**
- `src/chat/schema.ts` (migration 4), `src/chat/chat-room.ts` (`alarm()`, arming)
- `src/pools/pool-timers.ts`, `src/pools/pool-actions.ts`, `src/pools/pool-store.ts`, `src/bot.ts` (timer wiring)
- `src/texts.ts`
- `test/pools/pool-timers.test.ts`, `test/chat/chat-room.test.ts`

## Implementation guidance

Follow `technical.md` → *Timers*.
- **The pools table is the schedule.** A Durable Object has a single alarm slot (wave 2 §4). It
  always points at the earliest due moment among the open pools:
  - a missing card;
  - an unpinged start;
  - a close;
  - a retry;
  - the Kyiv midnight that changes a card's day label.

  There is no `jobs` table, so a closed pool can't fire and nothing needs cancelling.
- **Arm with the commit.**
  - Compute the next due time with synchronous SQL, and call `setAlarm` without awaiting in the
    same block as each commit that changes timing, so both commit together.
  - At the end of every queued task, compare with `getAlarm()` and set it when it differs.
- **Failed actions retry, then stop.**
  - An action whose commit or Telegram call fails is retried after 1, 2 and 4 minutes
    (`timer_attempts`, `timer_retry_at`), then given up. A success clears both.
  - Without this, a failing action points the alarm at the past and it fires in a loop, burning
    the free plan's daily requests and rows in minutes.
- **`alarm()` never stops silently.** After an unexpected error, log it and
  `setAlarm(clock() + 60 s)` without re-arming to a past time. After six failed retries,
  Cloudflare stops retrying until the next `setAlarm` (wave 2 §4).
- **Flags** (`start_pinged`, `status`) commit before any Telegram call, so an alarm firing twice
  pings once.
- **`src/bot.ts` wires the timers.** `chat-room.ts` calls the planner and the actions through it
  and imports no feature.
- **Closing** calls phase 7's `closePool(room, id, 'auto')`.
- **Tests** backdate a pool's `starts_at` or `closes_at`, arm, and call `runDurableObjectAlarm`.
  Vitest fake timers never move alarms (craft).

## Deliverables

- [ ] Migration 4: `start_pinged`, `timer_attempts` and `timer_retry_at` added to `pools`
- [ ] Timer planner (pure): the next due time over the open pools among missing cards, unpinged starts, closes, retries and the Kyiv midnight that changes a day label
- [ ] Alarm arming: set in the same synchronous block as each commit that changes timing, and compared with `getAlarm()` at the end of every queued task
- [ ] `alarm()`: due actions run in the serial queue, each failure retried after 1, 2 and 4 minutes, then given up; after an unexpected error the alarm is set 60 s ahead
- [ ] Start ping: the players (not the bench) tagged once at the start time, with the fill when the squad isn't complete; none when nobody plays; skipped when more than 15 minutes late
- [ ] Auto-close: through `closePool`; the card turns final, with no ping
- [ ] Missing cards and midnight: a pool whose card never got out is posted with its tag message; open cards with a day label re-render at Kyiv midnight

## Phase-local notes

- No per-minute cron as a safety net. The end-of-task check already restores a lost alarm, and a
  sweep would wake the object 1,440 times a day (`technical.md` → *Timers*).
- Run PR B's timer check on a freshly started `wrangler dev`: alarms can stop after a hot reload
  (wave 2 §4).
- After PR B deploys, open a pool with a start time, redeploy before that time, and confirm the
  ping still comes: wave 2 left "alarms survive a deploy" to a run. Record the result in the ledger.
