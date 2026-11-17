# PR Opening — Pool Maybe

## Spec state

1 code phase, one PR from `feat/pool-maybe`. Merging deploys the bot, and the first update after
the deploy runs migration 5 on the live object.

## Pre-PR checks

Scoped to the one Worker. Tick each before opening the PR, never straight to `main`.

- [ ] `npm run check` passes
- [ ] `npm test` passes inside workerd, migration 5 on old data included
- [ ] `npx wrangler deploy --dry-run` bundles without errors
- [ ] Bot texts match `design.md`, word for word
