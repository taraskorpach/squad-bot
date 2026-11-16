---
needs: [6]
same-files-as: [7]
pr: B
---

# Phase 8 — Pool timers

**Goal:** A pool with a start time tags its players at that time, and every pool closes by itself three hours after its start (or after it opened), driven by the object's alarm.

**Outcome:** Nobody has to remind the squad or clean up old pools. Free. Medium risk: alarms fire at least once and can be up to a minute late, so every job is idempotent and the alarm is re-armed after every change.

**Files to touch:**
- `src/chat/schema.ts` (migration 4), `src/chat/jobs.ts`, `src/chat/chat-room.ts` (`alarm()`, `arm()`)
- `src/pools/pool-timers.ts`, `src/pools/pool-handlers.ts`, `src/pools/pool-store.ts`
- `src/texts.ts`
- `test/chat/jobs.test.ts`, `test/pools/pool-timers.test.ts`

## Implementation guidance

Follow `technical.md` → *Timers*.
- **One alarm, many jobs.** A Durable Object has a single alarm slot (wave 2 §4); the `jobs` table
  is the source of truth, and the alarm always points at its earliest pending job.
- **Re-arm everywhere:** after any commit that touched jobs, and at the end of every update (a cheap
  `getAlarm` comparison). An alarm lost for any reason comes back with the next update.
- **`alarm()` never stops silently.** Catch every failure, log it, and `setAlarm(clock() + 60 s)`:
  after six failed retries Cloudflare stops retrying until the next `setAlarm` (wave 2 §4).
- **Done marks** commit with the job's state change, before any Telegram call, so an alarm firing
  twice pings once.
- **Closing** reuses phase 7's `closePool`, which now also marks the pool's pending jobs done.
- **Tests** backdate a job's `due_at`, arm, and call `runDurableObjectAlarm`; Vitest fake timers
  never move alarms (craft).

## Deliverables

- [ ] Migration 4: `jobs` table
- [ ] Job planner (pure): a pool's start ping (when timed) and close jobs; the next alarm is the earliest pending job
- [ ] Alarm wiring: jobs written with their pool, the alarm re-armed after each change and checked on each update, `alarm()` running due jobs in the serial queue and re-arming after any failure
- [ ] Start ping: the players (not the bench) tagged once at the start time, with the fill when the squad isn't complete
- [ ] Auto-close: the card turns final with no ping, and any close marks the pool's pending jobs done

## Phase-local notes

- No per-minute cron as a safety net: a woken object stays resident, and a full day resident costs
  about 10,800 of the free 13,000 GB-s (`technical.md` → *Timers*).
- After PR B deploys, open a pool with a start time, redeploy before that time, and confirm the
  ping still comes: wave 2 left "alarms survive a deploy" to a run. Record the result in the ledger.
