---
date: 2026-11-16
phase: 4
chunk: deploy and README (deliverables 6–7)
inputs: [phases/phase-4-setup-and-deploy.md, research/phase-4/2026-11-16-setup-script-recon.md]
---

# Phase 4 recon — deploy and README

*Source of record — do not edit.*

The chunk-1 recon's last section already holds most of this seam. Here are only the checks it
left open.

## The seam

- **`.github/workflows/check.yml`** runs on `push` and `pull_request`:
  - `checkout@v7`, then `setup-node@v7` from `.nvmrc` with the npm cache;
  - `npm ci`, `npm run check`, `npm test`.

  It has no `workflow_call`, so it can't be reused as it stands. It is green on this branch.
- **`cloudflare/wrangler-action@v4`** (v4.1.3, `src/wranglerAction.ts:105-145`):
  - With no `wranglerVersion` input, it uses the wrangler already installed in the working
    directory, through the package manager it detects from the lockfile (npm here).
  - With nothing installed, it installs `wrangler@4`, which is the latest, not the locked version.

  So the deploy job runs `npm ci` first, and the deploy uses the locked wrangler 4.163.
  `secrets.required` needs at least 4.77.
- **GitHub secrets.** `gh secret list` shows `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`,
  both set on 2026-11-16 around 17:12. Phase 1's last item isn't ticked yet.
- **Tools on this machine.** There is no `actionlint`. GitHub parses every workflow file on
  push, and `deploy.yml` can't be triggered from a feature branch (`workflow_dispatch` needs the
  file on `main`). So the first push shows whether `check.yml` still runs, and the merge is the
  first run of `deploy.yml`.
- **wrangler 4.163:**
  - `dev --tunnel` starts a Quick Tunnel with a random `*.trycloudflare.com` host each session.
  - `secret bulk <file>` takes a `.env` file through dotenv, and a one-line JSON value stays
    whole. When the Worker doesn't exist yet, it creates the draft Worker
    (`wrangler-dist/cli.js:308176`), as `secret put` does.
- **Biome** checks `**` (`biome.json:10`), so `deploy.yml` and `README.md` go through `biome check`.
- **The runbook's facts are in the spec:**
  - the go-live order: `technical.md` → *Setup script*;
  - the Cloudflare account steps: phase 1;
  - the supergroup upgrade: the ledger;
  - restarting `wrangler dev` before trying timers: wave 2 §4.

## Testing-issue estimate

Nothing here is unit-testable. YAML has no local linter, so the first push shows whether
`check.yml` still runs. The README's commands are checked against `--help` output (wrangler) and
the script's own usage.
