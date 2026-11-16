---
needs: []
pr: A
shape: harness-first
---

# Phase 2 — Skeleton and webhook plumbing

**Goal:** A deployable Worker that authenticates Telegram's webhook, sends each update of the one allowed chat to that chat's `ChatRoom` object, and processes it once and in order, with a test harness that fakes Telegram, redelivery, parallel taps and time.

**Outcome:** Nothing visible in the chat yet; this is the floor every feature stands on. Free. Low risk: the delivery rules are proven by tests before any feature depends on them.

**Files to touch:**
- `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `biome.json`, `.gitignore`, `.dev.vars.example`
- `wrangler.jsonc`, `worker-configuration.d.ts`
- `vitest.config.mts`, `test/tsconfig.json`, `test/setup.ts`, `test/helpers/telegram.ts`, `test/helpers/updates.ts`
- `src/index.ts`, `src/telegram.ts` (`WEBHOOK_PATH`, `ALLOWED_UPDATES`, `chatIdOf`, `isInChat`), `src/bot.ts`, `src/context.ts`, `src/settings.ts`
- `src/chat/chat-room.ts`, `src/chat/room.ts`, `src/chat/schema.ts`, `src/chat/serial-queue.ts`, `src/chat/update-log.ts`, `src/chat/failure-policy.ts`
- `test/index.test.ts`, `test/telegram.test.ts`, `test/settings.test.ts`, `test/bot.test.ts`, `test/helpers/helpers.test.ts`
- `test/chat/chat-room.test.ts`, `test/chat/schema.test.ts`, `test/chat/serial-queue.test.ts`, `test/chat/failure-policy.test.ts`
- `.github/workflows/check.yml`

## Implementation guidance

Follow `technical.md` → *Worker contract*, *Object contract* and *Testing*; the research behind
them is `research/2026-11-16-wave-2-cloudflare-fit.md` and the craft snapshot.

- **Scaffold** from Cloudflare's C3 hello-world TypeScript template for `tsconfig.json`, `test/`
  and the Vitest config, and take only the class shape from its Durable Object template, which is
  stale (craft). Declare `ChatRoom` with `exports` (SQLite) and bind it as `CHAT_ROOM`; re-export
  the class from `src/index.ts`, or Wrangler ignores it. Commit the generated
  `worker-configuration.d.ts`.
- **Harness first** (the shape): the Telegram fake and the update builders come before the Worker
  and get a self-test, so every later test reads like the chat it simulates. Wire the tests into
  CI in this phase: a harness CI never runs proves nothing.
- **The Worker** stays framework-free: secret check, `chatIdOf`, allow-list, `leaveChat` (through
  grammY's `Api`) for groups that add the bot, and RPC to the one object by `ROOM_NAME`. It
  answers 500 exactly when the object rejects, and only the failure policy decides that.
- **The object** owns everything else. The serial queue is a small promise chain: each task runs
  to the end, and one task's failure doesn't break the chain. Dedupe is `processed_updates`,
  written in the same transaction as the update's first non-idempotent change through
  `ctx.room.commit`, which returns its callback's result. `ctx.room.write` is for idempotent
  writes. Both sit on `Room` (`src/chat/room.ts`), which the alarm uses without a grammY context.
- **The failure policy** is the heart of this phase (`technical.md` → *Processing one update*).
  An error answers 500 only before anything was committed or sent, never for a permanent
  Telegram error, and only until the update has failed 3 times over 5 minutes. Telegram retries
  a failing message for 24 h and holds the chat's later messages behind it (wave 1), so an
  uncapped 500 turns one bug into a dead chat.
- **grammY** is built lazily, once per object instance, from the object's `features` field. It
  gets `botInfo`, capped auto-retry, an HTTP timeout of 10 s and a transformer that marks the
  update as delivered. This phase ships no features. Its tests register test features through
  the `features` seam (one that commits, one that calls Telegram, one that throws) and prove the
  failure policy, the stale flag, and that `/x@otherbot` is ignored.

## Deliverables

- [x] Scaffold: npm project with TypeScript 6, Biome, `.nvmrc` 26 and `wrangler.jsonc` (`ChatRoom` through `exports`, compatibility date 2026-11-16 with the `temporal` flag, observability on); `npm run check` passes on an empty Worker
- [x] Test harness: `@cloudflare/vitest-plugin` config with fake secrets, an MSW network that records and answers Telegram API calls, and update builders, with a self-test
- [ ] Worker: `POST /webhook` answers 401 for a missing or wrong secret and 404 for other paths, finds the chat with `chatIdOf` (a test per `ALLOWED_UPDATES` type), ignores other chats, leaves groups that add it (`isInChat` false → true), logs a migration of the allowed chat, and routes the allowed chat to the one `ChatRoom`
- [x] Migrations: an ordered list applied once in the object's constructor, each migration with its `_sql_schema_migrations` row in one `transactionSync`; migration 1 creates `processed_updates` and `failed_updates`; settings checked at construction
- [ ] Once and in order: the serial queue runs each update to the end before the next, a redelivered update changes nothing, and `ctx.room.commit` records the update id with the first change and returns its result
- [ ] Failure policy: a 500 only when nothing was committed or sent and the error isn't a permanent Telegram error, until the update has failed 3 times over 5 minutes (`failed_updates`); every other failure is logged and answered 200
- [ ] grammY inside the object: built lazily from the `features` seam with `botInfo`, auto-retry capped at 2 retries and 5 s with server errors rethrown, the 10 s timeout and the delivered marker; bots and channel identities ignored, messages over 10 minutes old flagged stale, `/cmd@otherbot` ignored
- [x] CI: `.github/workflows/check.yml` runs `npm run check` and `npm test` on pushes and pull requests

## Phase-local notes

- grammY's Deno-flavoured Workers guide returns `new Response(e.message)` from its catch, a 200
  that hides failures: don't copy it (wave 2 §3).
- Storage is isolated per test **file**: give each object test its own chat id (craft).
- Build the grammY bot after the MSW network is enabled: grammY captures `fetch` in its constructor (craft).
- `crypto.subtle.timingSafeEqual` needs inputs of equal length: compare lengths first.
- `failed_updates` is written in its own transaction in the catch, after the failed one has
  rolled back. If storage itself is down, that write fails too and the update stays a 500, which
  is right for an outage.
- Don't name the class `Chat` (grammY's type), don't put object migrations in a root
  `migrations/` folder (D1's default), and don't use `PRAGMA user_version` (unsupported) (craft).
