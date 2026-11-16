---
date: 2026-11-16
wave: 2
lens: implementation
slug: cloudflare-fit
brief: product-brief.md
---

# Recon Wave 2 — cloudflare-fit

*Source of record — do not edit. Distilled into the spec by `/spec create`.*

Aimed at wave 1's four open gaps about the leading candidate: Cloudflare Workers Free,
grammY (TypeScript), one SQLite-backed Durable Object per chat with an alarm. Two
web-research agents, 2026-11-16. Paths starting with `/` are under
developers.cloudflare.com. [unverified] = community source only.

## Verified

### 1. No card (gap 1: closed)
- "Start building for free — no credit card required." (workers.cloudflare.com;
  cloudflare.com/developer-platform/products/durable-objects/ and …/products/d1/).
  "By default, users have access to the Workers Free plan." (/workers/platform/pricing/)
- "Durable Objects can now be used with zero commitment on the Workers Free plan"
  (/changelog/2025-04-07-durable-objects-free-tier/). Signup is email, password and an
  email check (/fundamentals/account/create-account/).
- Over a Free limit, "further operations of that type will fail with an error" until
  00:00 UTC (/durable-objects/platform/pricing/).

### 2. CPU and size (gap 2: bounded, not measured)
- Worker: 10 ms CPU per HTTP request and per cron run; network waits don't count. Rollover
  "allows rollover CPU time for requests below the CPU limit"; how much is undocumented
  (/workers/platform/limits/, /workers/observability/metrics-and-analytics/).
- Startup: the global scope must parse and execute "within 1 second" (raised from 400 ms on
  2025-10-10), or the deploy is rejected with error 10021. Whether startup CPU counts toward
  the first request's 10 ms: no statement found.
- Size: 64 MiB uncompressed; "There is no compressed size limit" (since 2026-09-04, so the
  3 MB Free limit in older guides is gone). 128 MB memory; 50 subrequests per request on Free.
- Durable Object CPU on Free: the limits table says "30 seconds (default)", configurable to
  5 min and reset per request; the FAQ says objects have "the same per invocation CPU limits
  as any Workers do" (/durable-objects/platform/limits/). Unresolved: plan for 10 ms.
- Cloudflare's own figure: the "average Worker uses approximately 2.2 ms". No measured numbers
  for grammY or any Telegram bot exist.
- Observing CPU on Free: dashboard "CPU Time per execution" (kept 3 months), Workers Logs field
  `$workers.cpuTimeMs`, outcome `exceededCpu`; `wrangler deploy` prints `startup_time_ms`.
  `wrangler tail` has no CPU field.

### 3. grammY inside a per-chat Durable Object (gap 3: workable, thin prior art)
| Prior art (★, last push) | Shape |
|---|---|
| github.com/kvazzie/reactive-tg-bot (0★, 2026-10-26) | grammY inside `ChatDO`; the Worker routes with `env.CHATS.getByName(chatId)`; RPC `handleUpdate(request)` returns `webhookCallback(this.#bot, "cloudflare-mod")(request)`; no `botInfo`, no secret check; half-wired |
| github.com/Minis233/cf-telegram-topic-bot (0★, 2026-11-14) | No framework; one object; secret check, then an early 200 with `waitUntil`; inside, an explicit promise queue runs every update serially; dedupes on `update_id` |
| github.com/mohetios/nekonymous (6★, 2026-07-16) | grammY per request in the Worker; objects as RPC storage and a Telegram outbox that returns `{status: "retry", delaySeconds}` instead of sleeping; a lease per `update_id`, and a duplicate still processing gets 503 + Retry-After |
| github.com/libnyanpasu/nyanpasu-group-bot PR #11 (0★) | request-scoped grammY Bot; state in D1; an object only as an alarm; waits for handlers before acking and rethrows so Telegram redelivers |
| grammy.dev/hosting/cloudflare-workers-nodejs (official) | the Bot is built per request in the Worker: `new Bot(env.BOT_TOKEN, { botInfo: JSON.parse(env.BOT_INFO) })` |

- grammY derives `ctx.chat` from `msg` (which ends with `callbackQuery?.message`),
  `myChatMember`, `chatMember`…; `ctx.chatId` is `ctx.chat?.id` (grammY src/context.ts).
- `cloudflare-mod` needs only a `Request`: it reads the JSON and the
  `X-Telegram-Bot-Api-Secret-Token` header, compares the secret in constant time, and resolves
  the response after `handleUpdate` finishes (src/convenience/frameworks.ts). Durable Object RPC
  accepts Request and Response (/workers/runtime-apis/rpc/), so it runs inside the object as is.
- Gates (/durable-objects/best-practices/rules-of-durable-objects/, /durable-objects/reference/glossary/,
  blog.cloudflare.com/durable-objects-easy-fast-correct-choose-three/):
  - "Input gates block new events (incoming requests, fetch responses) while synchronous
    JavaScript execution is in progress"; awaiting `fetch()` "opens the input gate".
  - The output gate holds outgoing `fetch()` calls and the response "until all storage writes
    relevant to the response have been confirmed"; a failed write discards them and restarts
    the object.
  - "Any series of write operations with no intervening `await` will automatically be submitted
    atomically." SQLite runs in the object's thread, so a request that interleaves sees earlier
    writes [inferred from /durable-objects/api/sqlite-storage-api/ and
    blog.cloudflare.com/sqlite-in-durable-objects/].
  - No source orders an object's outgoing fetches; requests "may still be processed
    out-of-order" (/workers/platform/storage-options/).
- Consequences, per those sources:
  - Read the pool, decide the seat, write it, with no await in between: one uninterrupted,
    atomic block. Safe.
  - `answerCallbackQuery` is a fetch: it waits for write confirmation, and awaiting it lets
    other taps run.
  - Two taps a moment apart: B runs while A awaits its edit, and each edit carries the text
    built when it was sent, so A's older text can land last. An edit that changes nothing
    returns 400 "message is not modified" [unverified].
- Webhook round trip:
  - Worker HTTP on Free: "No limit" on wall time while the client stays connected; `waitUntil`
    runs "up to 30 seconds after the response is sent" (/workers/runtime-apis/context/).
  - Worker → object: "No hard limit while the caller stays connected". A method keeps running to
    completion after its caller disconnects (workerd PR #8381, merged 2026-11-12; a community
    repro agrees [unverified]).
  - grammY `webhookCallback`: `timeoutMilliseconds` 10,000, `onTimeout` `"throw"`; on timeout it
    rejects while the handler keeps running (src/convenience/webhook.ts): a non-2xx, a
    redelivery, two runs of one update.
  - grammy.dev/guide/deployment-types warns both ways: slow acks get re-sent; an early 200
    processes updates "in parallel… This causes data loss!"
- 429 inside the object: `@grammyjs/auto-retry` sleeps with `setTimeout`, with `maxDelaySeconds`
  and `maxRetryAttempts` both Infinity by default; 5xx and network errors back off 3 s → 1 h
  (grammy.dev/plugins/auto-retry). The sleep holds no lock, so other taps run, but it keeps the
  request open, blocks hibernation, and a `retry_after` over ~10 s overruns `webhookCallback`'s
  timeout. grammY: on webhooks "you technically have to use a queue", or keep retries short and
  accept skips (grammy.dev/advanced/flood).
- grammY gotchas on Workers:
  - `handleUpdate` throws "Bot not initialized!" unless `botInfo` is set or `bot.init()` ran;
    errors rethrow as `BotError`; `bot.catch` doesn't apply on webhooks (src/bot.ts).
  - grammy.dev/hosting/cloudflare-workers returns `new Response(e.message)` from its catch:
    status 200, so failures are acked and never redelivered. Don't copy it.
  - The session plugin assumes "Telegram sends webhooks sequentially per chat"
    (grammy.dev/plugins/session); false for `callback_query` (wave 1).
  - The API client's `timeoutSeconds` defaults to 500, so a hung Telegram call can hold an object
    request ~8 min (src/core/client.ts). `canUseWebhookReply` is off by default.
  - Past breakage on Workers: 1.31.1 "Illegal invocation" (fixed in 1.31.2, Nov 2024); a Request
    type error (fixed in #828, Oct 2025).
  - `@grammyjs/storage-cloudflare` covers KV and D1; there is no Durable Object adapter.

### 4. Deploys, alarms, local dev (gap 4: closed by inference; verify once deployed)
- Declaring a SQLite class (since 2026-06-30, Wrangler ≥ 4.107.0): `"exports": {"ChatDO":
  {"type": "durable-object", "storage": "sqlite"}}` plus a `durable_objects.bindings` entry
  (/durable-objects/reference/durable-objects-migrations/). The legacy `migrations` array with
  `new_sqlite_classes` still works, but after one deploy with `exports` there is no way back.
  Free rejects KV-backed classes (`free_tier_requires_sqlite`).
- With `exports`: `wrangler versions upload` fails fast, gradual deployments are unsupported,
  and rollbacks cannot cross a class change. A `deleted` class drops all its data.
- Workers Builds' deploy command defaults to `npx wrangler deploy`, which applies class changes
  (/workers/ci-cd/builds/configuration/, /workers/versions-and-deployments/deployment-management/).
  Preview builds get their own objects and storage, don't inherit secrets, and are public by
  default (/workers/previews/).
- Alarms across deploys: no explicit statement. "alarm operations follow the same rules as other
  storage operations" (/durable-objects/api/alarms/); a code update resets in-memory state and
  "Any durable state already persisted with `ctx.storage` is not affected"
  (/durable-objects/observability/troubleshooting/); an update is deferred up to 300 s, then the
  object resets.
- Precision: alarms "will usually execute within a few milliseconds after the set time, but can be
  delayed by up to a minute due to maintenance or failures while failover takes place"
  (/durable-objects/api/sqlite-storage-api/#setalarm). One repro: an alarm moved earlier by a
  second `setAlarm` was sometimes held 19–58 s (github.com/iterate/do-alarm-held-repro) [unverified].
- A throwing `alarm()` is retried from 2 s, up to 6 times, only for the latest `setAlarm`; then it
  stays silent until `setAlarm` is called again; the docs advise catching and re-arming. After
  eviction the constructor runs before `alarm()`. 15 min wall time per run.
- Local dev: objects run locally (state in `.wrangler/state`); Miniflare always enables alarms;
  alarms can stop after a hot reload until `wrangler dev` restarts (known issue, workerd #3566,
  "by-design"). `runDurableObjectAlarm(stub)` fires an alarm in tests
  (/workers/testing/vitest-integration/test-apis/).
- `wrangler dev --tunnel` (since 2026-05-18) gives a random `*.trycloudflare.com` HTTPS host,
  no account needed, for testing a webhook; `--tunnel-name` gives a stable one. One webhook per
  bot token, and a webhook excludes getUpdates (wave 1): local dev needs its own bot token.
- Logs on Free: until 2026-11-30, 200,000 events/day kept 3 days; from 2026-12-01, 0.5 GB/day
  shared by Logs, Traces and Issues, kept 7 days, ingestion stopping at the cap until 00:00 UTC
  (/observability/pricing/). 256 KB of logs per request. `wrangler tail` is live and includes
  Durable Object logs.

## Reuse
- Cloudflare: the no-card Free plan; an `exports`-declared SQLite Durable Object; alarms, fired in
  tests with `runDurableObjectAlarm`; Workers Builds from GitHub; `wrangler dev --tunnel` for a dev
  bot's webhook; the dashboard's CPU metrics and `$workers.cpuTimeMs` to measure.
- grammY: `webhookCallback(bot, "cloudflare-mod")` runs inside the object unchanged; `botInfo`
  removes the cold-start `getMe`; `ctx.chatId` covers messages, button taps and member updates.
- Patterns from prior art: a per-object promise queue that runs each update to the end before the
  next (cf-telegram-topic-bot); an `update_id` record for dedupe (cf-telegram-topic-bot,
  nekonymous); waiting for handlers before acking and rethrowing so Telegram redelivers
  (nyanpasu PR #11).

## Still open
Implementation is locked. These need a run, not more reading:
- CPU per update on the deployed bot (Worker and object), read from the dashboard on the first deploy.
- That an alarm set before a deploy still fires after it.
- Whether a 6th mention in one message notifies, and whether Telegram applies two edits in the
  order sent.

Decisions surfaced for create, added to wave 1's list:
- Where grammY runs: inside the per-chat object (one serialization point, thin prior art) vs per
  request in the Worker with the object as RPC storage (the official guide's shape).
- Inside the object: an explicit queue that runs each update to the end, Telegram calls included
  (no interleaving, edits in order) vs synchronous writes plus re-rendering stale edits.
- 429 policy: auto-retry with short caps vs no retry vs an outbox driven by the alarm.
- Durable Object config: `exports` (current, one-way) vs the legacy `migrations` array.
