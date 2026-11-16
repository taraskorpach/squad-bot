---
date: 2026-11-16
phase: 4
chunk: the setup script (deliverables 1–5)
inputs: [phases/phase-4-setup-and-deploy.md, technical.md, design.md, reviews/2026-11-16-failure-paths-and-go-live.md]
---

# Phase 4 recon — the setup script

*Source of record — do not edit.*

One wave of two read-only agents (grammY and Node; repo reuse and tests), plus direct checks of
wrangler 4.163 and the wrangler-action releases. A last section keeps the facts the next chunk
(deploy and README) needs, so it doesn't redo them.

## The seam

- **`src/telegram.ts`** (67 lines) is a leaf: its only import is `import type` from
  `grammy/types` (:2). It holds `WEBHOOK_PATH` (:4), `ALLOWED_UPDATES` (:7-12), `HI_CALLBACK`
  (:17), `API_TIMEOUT_SECONDS` (:20), `MESSAGE_FORMAT` (:23-26) and `isInChat` (:55-67).
- **`src/texts.ts`** (27 lines) has no imports. `texts` (:6-20) holds every string the bot sends.
- **`src/welcome.ts`** (16 lines) imports both leaves with `.ts` extensions (:3-4).
  `welcomeMessage({ isAdmin })` returns `{ text, options }` with the 👋 keyboard.
- **`src/members/welcome-handlers.ts:14`** decides the ⚠️ line inline:
  `isAdmin: now.status === 'administrator'`. The script's `welcome` needs the same decision from
  `getChatMember`: a second use.
- **`src/index.ts`**:
  - :13 answers only `POST` with a pathname of exactly `/webhook`. The webhook URL must be
    `<origin>/webhook`, with no trailing slash.
  - :63 builds a standalone `new Api(token, { timeoutSeconds: API_TIMEOUT_SECONDS })`.
  - :69-77 keep `isGroup` and `logIfMoved` private. `logIfMoved` is the only reader of
    `migrate_to_chat_id` in `src/`.
- **`src/settings.ts`** has only a type import, but `readRoomSettings` (:12-14) takes
  `Pick<Env, …>`, the ambient Workers type. A Node-typed program can't compile it.
  `parseAllowedChatId` (:22) is pure. `WEBHOOK_SECRET` is validated nowhere: its rule (32+
  characters of `A-Za-z0-9_-`) is a comment in `.dev.vars.example:3`.
- **Commands.** `src/` registers `all` (`all-handlers.ts:19`) and `domikpisik`
  (`domikpisik-handlers.ts:9`). There is no list of command names and no `setMyCommands`.
- **Config.**
  - `package.json:7` `check` runs Biome, then tsc for the root and `test`, then `wrangler types --check`.
  - The root tsconfig uses `moduleResolution: bundler` and has no `erasableSyntaxOnly`. Nothing
    statically checks that a file is loadable by Node.
  - `.gitignore` doesn't ignore `.prod.vars` (`git check-ignore`).
  - Biome's `files.includes` is `**` (`biome.json:10`), so `scripts/`, YAML and Markdown are all checked.
  - There is no README at the root.

## grammY and Node, as installed

- **`Api`.** `new Api(token, options?)` (`grammy/out/core/api.d.ts:72`); `timeoutSeconds`
  defaults to 500 (`client.js:77`). The methods (api.d.ts):
  - `getMe` :129 returns `UserFromGetMe`.
  - `getUpdates(other?)` :85.
  - `getWebhookInfo()` :121.
  - `setWebhook(url, other?)` :104.
  - `setMyCommands(commands, other?)` :1190.
  - `getChatMember(chat_id, user_id)` :985.
  - `sendMessage(chat_id, text, other?)` :156.

  `api.raw.<method>(payload)` takes the whole Telegram payload. `Opts<M>` types it, and it comes
  from `grammy/types` (`types.node.d.ts:52`), not from `grammy`.
- **Errors.** `GrammyError` (`error.d.ts:13-31`) reads
  `Call to '<method>' failed! (<code>: <description>)`. Network failures and timeouts throw
  `HttpError`.
- **Under Node 26.13.1** (the local version; CI's `.nvmrc` resolves to it too):
  - `import { Api, GrammyError } from 'grammy'` loads grammY's CommonJS build through the
    `node` condition, and named imports work.
  - grammY fetches through `node-fetch` v2.
  - `process.features.typescript` is `strip`.
  - Importing `src/welcome.ts`, `telegram.ts` and `texts.ts` under Node gave no error or warning.
- **TypeScript 6.0.3** supports `erasableSyntaxOnly`. Under `module`/`moduleResolution: nodenext`
  with `types: ["node"]`, `grammy` and `grammy/types` resolve and compile with `skipLibCheck`.
  `nodenext` also rejects extensionless relative imports. Together the two options state Node's
  type-stripping limits for every file the script reaches.
- **`@types/node`** 26.6.6 is in `node_modules` only as a transitive dependency
  (`package-lock.json:1474`).
- **`util.parseEnv`** (Node built-in) parses `.dev.vars`-style files and keeps a one-line JSON
  value (`BOT_INFO`) whole. `util.parseArgs` is built in as well.
- **Types** (`@grammyjs/types`):
  - `WebhookInfo` (manage.d.ts:5): `url?` is optional; `last_error_date?` :15, `last_error_message?` :17.
  - `Chat` union manage.d.ts:199. `GroupChat` :141 and `SupergroupChat` :160 have `title`.
  - `Message.migrate_to_chat_id` (message.d.ts:273) and `migrate_from_chat_id` (:275).
  - `BotCommandScopeAllGroupChats` (settings.d.ts:89). `ChatMember` (manage.d.ts:757).
- **Where an update's chat is.** Every update field's payload has `chat`, except:
  - `callback_query`, which has `message?.chat`;
  - the fields with no chat at all: `business_connection`, `inline_query`,
    `chosen_inline_result`, `shipping_query`, `pre_checkout_query`, `purchased_paid_media`,
    `poll`, `poll_answer`, `managed_bot` and `subscription`.

  `chatIdOf` covers only the four allowed types and returns no title or type.

## Reuse

- `isAdmin(member)` becomes a shared rule in `src/telegram.ts`, beside `isInChat`, used by the
  welcome handler and the script.
- `welcomeMessage`, `WEBHOOK_PATH`, `ALLOWED_UPDATES` and `API_TIMEOUT_SECONDS` serve the script as they are.
- `getUpdates` with no `offset` reads up to 100 pending updates and confirms none. Paging needs
  an offset, which confirms the earlier ones, so one page is all `discover` can read. The oldest
  pending updates come first, and the add and migration updates are among the oldest.
- **Test builders** (`test/helpers/updates.ts`):
  - `migrationMessage(toChatId, options)` :76.
  - `serviceMessage(fields, options)` :81, whose `fields.chat` replaces the chat.
  - `botAdded`, `botChange` and `memberChange`, whose `ChangeOptions.chat` (:130) takes a whole chat.
  - `tap` :106 and `chatMember(user, status)` :163.

  Messages take only `chatId` and are always the supergroup `Squad` (:61-63). A message in a basic
  group needs a chat option.
- Tests import `src` without extensions, keep one `describe` per export, use `it.each` tables, and
  pin Ukrainian copy as literals (`test/welcome.test.ts:5-10`).

## Testing-issue estimate

- **The pure module runs in workerd.** The test program has no `@types/node`, so the module can't
  touch Node, which is the intent. The test setup's Telegram fake answers every method with
  `ok`, so a stray call would pass silently. The module makes none: it imports no grammY runtime.
- **The shell does only I/O and isn't unit-tested.** Running it under Node with no Telegram call
  (`--help`) is the only check that its imports load.
- **Size.** `test/helpers/updates.ts` is at 218 lines; a chat option adds a few. Every other file
  in the seam is under 110.
- **Domain smells.** None on the path. The admin check is the one duplication about to appear.

## For the next chunk: deploy and README

- `check.yml` is green on this branch (run 43959280060 at `9e049e5`). `actions/checkout@v7`
  and `actions/setup-node@v7` resolve, and Node 26.13.1 comes from `.nvmrc`.
- **`cloudflare/wrangler-action`.**
  - v4.1.3 (2026-09-24) is the latest; v4.1.0 is marked broken, so use the `@v4` tag.
  - Inputs: `apiToken`, `accountId`, `command` (defaults to `deploy`), `wranglerVersion`,
    `packageManager`. It runs on `node24`.
- **wrangler 4.163:**
  - `dev --tunnel` opens a Quick Tunnel.
  - `secret bulk <file>` takes a `.env` file through dotenv. When the Worker doesn't exist yet,
    it creates a draft one, as `secret put` does (`wrangler-dist/cli.js:307966`, :308176). So
    one `.prod.vars` can feed both the Worker's secrets and the script.
- `npm` and `npx` aren't on this machine's PATH; `node_modules/.bin` works. That is a fact of
  this machine, not something the README should depend on.
- The review rejected a `deleteWebhook`-and-rediscover step (AT-F12): in the go-live order,
  `discover` runs before the webhook exists.
