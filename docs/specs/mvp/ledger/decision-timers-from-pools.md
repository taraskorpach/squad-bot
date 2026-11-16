---
kind: decision
applies-to: [phase 6, 7, 8]
created: 2026-11-16T18:40:58+02:00
---

# The pools table is the timer schedule; there is no jobs table

The object's single alarm points at the earliest due moment among the open pools:
- a missing card;
- an unpinged `starts_at`;
- `closes_at`;
- a retry (`timer_retry_at`);
- the Kyiv midnight that changes a card's day label.

Migration 4 adds `start_pinged`, `timer_attempts` and `timer_retry_at` to `pools`.

- **Why:** the planned `jobs` table held two kinds, each a copy of a pool column. Every close path had to cancel them, and a closed pool could still fire if one forgot. Reading `pools` instead makes that impossible by construction (principal-engineer, prior-art).
- **Rejected:** a generic jobs registry (code-quality). It solved the layering but kept the duplicate state. Wiring the timers through `src/bot.ts` keeps `chat/` free of pool imports instead.
- **Failures:** each action retries after 1, 2 and 4 minutes, then gives up. Without that, a failing action points the alarm at the past and loops, burning the free plan's daily requests and rows (adversarial-tester).
- **Arming:** `setAlarm` without awaiting, in the same synchronous block as the commit that changed timing, and checked at the end of every queued task.
- **Later:** when a timed feature arrives that isn't about a pool, add a timer source next to the pool planner rather than a table.
- **Source:** `reviews/2026-11-16-failure-paths-and-go-live.md` (R7, R8).
