---
kind: gotcha
paths: [wrangler.jsonc, .github/workflows/deploy.yml]
created: 2026-11-16T18:40:58+02:00
seen-in: [mvp]
---

# `secrets.required` fails `wrangler deploy` until every listed secret exists on the Worker

With `"secrets": { "required": [...] }` in `wrangler.jsonc`, `wrangler deploy` (and `versions upload`) fails with an error that names the missing secrets (wrangler ≥ 4.77.0). Set every listed secret with `wrangler secret put` before the first deploy, including the one a merge to `main` triggers in CI. `wrangler dev` only warns.

Evidence: developers.cloudflare.com/changelog/post/2026-03-24-secrets-config-property/ and developers.cloudflare.com/workers/configuration/secrets/. The mvp plan first had its go-live phase wait for PR A's deploy before setting the secrets, which deadlocks. The fix was to set the secrets first, then merge.
