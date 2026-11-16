---
needs: [3]
pr: A
---

# Phase 4 — Setup script and deploy pipeline

**Goal:** One script takes a bot from BotFather to a working webhook in the chat, and every merge to `main` deploys after the checks pass.

**Outcome:** Going live becomes a short runbook, and later changes reach the chat by merging. Free. Low risk: the deploy needs the GitHub secrets from phase 1.

**Files to touch:**
- `src/telegram.ts` (`ALLOWED_UPDATES`, `COMMANDS`)
- `scripts/configure-telegram.ts`, `tsconfig.json` (include `scripts/`, allow `.ts` imports)
- `package.json` (`telegram:configure`)
- `.github/workflows/deploy.yml`
- `README.md`
- `test/scripts/configure-telegram.test.ts`

## Implementation guidance

- **`src/telegram.ts` and `src/texts.ts` stay import-free.** The script runs in Node 26 with type
  stripping, which needs explicit `.ts` extensions and rejects enums, namespaces and parameter
  properties (craft). Importing two leaf modules keeps those limits away from the rest of `src/`.
- **Subcommands** as in `technical.md` → *Setup script*. Keep the testable parts pure: finding
  groups in a `getUpdates` result, building the `setWebhook` and `setMyCommands` payloads. The
  network calls stay a thin shell around them.
- **`discover`** must not consume updates: call `getUpdates` without an offset. It works only
  while no webhook is set, which is exactly the go-live order.
- **Deploy** with `cloudflare/wrangler-action@v4` after the same checks as `check.yml`, on push
  to `main` only.
- **README** is the runbook: accounts (phase 1), adding the bot and making it an admin,
  `discover`, secrets, merging, `webhook`, `welcome`; then local development with the dev bot and
  `wrangler dev --tunnel`.

## Deliverables

- [ ] `src/telegram.ts`: `WEBHOOK_PATH`, `ALLOWED_UPDATES` and `COMMANDS` (Ukrainian descriptions, `/domikpisik` left out), import-free
- [ ] `telegram:configure discover`: prints `BOT_INFO` from `getMe` and the groups the bot was added to (id, title) from pending updates, consuming none
- [ ] `telegram:configure webhook <worker-url>`: sets the webhook with the secret, `ALLOWED_UPDATES` and pending updates dropped, then the group command menu
- [ ] `telegram:configure welcome`: posts the welcome with the 👋 button to `ALLOWED_CHAT_ID`
- [ ] `.github/workflows/deploy.yml`: on push to `main`, the checks, then `wrangler deploy` with the Cloudflare secrets
- [ ] `README.md`: the go-live runbook and local development with the dev bot

## Phase-local notes

- `getUpdates` doesn't work while a webhook is set (wave 1); `webhook` drops pending updates on purpose.
- Workers Builds stays off: deploys come only from the workflow, after the checks.
