---
date: 2026-11-16
wave: 1
lens: implementation
slug: stack-hosting-state
brief: product-brief.md
---

# Recon Wave 1 — stack-hosting-state

*Source of record — do not edit. Distilled into the spec by `/spec create`.*

Greenfield: the repo holds only docs, so there is no code seam to locate. This wave
settled where the bot can run for free, what it is written in, and how its state and
timers stay correct. Three web-research agents read official docs, pricing pages and
library source on 2026-11-16; wave 0 (Telegram platform, prior art) was taken as given.
[unverified] = community source only. [server code] = read in Telegram's open-source
Bot API server (github.com/tdlib/telegram-bot-api, WebhookActor.cpp, Client.cpp);
Telegram does not promise production runs the same code.

## Verified

### Hosting at $0
Needs: receive every update, durable data, timed work at a set minute, GitHub deploy.
Load assumed: ≤500 updates a day plus timers.

- **Firebase cannot host it on Spark.** Cloud Functions, Cloud Scheduler and Cloud Tasks
  are Blaze-only; "Paid Google Cloud products are not available" on Spark
  (firebase.google.com/docs/projects/billing/firebase-pricing-plans).
  - Blaze links a Cloud Billing account, which "require[s] a payment method": a card on
    file is mandatory. This load is ~3% of Blaze's no-cost quota (2M invocations,
    400K GB-s a month; firebase.google.com/pricing).
  - Spend-cap budgets pause only Functions, App Hosting, AI Logic and Extensions; Firestore,
    Scheduler, Tasks and Artifact Registry are not capped (…/billing/avoid-surprise-bills).
  - Scheduler: 3 free jobs, then $0.10/job/month (…/functions/schedule-functions). Cloud Tasks:
    exact `scheduleTime`, ≤30 days ahead (…/functions/task-functions;
    docs.cloud.google.com/tasks/docs/quotas).
  - Min instances 0 means cold starts; a warm instance is billed, ~$3/month in the docs'
    example (…/functions/manage-functions). Runtimes Node 20/22.
  - Deploy: the CLI in GitHub Actions with a service account; no Git-push deploy (…/docs/cli).
- **Cloudflare Workers Free meets every need at $0** (developers.cloudflare.com/workers/platform/limits/, …/pricing/):
  - 100,000 requests/day, reset 00:00 UTC, then Error 1027. 10 ms CPU per request and per
    cron run; waiting on fetch or storage "does not count"; "some built-in flexibility" for
    occasional overruns, Error 1102 when consistently over. 128 MB memory.
  - Durable Objects on Free: SQLite-backed only; 100k requests and 13,000 GB-s a day; 5M rows
    read and 100k rows written a day; 5 GB total (…/durable-objects/platform/pricing/).
  - D1: 5M rows read, 100k written a day, 500 MB per database, 5 GB total (…/d1/platform/).
    KV: 1,000 writes/day, 1 write/s per key, eventually consistent (…/kv/platform/).
  - Cron Triggers: 5 per account, UTC, minute resolution; a config change takes ≤15 min to
    propagate and "Scheduled invocations can be missed until propagation completes"
    (…/workers/configuration/cron-triggers/). Whether cron runs count toward the 100k/day
    is not stated.
  - Queues on Free: 10,000 ops/day, `delaySeconds` ≤24 h, at-least-once (…/queues/).
  - Over a limit means errors, never a bill. Paid starts at $5/month.
  - Deploy: Workers Builds connects the GitHub repo; a push builds and deploys; 3,000
    build-minutes/month (…/workers/ci-cd/builds/).
  - Payment method at signup: not stated on any page read [open: Still open 1].
- **Supabase Free fits, with one structural risk.** 500 MB Postgres, 500k Edge Function
  invocations/month, 2 s CPU and 150 s wall time per function, pg_cron down to 1 s,
  deploy by GitHub Actions + CLI (supabase.com/pricing, …/docs/guides/functions/limits).
  A project pauses after a week without "sufficient user database activity"
  (…/guides/platform/free-project-pausing): a quiet holiday week stops the bot, and a
  paused database runs no cron. Its docs pages carry an instruction addressed to AI
  agents; both agents ignored it.
- **Always-on VMs all need a card:** Fly.io (~$2.34/month, waived under $5, the full bill
  charged at ≥$5; docs.fly.io/about/pricing), GCE e2-micro (billing account, US regions only;
  docs.cloud.google.com/free/docs/free-cloud-features), Oracle Always Free (card; idle
  reclamation matches a quiet bot; docs.oracle.com/…/freetier_topic-Always_Free_Resources.htm).
- **Dropped:** Deno Deploy ("will be sunset in April 2027", deno.com/deploy/pricing; announced
  2026-10-09 at deno.com/blog/cloudflare) · Vercel Hobby (cron once a day ±59 min) · Render
  (sleeps after 15 min, free Postgres expires after 30 days) · Koyeb (no free compute) ·
  PythonAnywhere (outbound allow-list, no scheduled tasks) · Netlify (credits; each deploy
  costs 15; projects pause when credits run out) · Railway ($1/month of credit).

### Language and framework
- Every MVP need (inline keyboards, answerCallbackQuery, editMessageText, mentions by id,
  `chat_member`) predates Bot API 7. The 10.x features within reach are disabled buttons
  (10.3) and ephemeral replies (10.3/10.4).
- **grammY** 1.46.0 (2026-08-26) covers Bot API 10.3; a 10.4 PR is open since 2026-11-12
  (github.com/grammyjs/grammY). 21 webhook adapters, incl. `cloudflare-mod`, `std/http`,
  `express`, `bun`, `hono` (src/convenience/frameworks.ts). Official hosting guides for
  Workers, Deno and Firebase (grammy.dev/hosting/…); Supabase's own Telegram example uses it.
  - `botInfo` config: "grammY will not attempt to make a `getMe` call" (grammy.dev/ref/core/botconfig).
  - Rejects `/cmd@otherbot`: `if (atTarget !== username) return false;` (src/context.ts).
  - Webhook adapter: `timeoutMilliseconds` 10,000, `onTimeout` default `'throw'`,
    `secretToken` (grammy.dev/ref/core/webhookoptions).
  - 429: the `@grammyjs/auto-retry` plugin sleeps and retries; the docs advise against
    proactive throttling (grammy.dev/advanced/flood, /plugins/auto-retry).
  - `chat_member` must be listed in allowed_updates; `chatMemberFilter` helper
    (grammy.dev/plugins/chat-members). No HTML-escape helper in core; `@grammyjs/parse-mode`
    builds entities.
  - Testing: transformers can "mock API requests during testing", plus `bot.handleUpdate()`;
    no official guide (grammy.dev/advanced/transformers).
- **node-telegram-bot-api v2** 2.4.0 (2026-11-09, Bot API 10.4): a from-scratch redesign three
  months old, with behaviour changes in minor releases; web-standard `webhookCallback`;
  built-in 429 retry (waits up to 60 s by default); rejects `/cmd@otherbot` since 2.3.0; no
  `botInfo` seed.
- **aiogram 3.32.0** (2026-11-15, Bot API 10.4): the only official testing page among the
  candidates (`feed_raw_update`), aiohttp-only webhook, no built-in retry; fits a VM only.
  **TelegramBots (Java) 10.3.0**: long polling, Javalin webhook, Spring Boot; fits a VM only.
- **Not shortlisted:** python-telegram-bot (released Bot API stuck at 10.0), Telegraf (no
  release since 2024-02, Bot API 7.1), pyTelegramBotAPI and telego's `CommandEqual` (both
  answer `/cmd@otherbot`).
- Only JS/TS has first-class adapters on the serverless shortlist (Workers, Supabase Edge);
  Python there needs hand-written glue.

### Telegram webhook delivery (core.telegram.org/bots/api unless marked)
- A non-2xx response makes Telegram repeat the request. Pending updates live ≤24 h. Webhook
  and getUpdates are mutually exclusive. `secret_token` (1–256 chars) arrives as
  `X-Telegram-Bot-Api-Secret-Token`. HTTPS on 443/80/88/8443. The response timeout is not
  documented. A method called inside the webhook response gives no success signal.
- `update_id` is unique and sequential, but after ≥1 week without updates the next one "is
  chosen randomly": a "highest id seen" check would drop real updates. Dedupe by remembered ids.
- [server code] One update in flight per queue. Queues are keyed by chat_id for messages and
  edits, by **the sender's user_id for callback_query**, by user_id for chat_member. With the
  default max_connections of 40, two members' taps arrive **in parallel**; typed messages in
  one chat arrive one at a time.
- [server code] No attempt limit (contradicting the docs' "give up after a reasonable amount of
  attempts"): backoff doubles to a random 60–120 s cap, and an update is dropped only on expiry:
  messages after 24 h, **callback_query after 150 s**. A message that keeps failing stalls that
  chat's later messages.

### State and timers
- **Durable Objects** (…/durable-objects/best-practices/rules-of-durable-objects/, …/api/sqlite-storage-api/):
  each named object is "single-threaded and cooperatively multi-tasked". Storage writes with
  no intervening await commit atomically; `transactionSync()` rolls back on throw. But an
  outbound `fetch()`, i.e. any Telegram call, opens the input gate "allowing other requests to
  interleave": a read-decide-write must not straddle an await. `blockConcurrencyWhile` around
  I/O is "an anti-pattern"; the docs prescribe a version check-and-set across awaits.
  - Alarms (…/api/alarms/): one per object (`setAlarm` replaces it), millisecond timestamp,
    "guaranteed at-least-once", retried up to 6 times with backoff from 2 s; only one `alarm()`
    runs at a time per object; "in rare cases, alarms may fire more than once". Each `setAlarm`
    costs 1 row written, each run 1 request. Precision is not documented.
  - In-memory state is lost on eviction after 70–140 s idle (…/concepts/durable-object-lifecycle/).
- **D1:** single-threaded; `batch()` runs statements sequentially and rolls back on error;
  auto-commit otherwise; no interactive transactions (…/d1/worker-api/d1-database/).
- **Firestore:** serializable transactions, pessimistic locks on server SDKs; the transaction
  function may run more than once. **Cloud Tasks:** at-least-once, dedupe by task id.
  **Cloud Scheduler:** may run a function twice at once.
- **Supabase:** `SELECT … FOR UPDATE` inside a Postgres function called via `rpc()`
  (supabase-js can't group queries in one transaction); pg_cron runs one instance of a job at a
  time; pg_net has a 2 s default timeout and no documented retries.
- **VM + SQLite:** one writer at a time (BEGIN IMMEDIATE); in-process timers die with the process.
- **Every durable timer on offer is at-least-once.** A start-time tag can go out twice unless
  the job records that it ran.

### Time zone
- Hosts run in UTC; on Workers, Date and Intl run with TZ=UTC (…/workers/development-testing/).
  `Temporal` is native in Node 26 (LTS since 2026-10-28), Deno ≥2.7, and on Workers behind the
  `temporal` compatibility flag, on by default only from compatibility date 2026-12-01
  (…/workers/configuration/compatibility-flags/). Firebase's Node 20/22 have none.
- Europe/Kyiv: tzdata is at 2026f; no rule change since 2022b (data.iana.org/time-zones/tzdb/NEWS).
  Temporal's default "compatible" disambiguation moves a gap time later and takes the earlier of
  an ambiguous time.

## Reuse
- **grammY** as the framework: its Workers adapter, `botInfo` seed, built-in `/cmd@otherbot`
  rejection, `chatMemberFilter`, transformers as the seam for faking outgoing calls,
  `bot.handleUpdate()` for feeding fake updates.
- **Cloudflare primitives** instead of hand-built ones: a Durable Object per chat as the
  serialization point (no locks to write), its SQLite storage for the roster, pools and event
  record, its alarm for timed work, Workers Builds for deploys from GitHub, Worker secrets for
  the bot token.
- **Telegram's own mechanisms:** `secret_token` to authenticate the webhook, `update_id` for
  dedupe, `allowed_updates` set explicitly (wave 0's list).

## Neighbors
None. `mvp` is the only spec and the repo has no code, so there are no code-map overlaps to check.

## Still open

Recon gaps (Wave 2):
1. Does Cloudflare Workers Free with SQLite Durable Objects need a card at signup? It decides
   Cloudflare vs Firebase.
2. Does a grammY handler fit 10 ms CPU, including cold-start module evaluation? How is startup
   CPU counted, and what script-size limit applies on Free?
3. grammY inside a Durable Object: any documented pattern for a Worker forwarding updates to a
   per-chat object, and how replies and edits behave across the input-gate interleave.
4. Do alarms survive deploys and class migrations? How are SQLite-backed classes declared and
   migrated under Workers Builds? What does local dev give for objects and alarms?

Left for execution (reading can't settle them):
- Whether a 6th mention in one message notifies (wave 0): test in the real chat, or send ≤5
  mentions per message.
- Whether edits count toward the 20-per-minute group limit (grammY cites an unofficial 20
  edits/min): irrelevant for seven people unless several pools churn at once.

Decisions surfaced for create (not recon gaps):
- Cloudflare Workers (no card, if gap 1 holds) vs Firebase Blaze (card on file, managed timers);
  Taras named Firebase as the example of free.
- One Durable Object per chat with SQLite vs D1 plus a once-a-minute cron sweep.
- Answer the webhook after processing (keeps Telegram's redelivery) vs an early 200 with
  `waitUntil` (faster; loses redelivery, and a crash loses the update).
- The group's time zone: Europe/Kyiv assumed; confirm.
- `/all` as one message with 6 mentions vs two messages, pending the live mention test.
