---
kind: gotcha
paths: [test/**, src/chat/chat-room.ts, src/chat/room.ts, src/pools/**]
created: 2026-11-17T10:02:40+02:00
seen-in: [mvp]
---

# A Durable Object alarm set in the past is moved to now: test clocks must be in the future

`storage.setAlarm(t)` with `t` before the real time stores the real time, and `getAlarm()` returns that, not `t`. The alarm is then due at once. A test whose `clock` seam sits in the past, such as a fixed date that has gone by, can't assert the alarm's time, and the alarm can fire in the middle of the test. Put the clock of any test that opens a pool, or arms the alarm in another way, safely in the future. The pool tests use 16.11.2030, which is UTC+2 in Kyiv. Drive the alarm with `runDurableObjectAlarm(stub)`; Vitest's fake timers never move it.

Evidence:
- mvp phase 8: with a 2026-11-16 clock, the arming tests read the real time back from `getAlarm()` (`1794902473242` for an alarm set to `1794855600000`).
- With 2030 dates, the same tests read back the set time.
