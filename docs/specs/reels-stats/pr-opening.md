# PR Opening — Reels Stats

## Spec state

2 code phases planned, one PR from `feat/reels-stats`: phase 1 counts reels and adds the board,
and phase 2 makes the bot answer them. Merging deploys the bot (main's `deploy` workflow), and the
first update after the deploy runs migration 6 on the live object.

## Pre-PR checks

Scoped to the one Worker. Tick each before opening the PR, never straight to `main`.

- [ ] `npm run check` passes: Biome, `tsc --noEmit` for `src`, `test` and `scripts`, `wrangler types --check`
- [ ] `npm test` passes inside workerd, migration 6 on old events included
- [ ] `npx wrangler deploy --dry-run` bundles without errors
- [ ] Bot texts match `design.md` → *Screens and copy*, word for word
- [ ] Tried in the test group with `wrangler dev --tunnel` on a fresh start: a reel shared from Instagram's app, the same reel from the second account (the баян, and its link opening the first message), a reel in a photo's caption, then `/stats`. One bot: point the webhook back at the Worker right after (README → *Local development*, step 5)
