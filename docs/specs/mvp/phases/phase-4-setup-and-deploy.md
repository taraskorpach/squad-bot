---
needs: [3]
pr: A
---

# Phase 4 — Setup script and deploy pipeline

**Goal:** One script takes a bot from BotFather to a working webhook in the chat, and every merge to `main` deploys after the checks pass.

**Outcome:** Going live becomes a short runbook, and later changes reach the chat by merging. Free. Low risk: the deploy needs the GitHub secrets from phase 1.

**Files to touch:**
- `src/telegram.ts` (`COMMANDS`)
- `scripts/configure-telegram.ts` (the Node shell), `scripts/telegram-setup.ts` (pure), `scripts/tsconfig.json`
- `.gitignore` (`.prod.vars`); `tsconfig.json` already allows `.ts` imports (phase 3)
- `package.json` (`telegram:configure`; `tsc --noEmit -p scripts` in `check`)
- `.github/workflows/deploy.yml`
- `README.md`
- `test/scripts/telegram-setup.test.ts`

## Implementation guidance

- **`src/telegram.ts` and `src/texts.ts` stay import-free.** The script runs in Node 26 with type
  stripping, which needs explicit `.ts` extensions and rejects enums, namespaces and parameter
  properties (craft). Importing two leaf modules keeps those limits away from the rest of `src/`.
- **Subcommands** work as in `technical.md` → *Setup script*.
  - The testable parts live in `scripts/telegram-setup.ts`: finding groups in a `getUpdates`
    result (any update type, following `migrate_to_chat_id`), and building the `setWebhook` and
    `setMyCommands` payloads.
  - The shell, `scripts/configure-telegram.ts`, parses `--env <file>`, prints the target bot's
    `@username` first, and calls Telegram through grammY's `Api`.
  - Workerd tests never import the shell, since it uses `process`.
  - `scripts/tsconfig.json` gives it Node's types without putting them in the Worker's tsconfig.
- **`discover`** must not consume updates: call `getUpdates` without an offset. It works only
  while no webhook is set, which is exactly the go-live order. It lists every group seen in
  pending updates, not only "added" ones. The dev group's add expired days ago (updates live
  24 h), so the README says to post a message in the group first.
- **Deploy** with `cloudflare/wrangler-action@v4` after the same checks as `check.yml`, on push
  to `main` and on manual dispatch: phase 5 redeploys `main` after its mention test.
- **README** is the runbook:
  1. Accounts (phase 1).
  2. Adding the bot as an admin with only the pin right.
  3. `discover --env .prod.vars`, giving the supergroup's `-100…` id.
  4. The four secrets, with one `WEBHOOK_SECRET` from the password manager used for both
     `wrangler secret put` and `.prod.vars`.
  5. Merging PR A; its deploy fails while a secret is missing.
  6. `webhook`, then `welcome`.
  7. Local development with the dev bot and `wrangler dev --tunnel`.

## Deliverables

- [ ] `src/telegram.ts`: `COMMANDS` (Ukrainian descriptions, `/domikpisik` left out), import-free
- [ ] Script split: the pure `scripts/telegram-setup.ts` tested in workerd, and a Node shell `scripts/configure-telegram.ts` typed by `scripts/tsconfig.json` (`tsc --noEmit -p scripts` in `check`) that takes `--env <file>`, calls Telegram through grammY's `Api` and prints the target bot's `@username` first
- [ ] `telegram:configure discover`: prints `BOT_INFO` and every group in pending updates with id, title and type, following `migrate_to_chat_id`; consumes none
- [ ] `telegram:configure webhook <worker-url>`: sets the webhook with the secret, `ALLOWED_UPDATES` and pending updates dropped, then the group command menu, and fails when `getWebhookInfo` reports an error
- [ ] `telegram:configure welcome`: posts `welcomeMessage` to `ALLOWED_CHAT_ID`, with the ⚠️ line when `getChatMember` says the bot isn't an admin
- [ ] `.github/workflows/deploy.yml`: on push to `main` and on manual dispatch, the checks, then `wrangler deploy` with the Cloudflare secrets
- [ ] `README.md`: the go-live runbook (production values in `.prod.vars`, one `WEBHOOK_SECRET`, secrets before merging PR A, a supergroup id) and local development with the dev bot

## Phase-local notes

- `getUpdates` doesn't work while a webhook is set (wave 1); `webhook` drops pending updates on purpose.
- Workers Builds stays off: deploys come only from the workflow, after the checks.
- `secrets.required` fails `wrangler deploy` while any listed secret is missing on the Worker
  (wrangler ≥ 4.77). So PR A, whose merge deploys, merges inside phase 5, after the secrets.
- `COMMANDS`' Ukrainian descriptions are bot copy, which `src/texts.ts` holds; decide whether
  `src/telegram.ts` imports them from that leaf or `COMMANDS` moves (phase 3 preflight). Nothing
  guards "import-free" before the script first runs under Node, so run it in CI.
