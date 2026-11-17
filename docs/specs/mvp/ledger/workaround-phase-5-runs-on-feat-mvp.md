---
kind: workaround
applies-to: [phase 5]
created: 2026-11-17T12:45:10+02:00
---

# Phase 5 runs on feat/mvp, after it takes in PR A

Spec docs live on branches in this project (no `docs: main`), so each phase's ticks sit on the
branch that did the work: the task phases' on `feat/mvp`, the code phases' on `feat/mvp-pr-a`,
`-b` and `-c`. Phase 5 needs 1 and 4, and on 2026-11-17 no branch held both, so the board showed
phase 5 blocked and nothing ready.

The fix: `feat/mvp` was merged into `feat/mvp-pr-a`, so PR A now carries phase 1's docs to main.
Then `feat/mvp` fast-forwarded to PR A. Phase 5 runs in the `mvp` tree, which `trees place` picks
for a phase with no `pr:`. That tree also holds the setup script and the runbook phase 5 uses.

After PR A merges, phase 5's later ticks reach main only with `feat/mvp`: merge it into the next
PR's branch, or land it in a small docs PR.
