---
kind: principle
paths: [src/kyiv-time.ts, test/kyiv-time.test.ts]
created: 2026-11-17T10:23:39+02:00
seen-in: [mvp]
---

# Test a Kyiv window with `now` and the boundary on opposite sides of a DST change

A window built from the UTC offset at `now` is right whenever `now` and the boundary share an
offset, so only a test that puts them across a change sees the bug: October 2027 read after its
31.10 change (the start, 30.09 21:00Z, is still summer time), March 2030 read before its 31.03
change (the end, 31.03 21:00Z, is already summer time). Add the first Kyiv hour of a month, when
UTC still says the previous month.

"A month that starts the day after a DST change" sounds like the hard case and isn't. November
2027 starts the day after the 31.10 change; with `now` in November, `1.11 00:00 − 2 h` gives
31.10 22:00Z, the right answer, because both instants are past the change. The phase 9 preflight
of mvp found the phase's own test wording blind to the bug it was written for
(`docs/specs/mvp/research/phase-9/2026-11-17-stats-preflight.md`, finding 2). Last Sundays that
fall on the 31st make these cases: summer time starts 31.03.2030, and ends 31.10.2027.
