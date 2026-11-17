# PR Opening — Pool Maybe

## Spec state

1 code phase, one PR from `feat/pool-maybe`. Merging deploys the bot, and the first update after
the deploy runs migration 5 on the live object.
PR #7 merged 2026-11-17 as e9764a2 (merge).

## Pre-PR checks

Scoped to the one Worker. Tick each before opening the PR, never straight to `main`.

- [x] `npm run check` passes
- [x] `npm test` passes inside workerd, migration 5 on old data included (488)
- [x] `npx wrangler deploy --dry-run` bundles without errors (68 KiB gzipped)
- [x] Bot texts match `design.md`, word for word
