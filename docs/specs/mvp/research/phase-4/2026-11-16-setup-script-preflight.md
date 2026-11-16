---
date: 2026-11-16
phase: 4
chunk: the setup script (deliverables 1–5)
inputs: [phases/phase-4-setup-and-deploy.md, research/phase-4/2026-11-16-setup-script-recon.md, principles.md]
---

# Phase 4 preflight — the setup script

*Source of record — do not edit.*

Grounded in the recon's seam, plus full reads of `src/index.ts`, `src/settings.ts`,
`src/members/welcome-handlers.ts`, `test/helpers/updates.ts` and the tests of the three leaves.

## Findings that change the plan

1. **Deliverable 1 contradicts itself.** It asks for `COMMANDS` "with Ukrainian descriptions" in
   `src/telegram.ts`, "import-free".
   - The bot's Ukrainian lives in `src/texts.ts` (:1-2, "every string it sends").
   - `src/telegram.ts:1` must stay free of runtime imports.
   - Nothing in `src/` reads a command menu: handlers register by name (`all-handlers.ts:19`,
     `domikpisik-handlers.ts:9`), and nothing calls `setMyCommands`.

   The descriptions go into `texts`, and the menu is built beside its only reader, the
   `setMyCommands` payload in `scripts/telegram-setup.ts`.
2. **`tsc -p scripts` would be blind to what Node rejects** if `scripts/tsconfig.json` kept the
   root's options. `moduleResolution: bundler` (`tsconfig.json:6`) accepts extensionless relative
   imports, and without `erasableSyntaxOnly`, enums, namespaces and parameter properties
   compile. Node's type stripping rejects all of them. Also, `@types/node` is installed only
   through other packages' dependencies (`package-lock.json:1474`), so the scripts project would
   type-check by accident.
3. **The `getWebhookInfo` check can't see a broken Worker.** `last_error_message`
   (`manage.d.ts:17`) records a failed delivery. `drop_pending_updates` leaves nothing to deliver
   until someone writes, so the check passes in exactly the cases it exists for:
   - the Worker answers 401 because its `WEBHOOK_SECRET` differs (`index.ts:16`);
   - it answers 404 at a wrong URL (`index.ts:13-14`);
   - only the draft Worker is there, which answers 500.

   The script holds the URL and the secret, so it can send the request Telegram will send. The
   Worker answers an update with no chat with 200 and ignores it (`index.ts:24-28`).
4. **`<url>/webhook` by concatenation breaks on a trailing slash.** The Worker matches the
   pathname `/webhook` exactly (`index.ts:13`). `https://x.workers.dev/` plus `/webhook` gives
   `//webhook`, and every update would get a 404.
5. **Three rules are about to be written twice.**
   - **Admin.** The ⚠️ line's rule is inline at `welcome-handlers.ts:14`
     (`now.status === 'administrator'`), and `welcome` needs it for `getChatMember`.
   - **Where an update keeps its chat.** `chatIdOf` (`telegram.ts:28-35`) knows four update
     types and returns only the id. `discover` needs the whole chat for every type: `message`,
     `edited_message`, `guest_message`, channel posts, business messages, reactions, member
     changes, join requests, boosts, and a tap's message (`update.d.ts:29-86`).
   - **Group.** `isGroup` is private to `index.ts:69-71`, and `discover` needs it.

## Clean Code against the setup script

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Names | Bites | `groupsIn`, `chatOf`, `isAdmin`, `isGroup`, `webhookSettings`, `deliveryError`. The shell's functions are the CLI's words: `discover`, `webhook`, `welcome` |
| Small functions, one thing | Bites | The shell's `main` reads arguments and the env file, prints `@username`, then dispatches. Each subcommand is its own function under 50 lines |
| Command/query separation | Bites | The pure module only computes. `discover` passes no `offset` to `getUpdates` (`methods.d.ts:28`), which would confirm updates |
| Comments | Bites | Only the whys: no offset, the probe before `setWebhook`, pending updates dropped |
| Errors | Bites | The shell catches once at the top, prints `error.message` and exits 1. Never print an `HttpError`'s inner `error`: its request URL holds the token. grammY keeps the token out of its own messages (`sensitiveLogs`, `client.d.ts:163`) |
| Boundaries | Bites | grammY's `Api` appears only in the shell. The pure module imports only types from `grammy/types` (Node erases them) and returns `Opts<'setWebhook'>` and `Opts<'setMyCommands'>`, so the compiler checks the payloads against Telegram's shapes |
| Tests | Bites | `it.each` tables in the house style (`test/telegram.test.ts:34`, :64), fixtures from `test/helpers/updates.ts`. A message in a basic group needs a `chat` option on `MessageOptions` (`updates.ts:36-46`), the way `ChangeOptions.chat` (:130) works |
| Simple design | Bites | No CLI framework: Node's `util.parseArgs` and `util.parseEnv`, then a `switch` |

## Clean Architecture against the setup script

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Dependency rule | Bites | `scripts/` imports `src` leaves and nothing else of `src`, and `src` never imports `scripts/` |
| Humble Object | Bites | The shell does I/O only, and every decision is in `scripts/telegram-setup.ts`. That is what makes the decisions testable without Node or Telegram |
| Crossing boundaries | Bites | Payloads cross as plain objects into `api.raw.<method>` (`client.d.ts:10-12`) |
| Component cohesion (CCP) | Bites | The menu changes with the script, so it lives there. Its copy changes with the rest of the bot's copy, so that lives in `texts` |
| Acyclic dependencies | Bites | `welcome.ts` → `telegram.ts`, `texts.ts`; `scripts/` → those three. No cycle |
| Policy and detail | Inert | |

## SOLID against the setup script

| Rule | Verdict | Concrete consequence |
|---|---|---|
| SRP | Bites | Two actors: Taras running the go-live (the shell's output and refusals), and Telegram's API contract (the payloads). Each file answers to one |
| OCP | Bites | The next variant is another subcommand: a new `case` and function, with nothing existing edited |
| LSP, ISP | Inert | |
| DIP | Inert | The shell names grammY's `Api` directly. It is the outermost detail, with nothing above it to protect |

## DDD against the setup script

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Ubiquitous language | Bites | The output and README say "upgraded to a supergroup", as the ledger does. Telegram's field says `migrate_to_chat_id` |
| Who owns the invariant | Bites | The `WEBHOOK_SECRET` rule (32+ characters of `A-Za-z0-9_-`) lives only in a comment (`.dev.vars.example:3`). It is enforced where the secret first leaves the operator: `webhookSettings`. The Worker accepts any length (`index.ts:41-47`) |
| Aggregates, repositories, events | Inert | No domain model here |

## Guard blindness

- `tsc -p scripts` with the root's options is blind (finding 2). With `module: nodenext` and
  `erasableSyntaxOnly`, it sees every file the script reaches. It also catches a leaf that
  imports `cloudflare:workers`, because the Node program has no Workers types.
- `tsc -p test` compiles `scripts/telegram-setup.ts` under bundler resolution and Workers types.
  It guards against Node APIs in the pure module (the test program has no `@types/node`). It
  says nothing about Node loading the file.
- No compiler can see whether Node's CommonJS interop for `grammy` holds. That takes one real
  run: `node scripts/configure-telegram.ts --help` in `check`, which calls nothing.

## Seam and testability (deltas from the recon)

- **The shell's happy paths can't run in this chunk.** No dev bot exists yet (phase 1's bot
  tasks are open), so the pre-PR check with the dev bot is their first real run. These can run
  now: `--help`, a missing env file, a missing setting, a bad URL, and a real `getMe` with a fake
  token, which gets 401.
- **Sizes.**
  - `test/helpers/updates.ts` grows from 218 to about 222 lines with the chat option.
  - `test/telegram.test.ts` grows from 107 to about 140 lines.
  - The shell should land near 150 lines.

## Amendments

1. **The menu.** `texts.commandMenu` holds the five descriptions from `design.md` → *Command
   menu*, in its order. `scripts/telegram-setup.ts` builds the `setMyCommands` payload from it,
   for `all_group_chats`. `src/telegram.ts` stays import-free. Reword deliverable 1.
2. **`chatOf`.** `chatOf(update)` in `src/telegram.ts` replaces `chatIdOf` and returns the chat of
   every update type that has one. The Worker routes on `chatOf(update)?.id`. The test that
   every allowed type yields a chat stays. Its own refactor commit.
3. **`isGroup` and `isAdmin`.** Both move into `src/telegram.ts` beside `isInChat`, each in its
   own refactor commit with a test:
   - `isGroup(chat)` comes from `index.ts:69-71`.
   - `isAdmin(member)` is new; `welcome-handlers.ts:14` uses it.
4. **The probe.** `WEBHOOK_SECRET_HEADER` moves from `index.ts:9` to `src/telegram.ts`. `webhook`
   starts by POSTing `{"update_id":0}` with the secret to `<origin>/webhook`:
   - it goes on only on a 200;
   - 401 means the Worker's secret differs;
   - 404 means nothing is deployed at that URL;
   - any other status is reported as it is.

   Then it sets the webhook and the menu, and the `getWebhookInfo` check stays. Reword
   deliverable 4.
5. **`scripts/tsconfig.json`.** It extends the root with `module`/`moduleResolution: nodenext`,
   `types: ["node"]` and `erasableSyntaxOnly: true`. `@types/node` becomes a devDependency.
   `check` gains `tsc --noEmit -p scripts` and the `--help` run. Reword deliverable 2.
6. **URLs.** `webhookSettings` builds the URL with `new URL(WEBHOOK_PATH, workerUrl)`, takes only
   `https:`, and refuses a secret outside the rule. Tests cover a trailing slash, a path, `http:`
   and a short secret.
7. **The webhook as a precondition.** `discover` refuses while a webhook is set, since
   `getUpdates` can't run then. `welcome` refuses until one is set, or while `getWebhookInfo`
   reports a delivery error, or nobody hears 👋 (phase 5's note). Reword deliverables 3 and 5.

## Defaults applied

- The script prints in English, like the docs: it is the operator's tool. The chat's copy stays
  Ukrainian.
- `discover` reads one page, the oldest 100 pending updates. Reading further needs an `offset`,
  which confirms the earlier updates. The add and the upgrade are among the oldest.
- `discover` follows `migrate_to_chat_id` only. Telegram sends `migrate_from_chat_id` in the same
  moment, from the supergroup, which `discover` already lists through its chat.
- `--env` defaults to `.dev.vars`. The script reads only the settings each subcommand needs:
  `BOT_TOKEN` always, `WEBHOOK_SECRET` for `webhook`, `ALLOWED_CHAT_ID` for `welcome`.
- `ALLOWED_CHAT_ID` goes to Telegram as written, and Telegram validates it. `settings.ts` can't
  join the Node program: `readRoomSettings` takes the Workers `Env` (`settings.ts:13`).
- `isAdmin` counts `creator` too. A bot can't be one, but the rule then reads right for any member.

## Forks for you

None.
