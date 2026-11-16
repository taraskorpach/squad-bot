---
date: 2026-11-16
phase: 2
chunk: scaffold, harness, worker, migrations, once-and-in-order
lens: phase-exec
---

# Phase 2 recon — scaffold to once-and-in-order

*Source of record — do not edit.*

The repo holds only docs, so the seam is the libraries, not existing code. Two Explore agents
read the installed sources of the locked stack (probe install in the session scratchpad,
versions below), and a probe Worker ran in workerd. `NM/` = the probe's `node_modules/`.

## Versions on 2026-11-16 (npm registry)

wrangler 4.163.0 (bundles workerd 1.20261116.1) · typescript 6.0.3 (7.0.2 is `latest`) ·
vitest 5.1.0 · @cloudflare/vitest-plugin 1.8.3 · msw 3.0.6 · @msw/cloudflare 0.2.0 ·
grammy 1.46.0 · @grammyjs/auto-retry 2.0.2 · @biomejs/biome 2.6.8 · create-cloudflare 2.74.13 ·
actions/checkout v7.0.1 · actions/setup-node v7.1.0. Engines: wrangler and msw need Node
≥ 22.12; vitest `^22.12 || ^24 || >=26`.

## Environment

- This machine has Node 24.22 (through pnpm), pnpm and Bun, but **no npm**. npm 11.21.2 runs
  through `bun x npm@11.21.2`; the lockfile it writes is what CI's `npm ci` reads.
- npm 11.21 skips unapproved install scripts (`allowScripts`): esbuild's and workerd's
  postinstall were skipped, and wrangler, esbuild and workerd still ran (the platform binaries
  come from optional dependencies).

## The seam

### Scaffold (C3 hello-world/ts, create-cloudflare 2.74.13)
- `tsconfig.json`: target/lib `es2024`, `module: es2022`, `moduleResolution: Bundler`,
  `strict`, `isolatedModules`, `noEmit`, `exclude: ["test"]`,
  `include: ["worker-configuration.d.ts", "src/**/*.ts"]`.
- `test/tsconfig.json`: extends the root, `types: ["@cloudflare/vitest-plugin/types"]`,
  includes `./**/*.ts` and `../worker-configuration.d.ts`.
- `vitest.config.mts`: `defineConfig({ plugins: [cloudflareTest({ wrangler: { configPath } })] })`.
- Its test still imports the deprecated `SELF`/`env` from `cloudflare:test`. The Durable Object
  template still uses the legacy `migrations` array; only its class shape carries over:
  `class X extends DurableObject<Env>` from `cloudflare:workers`, RPC methods, `getByName`.

### Probe results (workerd 1.20261116.1)
- `exports: { ChatRoom: { type: "durable-object", storage: "sqlite" } }` plus a
  `durable_objects.bindings` entry works in tests; `compatibility_date: "2026-11-16"` with the
  `temporal` flag gives a native `Temporal`.
- `wrangler types` types `CHAT_ROOM` as `DurableObjectNamespace<import("./src/index").ChatRoom>`
  when the entry module exports the class, and each `secrets.required` name as `string`,
  without `.dev.vars` (`NM/wrangler/wrangler-dist/cli.js:211684-211808`).
- `wrangler types --check` fails when the env hash or the runtime header (workerd version,
  compatibility date, flags) changed (`cli.js:214298-214376`): a wrangler upgrade needs a regen.
- A rejected RPC method reaches the caller as an `Error` with the same message; workerd also
  logs it as `Uncaught (in promise)`, which is noise in test output.
- An exception thrown by the Worker's `fetch` rejects `exports.default.fetch()` in tests
  instead of becoming a 500, so the Worker must catch the object's rejection itself.
- `select sqlite_version()` is "not authorized" in Durable Object SQLite.
- Tests warn "Missing required secrets" even though `miniflare.bindings` supplies them; the
  bindings still apply.

### Test runner (@cloudflare/vitest-plugin 1.8.3)
- `cloudflareTest({ wrangler: { configPath }, miniflare: { bindings } })`: Miniflare options
  merge over the wrangler config (`NM/@cloudflare/vitest-plugin/dist/pool/index.mjs:78896`).
  The plugin resolves with the `workerd`, `worker`, `module`, `browser` conditions (:79183-79222).
- Durable Objects of the main worker run in the **same isolate and module graph** as the
  test file (`types/cloudflare-test.d.ts:8-10`), so a patched global `fetch` applies inside the
  object, and `runInDurableObject` callbacks share module state with it.
- Vitest `setupFiles` run inside workerd, once per test file, before the test file is
  imported (`NM/vitest/dist/chunks/run.CjdgFZiW.js:3426-3466`).
- Storage is fresh per test file only because Vitest's default `isolate: true` starts a new
  Miniflare per file. Tests in one file share it.
- `reset()` is exactly `workerdUnsafe.deleteAllDurableObjects()`
  (`dist/worker/lib/cloudflare/test-internal.mjs:829-831`). Whether it also tears down live
  instances is native workerd behaviour: to be checked by a test.
- `runDurableObjectAlarm(stub)` returns false without an alarm; otherwise it deletes the alarm
  and calls `alarm()`. `exports.default.fetch()` from `cloudflare:workers` replaces `SELF`.

### Telegram fake (@msw/cloudflare 0.2.0, msw 3.0.6)
- One function, `setupNetwork()`, returning msw's experimental `NetworkApi`: `enable()`,
  `disable()`, `configure()`, `use()` (prepends, so per-test handlers win), `resetHandlers()`,
  `listHandlers()`, `events`.
- `onUnhandledRequest` is gone in v3: `network.configure({ onUnhandledFrame: 'error' })`, only
  while disabled, makes an unexpected request reject (`msw/src/core/experimental/define-network.ts:136-153`).
- It patches the global `fetch` through `@mswjs/interceptors`' web build, which the plugin's
  `browser` condition selects.
- `https://api.telegram.org/bot:token/:method` matches a real token with a colon:
  `params = { token: '123456:AAH-x_Yz', method: 'sendMessage' }` (checked with msw's
  `matchRequestUrl`). Read the body with `await request.json()`; answer with `HttpResponse.json`.

### grammY 1.46.0 and auto-retry 2.0.2
- Wrangler's esbuild and the Vitest plugin both pick grammY's `web.mjs`; types come from the
  Node-flavoured `out/mod.d.ts` (`NM/grammy/package.json` exports).
- `new Bot(token, { botInfo, client: { timeoutSeconds } })` makes no `getMe` call;
  `handleUpdate` throws "Bot not initialized!" without `botInfo` (`bot.js:222-245`).
- The API client captures `fetch` in its constructor (`web.mjs:2802-2816`).
  `handleUpdate` builds a new `ctx.api` per update with a **snapshot of `bot.api`'s
  transformers** (`bot.js:230-234`), so a marker installed on `bot.api` covers `ctx.api` calls.
- Transformers: the **last installed is the outermost** (`core/client.js:91-95`). A marker
  installed after `autoRetry` runs once per call and sees the final result.
- Middleware errors reach `handleUpdate`'s caller wrapped in `BotError` (`.error`, `.ctx`);
  `bot.catch` has no effect on `handleUpdate` (`bot.js:378-385`).
- `GrammyError` carries `error_code`, `description`, `parameters.retry_after`, `method`;
  `HttpError` carries only `error`. A timeout rejects with
  "Request to '<m>' timed out after N seconds" via `setTimeout` (`web.mjs:2872-2880`).
- `bot.command('x')` matches `/x` and `/x@ourbot` (case-insensitive username) and ignores
  `/x@otherbot` (`context.js:22-64`); only message entities at offset 0 count.
- `ctx.from` of a tap is the presser; `ctx.msg` of a tap is the bot's own message.
- `new Api(token, { timeoutSeconds })` works standalone for `leaveChat`.
- auto-retry (`out/mod.js:36-89`): defaults are unbounded. `retry_after > maxDelaySeconds` returns
  the 429 at once (grammY throws it); `rethrowInternalServerErrors` returns a 5xx at once;
  `rethrowHttpErrors` rethrows network errors at once (otherwise their backoff is unbounded
  and doesn't count attempts). It sleeps even after the last allowed attempt, so the worst case
  with our caps is three 5 s sleeps. `retry_after: 0` retries without sleeping.

### Durable Object runtime
- `DurableObjectState`: `storage`, `blockConcurrencyWhile`; `storage.transactionSync(fn): T`;
  `storage.sql.exec(query, ...bindings)` returns a cursor with `toArray()`, `one()`, `raw()`.
  SQL `BEGIN`/`SAVEPOINT` is rejected: transactions go through `transactionSync`.

## Reuse
- grammY's `Api` (Worker `leaveChat`), `GrammyError` (permanent-error test), `BotError` (unwrap),
  `Composer`/`bot.command` (the `@otherbot` rule): no hand-written equivalents.
- msw's matcher for the Telegram URL; no hand-written routing in the fake.
- Nothing in the repo yet to extend.

## Testing-issue estimate
- **Fixtures:** none exist. The harness (deliverable 2) creates the Telegram fake and the update
  builders first, with a self-test, as the phase's shape says.
- **Size cap:** `chat-room.ts` would hold the queue, dedupe, the failure policy and the bot's
  lifecycle, well over 250 lines. Split out `chat/serial-queue.ts` (the promise chain),
  `chat/update-log.ts` (SQL for `processed_updates` and `failed_updates`) and
  `chat/failure-policy.ts` (the pure redeliver-or-not decision).
- **Two parsers of one setting:** the Worker and the object both need `ALLOWED_CHAT_ID`; the
  object also `BOT_INFO`. One `src/settings.ts` validates them, named, for both.
- **Pure logic to extract first:** the failure-policy decision (committed, delivered, error kind,
  attempts, first failure, now) is a pure function with an exhaustive table test.
- **Slow paths:** auto-retry's caps are testable without sleeping by answering `retry_after: 0`
  (count the calls) and `retry_after: 6` (no wait). The 10 s client timeout can't be waited
  for; try fake timers on a bot built in the test, else assert the bot's client options.
- **Shared object in Worker tests:** the Worker always addresses `ROOM_NAME`, so Worker tests
  share one object per file. `reset()` before each test must give a fresh instance, or a
  `features` swap won't reach a bot already built. Verify with the first Worker test.
- **Log assertions:** "logged at error level" is checked by spying on `console.error`.
