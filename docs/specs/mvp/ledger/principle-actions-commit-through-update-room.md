---
kind: principle
applies-to: [phase 6, 7, 8]
created: 2026-11-16T22:38:45+02:00
---

# A handler's pool actions commit through `ctx.room`, so the update is recorded with the change

Pool actions are written against `Room` so the alarm can run them without a grammY context
(`technical.md` → *Pool actions*). But `Room.tx` records nothing about the update. An action
called from a handler that commits through the plain `Room` leaves `ctx.room.committed` false and
the update missing from `processed_updates` until the task ends. A failure after that commit, before
any Telegram call succeeds, then still answers 500, because the failure policy believes nothing
committed, and the redelivery runs the action a second time.

**Rule:** from a handler, pass actions a room whose `tx` is the update's `commit`; from the alarm,
pass the plain `Room`. The simplest shape: `UpdateRoom` (`src/context.ts`) gets `tx`, `chatId`,
`api` and `random` beside its `write` and `clock`, and actions take the interface both classes
satisfy. Phase 2 shipped `Room` and `UpdateRoom` without that shared interface because nothing
called an action yet.

Why it matters: `committed` is one of the two facts the failure policy reads
(`decision-failure-policy.md`); a wrong `false` turns a safe acknowledgement into a duplicate.
