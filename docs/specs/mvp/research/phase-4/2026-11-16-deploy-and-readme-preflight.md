---
date: 2026-11-16
phase: 4
chunk: deploy and README (deliverables 6–7)
inputs: [phases/phase-4-setup-and-deploy.md, research/phase-4/2026-11-16-deploy-and-readme-recon.md, principles.md]
---

# Phase 4 preflight — deploy and README

*Source of record — do not edit.*

A workflow file and a runbook. The canon passes are mostly inert, so only the rows that bite
are below.

## Findings that change the plan

1. **"The same checks as check.yml" would be a second copy.** Six steps copied into
   `deploy.yml` drift the first time one of them changes.
   - `check.yml` gains `workflow_call`, and `deploy.yml` runs it as its first job.
   - Then `check.yml`'s own `push` trigger skips `main`, so a merge runs the checks once, inside
     the deploy, not twice.
2. **The deploy job must install the project before the action.** Without a wrangler in
   `node_modules`, wrangler-action installs the latest `wrangler@4`, not the locked 4.163
   (`wranglerAction.ts:137-145`). So: `setup-node`, `npm ci`, then the action with `apiToken`,
   `accountId` and `command: deploy`.
3. **Four `wrangler secret put` prompts can drift from `.prod.vars`.** The secret typed at a
   prompt and the one the script reads from the file are two copies.
   - `wrangler secret bulk .prod.vars` sends all four from the one file the script reads, and
     creates the draft Worker the first time, as `put` does (`cli.js:308176`).
   - Then `WEBHOOK_SECRET` can't differ between the Worker and the script.
   - The runbook and phase 5's guidance use it.

## Rules that bite

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Single source of truth | Bites | Findings 1 and 3. Also, the README links to `technical.md` for the reasons and repeats only the commands |
| Least privilege | Bites | `permissions: contents: read` on both workflows. The deploy needs only the Cloudflare secrets, which it passes to the action alone |
| Ordering | Bites | `concurrency: { group: deploy, cancel-in-progress: false }`, so two quick merges deploy in order and no deploy is cut off halfway |
| Names | Bites | The workflow is `deploy` and its jobs are `check` and `deploy`, so a red run says which half failed |

## Amendments

1. `check.yml`: add `workflow_call`; `push` skips `main`; `permissions: contents: read`.
2. `deploy.yml`: on push to `main` and `workflow_dispatch`, `concurrency` as above. Job `check`
   uses `./.github/workflows/check.yml`. Job `deploy` needs it and runs `checkout`, `setup-node`
   (`.nvmrc`, npm cache), `npm ci`, then `cloudflare/wrangler-action@v4`.
3. The README's secrets step is `npx wrangler secret bulk .prod.vars`. Phase 5's guidance
   step 3 says the same.

## Defaults applied

- The README is in English, like the other docs.
- It says to leave Workers Builds off (no Git connection in the dashboard), since deploys come
  only from the workflow.
- Local development reruns `webhook` each session, since a Quick Tunnel's host changes. Restart
  `wrangler dev` before trying timers.

## Forks for you

None.
