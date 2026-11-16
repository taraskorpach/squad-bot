---
kind: gotcha
paths: [.github/workflows/**]
created: 2026-11-17T00:08:57+02:00
seen-in: [mvp]
---

# Run `npm ci` before `cloudflare/wrangler-action`, or it deploys with the latest wrangler

Without a `wranglerVersion` input, wrangler-action v4 deploys with the wrangler already in `node_modules`, the locked one. With none installed, it installs `wrangler@4` instead, which is the latest. Install the project first, and leave `wranglerVersion` out, so `package.json` stays the one place the version is chosen. The deploy then uses the wrangler that `npm run check` ran against: its `wrangler types --check` and its `secrets.required` support (≥ 4.77) are the ones CI saw.

Evidence:
- cloudflare/wrangler-action v4.1.3 `src/wranglerAction.ts:105-145`: `installWrangler` returns the pre-installed version when the user gave none, and otherwise installs `wrangler@${WRANGLER_VERSION}`, defaulting to `"4"` (`src/index.ts:8`).
- mvp phase 4's `.github/workflows/deploy.yml`.
