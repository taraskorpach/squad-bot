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
PR #3 merged 2026-11-17 as a77ae62 (merge).

## Pre-PR checks

Scoped to the one Worker this spec builds. Tick each before opening the PR, never straight to `main`.

- [ ] `npm run check` passes: Biome, `tsc --noEmit` for `src`, `test` and `scripts`, `wrangler types --check`
- [ ] `npm test` passes inside workerd
- [ ] `npx wrangler deploy --dry-run` bundles without errors
- [ ] Bot texts match `design.md` → *Screens and copy*, word for word
- [ ] PR A: `/all`, `/domikpisik` and the 👋 welcome tried with the dev bot in the test group (`wrangler dev --tunnel`)
- [ ] PR B: one pool run end to end with the dev bot on a freshly started `wrangler dev` (alarms can stop after a hot reload): open with a time two minutes ahead, answer from two accounts, bench, 🎲, the start ping, ✖️
- [ ] PR C: `/stats` tried with the dev bot after a few `/all` calls and a pool
