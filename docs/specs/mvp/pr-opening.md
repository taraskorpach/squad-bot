# PR Opening — Squad Bot MVP

## Spec state

7 code phases and 2 task phases planned. Suggested PR split:
- PR A — phases 2, 3, 4: skeleton, members and `/all`, setup script and deploy. Merging it
  deploys the bot, and that deploy fails while a production secret is missing
  (`secrets.required`). So PR A merges inside phase 5, after its secrets step, and phase 5 then
  takes the bot live in the chat.
- PR B — phases 6, 7, 8: pools.
- PR C — phase 9: stats.

Every merge to `main` deploys through GitHub Actions. PRs need the GitHub repo from phase 1.

The PRs are stacked, because each needs the one before it: B branches from A, and C from B.
Once a PR merges, the next is retargeted to `main`.

PR #1 · feat/mvp-pr-a
PR #2 · feat/mvp-pr-b (base feat/mvp-pr-a)
PR #3 · feat/mvp-pr-c (base feat/mvp-pr-b)

`spec.ts pr open` always targets `main`, so a stacked PR is opened by hand with
`gh pr create --base <the branch below>`; babysit's `pr open` then finds it. Taras chose to
babysit #3: merged on green, it adds the stats to `feat/mvp-pr-b`, and #2 carries both to `main`.

## Pre-PR checks

Scoped to the one Worker this spec builds. Tick each before opening the PR, never straight to `main`.

- [ ] `npm run check` passes: Biome, `tsc --noEmit` for `src`, `test` and `scripts`, `wrangler types --check`
- [ ] `npm test` passes inside workerd
- [ ] `npx wrangler deploy --dry-run` bundles without errors
- [ ] Bot texts match `design.md` → *Screens and copy*, word for word
- [ ] PR A: `/all`, `/domikpisik` and the 👋 welcome tried with the dev bot in the test group (`wrangler dev --tunnel`)
- [ ] PR B: one pool run end to end with the dev bot on a freshly started `wrangler dev` (alarms can stop after a hot reload): open with a time two minutes ahead, answer from two accounts, bench, 🎲, the start ping, ✖️
- [ ] PR C: `/stats` tried with the dev bot after a few `/all` calls and a pool
