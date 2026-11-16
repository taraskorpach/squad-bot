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
- `src/index.ts`, `src/telegram.ts`, `src/bot.ts`, `src/context.ts`
- `src/chat/chat-room.ts`, `src/chat/schema.ts`
- `test/index.test.ts`, `test/chat/chat-room.test.ts`, `test/helpers/helpers.test.ts`
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
- **The Worker** stays framework-free: secret check, chat id, allow-list, `leaveChat` for foreign
  groups, RPC to the object. It never answers 200 for an update that failed before its commit.
- **The object** owns everything else. The serial queue is a small promise chain: each task runs
  to the end, and one task's failure doesn't break the chain. Dedupe is `processed_updates`,
  written in the same transaction as the update's first non-idempotent change through
  `ctx.room.commit`; `ctx.room.write` is for idempotent writes.
- **grammY** is built once per object instance with `botInfo`, capped auto-retry and an HTTP
  timeout of 10 s. This phase registers no features: a test proves that an update flows through
  the bot and that `/x@otherbot` is ignored.

## Deliverables

- [ ] Scaffold: npm project with TypeScript 6, Biome, `.nvmrc` 26 and `wrangler.jsonc` (`ChatRoom` through `exports`, compatibility date 2026-11-16 with the `temporal` flag, observability on); `npm run check` passes on an empty Worker
- [ ] Test harness: `@cloudflare/vitest-plugin` config with fake secrets, an MSW network that records and answers Telegram API calls, and update builders, with a self-test
- [ ] Worker: `POST /webhook` answers 401 for a missing or wrong secret and 404 for other paths, ignores private chats, leaves foreign groups, and routes the allowed chat to its `ChatRoom`
- [ ] Migrations: an ordered list applied once in the object's constructor and tracked in `_sql_schema_migrations`; migration 1 creates `processed_updates`
- [ ] Once and in order: the serial queue runs each update to the end before the next; a redelivered update changes nothing; a failure before the commit makes the Worker answer 500, a Telegram failure after it still 200
- [ ] grammY inside the object: built once with `botInfo`, auto-retry capped at 2 retries and 5 s with server errors rethrown, `/cmd@otherbot` ignored
- [ ] CI: `.github/workflows/check.yml` runs `npm run check` and `npm test` on pushes and pull requests

## Phase-local notes

- grammY's Deno-flavoured Workers guide returns `new Response(e.message)` from its catch, a 200
  that hides failures: don't copy it (wave 2 §3).
- Storage is isolated per test **file**: give each object test its own chat id (craft).
- Build the grammY bot after the MSW network is enabled: grammY captures `fetch` in its constructor (craft).
- `crypto.subtle.timingSafeEqual` needs inputs of equal length: compare lengths first.
- Don't name the class `Chat` (grammY's type), don't put object migrations in a root
  `migrations/` folder (D1's default), and don't use `PRAGMA user_version` (unsupported) (craft).
