---
kind: gotcha
paths: [.github/workflows/**]
created: 2026-11-17T18:06:13+02:00
seen-in: [reels-stats]
---

# Every push to a feature branch runs the checks in CI, with or without a PR

`.github/workflows/check.yml` runs on `push` to every branch but main (`branches-ignore: [main]`)
as well as on pull requests, so pushing after each commit costs one CI run per commit, even before
a PR exists. Push at a phase's end or at a handoff instead.

Why it bites: the spec workflow assumes that a branch with no PR, or a draft one, costs no CI, and
pushes after every commit (execute.md §1, "Decide when to push").
