---
pr:
  merge: merge
---

# Project settings

Loop rules for the spec-driven plugin. Keys left out keep its defaults: spec docs on the branch,
PRs opened as drafts.

- `pr.merge: merge`: PRs merge with a merge commit, so a stacked PR's commits land unchanged on
  the branch below it (Taras, 2026-11-17, at PR #3).
