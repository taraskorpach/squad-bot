# In-flight state

**Session ended:** 2026-11-17
**Active phase:** 8 — Pool timers

## Where things stand

- Every deliverable is built and tested, in workerd with `runDurableObjectAlarm`.
- PR B (phases 6–8) is complete on `feat/mvp-pr-b`. It is stacked on `feat/mvp-pr-a`, because
  PR A merges only in phase 5.

## Still to do once PR B is live

- **Do alarms survive a deploy?** Wave 2 left this to a real run. Open a pool with a start time a
  few minutes ahead, redeploy (run the `deploy` workflow), and confirm the ⏰ ping still comes at
  the start. Record the result in the project ledger.
- **Run PR B's timer pre-PR check on a freshly started `wrangler dev`.** Alarms can stop after a
  hot reload (wave 2 §4).

## Implicit context

- A failing timer action is tried 4 times: at once, then after 1, 2 and 4 minutes. That follows
  the phase file. technical.md once said "after 3 attempts", and the phase 8 session reworded it.
