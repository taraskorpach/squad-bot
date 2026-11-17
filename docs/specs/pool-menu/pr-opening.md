# PR Opening — Pool Menu

## Spec state

2 code phases planned, one PR from `feat/pool-menu`: phase 1 makes pools without a limit
possible, phase 2 adds the menu that opens them. Merging deploys the bot (main's `deploy`
workflow).

## Pre-PR checks

Scoped to the one Worker. Tick each before opening the PR, never straight to `main`.

- [x] `npm run check` passes: Biome, `tsc --noEmit` for `src`, `test` and `scripts`, `wrangler types --check`
- [x] `npm test` passes inside workerd (479)
- [x] `npx wrangler deploy --dry-run` bundles without errors (68 KiB gzipped)
- [x] Bot texts match `design.md` → *Screens and copy*, word for word
- [x] Tried in Pisikcs Test with `wrangler dev --tunnel` on a fresh start: `/pool` alone through every step, back and cancel, a tap from the second account, a pool without a limit, a 🕓 Інший час pool. One bot: the friends' chat loses it while the tunnel holds the webhook, so point it back with `npm run telegram:configure -- --env .prod.vars webhook https://squad-bot.taraskorpach03.workers.dev` right after — 2026-11-17 15:37–15:50, Taras: «норм виглядає»; three pools opened from the menu, one without a limit, no failed update
