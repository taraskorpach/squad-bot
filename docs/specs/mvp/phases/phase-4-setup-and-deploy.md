---
needs: [3]
pr: A
---

# Phase 4 — Setup script and deploy pipeline

**Goal:** One script takes a bot from BotFather to a working webhook in the chat, and every merge to `main` deploys after the checks pass.

**Outcome:** Going live becomes a short runbook, and later changes reach the chat by merging. Free. Low risk: the deploy needs the GitHub secrets from phase 1.

**Files to touch:**
- `src/telegram.ts` (`chatOf`, `isGroup`, `isAdmin`, `WEBHOOK_SECRET_HEADER`), `src/texts.ts` (`commandMenu`)
- `src/index.ts`, `src/members/welcome-handlers.ts` (use the shared rules)
- `scripts/configure-telegram.ts` (the Node shell), `scripts/telegram-setup.ts` (pure), `scripts/tsconfig.json`
- `.gitignore` (`.prod.vars`); `tsconfig.json` already allows `.ts` imports (phase 3)
- `package.json` (`telegram:configure`; `@types/node`; `tsc --noEmit -p scripts` and the `--help` run in `check`)
- `.github/workflows/deploy.yml`
- `README.md`
- `test/scripts/telegram-setup.test.ts`, `test/telegram.test.ts`, `test/helpers/updates.ts`

## Implementation guidance

- **`src/telegram.ts` and `src/texts.ts` stay import-free.** The script runs in Node 26 with type
  stripping, which needs explicit `.ts` extensions and rejects enums, namespaces and parameter
  properties (craft). Importing two leaf modules keeps those limits away from the rest of `src/`.
  The menu's descriptions are copy, so they go into `texts`, and the menu is built in the
  script's pure module, its only reader (preflight).
- **Subcommands** work as in `technical.md` → *Setup script*.
  - The testable parts live in `scripts/telegram-setup.ts`:
    - finding groups in a `getUpdates` result, of any update type and following
      `migrate_to_chat_id`;
    - building the `setWebhook` and `setMyCommands` payloads;
    - the probe's request and what its answer means.
  - Where an update keeps its chat (`chatOf`), whether a chat is a group (`isGroup`) and whether
    a member is an admin (`isAdmin`) are rules the bot already applies. They move into
    `src/telegram.ts` so both sides share them.
  - The shell, `scripts/configure-telegram.ts`, parses `--env <file>`, prints the target bot's
    `@username` first, and calls Telegram through grammY's `Api`.
  - Workerd tests never import the shell, since it uses `process`.
  - `scripts/tsconfig.json` gives it Node's types without putting them in the Worker's tsconfig.
    It uses `nodenext` and `erasableSyntaxOnly`, so tsc rejects what Node's type stripping
    rejects. The root's bundler resolution would let both through.
- **`webhook` probes before it sets anything.** `getWebhookInfo` shows an error only after a
  delivery, and `drop_pending_updates` leaves none. So the script first sends the request
  Telegram will send: an update with no chat, with the secret. Any answer but 200 stops it with
  the reason: 401 means a different secret, 404 means nothing is deployed there.
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
  7. Local development with the same bot in the test group and `wrangler dev --tunnel`, and
     pointing the webhook back at the Worker afterwards (one bot has one webhook).

## Deliverables

- [x] The group command menu: Ukrainian descriptions in `src/texts.ts` (`commandMenu`), `/domikpisik` left out, built into the `setMyCommands` payload in `scripts/telegram-setup.ts`, its only reader, so `src/telegram.ts` stays import-free
- [x] Script split: the pure `scripts/telegram-setup.ts` tested in workerd, and a Node shell `scripts/configure-telegram.ts` typed by `scripts/tsconfig.json` (`nodenext`, `erasableSyntaxOnly`; `tsc --noEmit -p scripts` and a `--help` run under Node in `check`) that takes `--env <file>`, calls Telegram through grammY's `Api` and prints the target bot's `@username` first
- [x] `telegram:configure discover`: prints `BOT_INFO` and every group in pending updates with id, title and type, following `migrate_to_chat_id`; consumes none, and refuses while a webhook is set
- [x] `telegram:configure webhook <worker-url>`: first checks that the Worker at `<origin>/webhook` answers the secret, then sets the webhook with the secret, `ALLOWED_UPDATES` and pending updates dropped, then the group command menu, and fails when `getWebhookInfo` reports an error
- [x] `telegram:configure welcome`: once a webhook is set and reports no error, posts `welcomeMessage` to `ALLOWED_CHAT_ID`, with the ⚠️ line when `getChatMember` says the bot isn't an admin
- [x] `.github/workflows/deploy.yml`: on push to `main` and on manual dispatch, the checks, then `wrangler deploy` with the Cloudflare secrets
- [ ] `README.md`: the go-live runbook (production values in `.prod.vars`, one `WEBHOOK_SECRET`, secrets before merging PR A, a supergroup id) and local development with the one bot, including pointing the webhook back at the Worker

## Phase-local notes

- `getUpdates` doesn't work while a webhook is set (wave 1); `webhook` drops pending updates on purpose.
- Workers Builds stays off: deploys come only from the workflow, after the checks.
- `secrets.required` fails `wrangler deploy` while any listed secret is missing on the Worker
  (wrangler ≥ 4.77). So PR A, whose merge deploys, merges inside phase 5, after the secrets.
- Decided in the preflight: the menu's descriptions are in `texts.commandMenu`, and the menu is
  built in `scripts/telegram-setup.ts`. `src/telegram.ts` stays import-free.
- Two checks guard what Node can load: `tsc -p scripts` (`nodenext`, `erasableSyntaxOnly`) and
  a `--help` run under Node in `check`. Phase 3 had checked it once by hand:
  `node --input-type=module -e "await import('./src/welcome.ts')"` loads under Node 26 with no
  build step.
