---
date: 2026-11-16
phase: 2
chunk: scaffold, harness, worker, migrations, once-and-in-order (with 6–8 in view)
inputs: [phases/phase-2-skeleton-and-webhook.md, technical.md, research/phase-2/2026-11-16-scaffold-recon.md, principles.md]
---

# Phase 2 preflight — scaffold to once-and-in-order

*Source of record — do not edit.*

Greenfield: no code exists, so the anchors are the plan's own lines, the recon note, and the
installed library sources it cites (`NM/` = the probe's `node_modules/`). A second probe in
workerd 1.20261116.1 settled two of the recon's open checks:

- One `sql.exec` string with two `CREATE TABLE` statements runs both. A failing second
  statement inside `transactionSync` rolls the first back too, so a migration can be one string.
- `INSERT … ON CONFLICT (id) DO UPDATE SET n = n + 1 RETURNING n, t` returns the updated row
  (the `failed_updates` counter in one statement).
- After `reset()`, the same name gives a fresh instance: in-memory fields start over. Worker
  tests can `reset()` before each test and then set `features` on the new instance.

## Findings that change the plan

1. **Biome would check the generated types.** `phase-4-setup-and-deploy.md:16` puts
   "`biome.json` (ignore `worker-configuration.d.ts`)" in phase 4. But phase 2 commits that
   ~14,000-line generated file (`phase-2-skeleton-and-webhook.md:18`, guidance on the scaffold),
   and deliverable 1 needs `npm run check`, which starts with `biome check .`
   (`technical.md:415`). The ignore has to land with the scaffold. Phase 4's line goes.
2. **The file list can't hold the object under the size cap.** `phase-2-skeleton-and-webhook.md:20-21`
   gives `chat/` three files, so `chat-room.ts` would carry the queue, dedupe, the failure policy,
   settings and the bot's lifecycle. That is over 250 lines (principles §5), and the policy is
   pure logic tangled into the class (principles §3). The plan needs `src/settings.ts`,
   `src/chat/serial-queue.ts`, `src/chat/update-log.ts` and `src/chat/failure-policy.ts`, with
   their tests.
3. **The auto-retry worst case is stated loosely.** `technical.md:346` says the worst case "stays
   well inside one update's processing". auto-retry sleeps before checking the attempt count
   (`NM/@grammyjs/auto-retry/out/mod.js:69-89`), so with 2 retries and 5 s it can sleep three
   times: about 15 s for one call that keeps getting 429s. Network errors are rethrown at once
   only because of `rethrowHttpErrors`; without it their backoff ignores `maxRetryAttempts`
   (`mod.js:49-68`). The design still holds (the Worker's call to the object has no hard limit
   while connected, wave 2 §3); the sentence should give the number.
4. **The per-type `chatIdOf` test can go blind.** `technical.md:58` wants a test that every
   `ALLOWED_UPDATES` type yields a chat id, so a new type can't drop updates silently. A test that
   loops over its own list of example updates passes when someone adds a type to
   `ALLOWED_UPDATES` and forgets the example. The examples must be a
   `Record<AllowedUpdate, …>` (the compiler demands every type) and the test must loop over
   `ALLOWED_UPDATES` itself.

## Clean Code against the chunk

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Intention-revealing names | Bites | `Room` (storage + api for any write path), `UpdateRoom` (`ctx.room`, one update's wrapper with `commit`, `write`, flags), `ChatRoom` (the object). `Chat` stays unused: grammY's type |
| One word per concept | Bites | "commit" only for the non-idempotent write that records the update; "write" only for idempotent ones (`technical.md:84-89`); never "save" |
| Small functions, one level | Bites | `ChatRoom.handleUpdate` queues; a private `#process` runs dedupe → bot → record; the redeliver decision is `failure-policy.ts`'s, not inline branches |
| No flag arguments | Bites | `shouldRedeliver` takes one plain record (`committed`, `delivered`, `permanent`, `attempts`, `firstFailedAt`, `now`), not positional booleans |
| Command/query separation | Bites | `recordFailure` returns the counter row (UPSERT `RETURNING`): one statement, a query result from a command, kept because it must be atomic; named for the command |
| Errors over codes | Bites | grammY's `BotError` wraps middleware errors (`NM/grammy/out/composer.js:12-21`): unwrap `.error` once, then classify `GrammyError` 4xx-but-429 as permanent |
| Null handling | Bites | `chatIdOf` returns `number \| undefined` for updates without a chat (inline callbacks); the Worker answers 200 on undefined |
| Boundaries: wrap third-party | Bites | grammY is the locked framework: no wrapper over `Bot`/`Api`; `src/bot.ts` is the single place that configures it (timeout, auto-retry, marker) |
| Learning tests | Bites | the harness self-test doubles as the learning test for msw's matcher and grammY's error types |
| TDD, F.I.R.S.T | Bites | auto-retry tests answer `retry_after: 0` and `6` so nothing sleeps; the clock is injected for the 5-minute cap |
| Comments | Inert | none planned |
| Simple design (Beck) | Bites | no `random` consumer until phase 7, but `phase-7-pool-buttons.md:20-21` says "the object passes its `random`": the seam is a contract of this phase, kept minimal |

## Clean Architecture against the chunk

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Dependency rule | Bites | `technical.md:44` says `chat/` imports no feature, yet `technical.md:76` defaults `features` to `src/bot.ts`'s list. The only allowed edge out of `chat/` is `chat-room.ts → bot.ts`; never a feature module |
| Policy vs detail | Bites | the failure policy is policy: a pure module that knows neither SQL nor grammY; `update-log.ts` is its storage detail |
| Humble Object | Bites | the Durable Object and the Worker are humble shells tested through `runInDurableObject` and `exports.default.fetch`; their decisions (`chatIdOf`, `isInChat`, `shouldRedeliver`, settings) are pure and table-tested |
| Crossing boundaries with data | Bites | the Worker passes the parsed `Update` over RPC (structured clone), never a grammY `Context` |
| Component coupling, no cycles | Bites | `chat-room → bot → context → chat/room, chat/update-log`; nothing imports `chat-room` but `index.ts`. Keep `context.ts` free of `chat-room` imports |
| Screaming architecture | Inert | `chat/` + feature folders already decided (`design.md:69`) |
| Tests as outer circle | Inert | test seams are plain public fields read lazily; no test-only branches |

## SOLID against the chunk

| Rule | Verdict | Concrete consequence |
|---|---|---|
| SRP (actors) | Violated, fix here | three actors would meet in `chat-room.ts`: the runtime (RPC, constructor), the delivery protocol (dedupe, cap) and Telegram's client policy (retry caps, timeout). Split as finding 2; client policy lives in `bot.ts` |
| OCP | Bites | the next variants are phase 3's member learning before the gate and phase 8's alarm task in the same queue: `createBot` takes the features list, and the queue takes any task |
| LSP | Inert | no subtypes |
| ISP | Bites | features see `ctx.room` (`commit`, `write`, flags), not the object or `Room`'s storage handle |
| DIP | Bites | `Room` names grammY's concrete `Api` (`technical.md:86`): acceptable, grammY is the locked framework, and the alarm needs exactly that client |

## DDD against the chunk

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Ubiquitous language | Bites | "update", "redelivery", "committed", "delivered", "stale" as in `technical.md:92-113`; Ukrainian copy doesn't appear in this phase |
| Invariant ownership | Bites | "an update id is processed once" is owned by `update-log.ts` (`processed_updates`), written only through `ctx.room.commit` or the end-of-task record |
| Aggregates, repositories, events | Inert | no domain model in this phase; the "don't build a repository" rule (craft §Don't build 1) holds: SQL stays synchronous in named functions |

## Guard blindness

- `wrangler types --check` (`technical.md:415`) compares only the env hash and the runtime header
  (`NM/wrangler/wrangler-dist/cli.js:214298-214376`). It catches a stale binding or flag, and also
  a wrangler upgrade, which changes the workerd version in the header. It is not blind; it is
  noisy on upgrades (project lesson).
- The per-type `chatIdOf` test: finding 4.
- `biome check .` without an ignore list would cover the generated file: finding 1. With
  `files.includes` too narrow it would skip `test/`: the include list must name `src`, `test`
  and the root config files.
- `vitest.config.mts` is typechecked by neither tsconfig (root includes `src/**`, test includes
  `test/**`); Biome still lints it.

## Seam and testability (deltas from the recon)

- Resolved: `reset()` gives a fresh instance (probe), so Worker tests can swap `features`.
- Resolved: one migration can be one SQL string; it rolls back whole.
- New: finding 1 (Biome and the generated file).
- New: tests read the fake secrets from `env` (one source, `vitest.config.mts`), so helpers never
  restate `BOT_INFO` or `ALLOWED_CHAT_ID`.
- New: the 10 s timeout is tested on a bot built inside the test with Vitest fake timers
  (grammY's timeout is a `setTimeout`, `NM/grammy/out/web.mjs:2872-2880`), not through the object.

## Amendments

1. `biome.json` ignores `worker-configuration.d.ts` in the scaffold commit; strike it from
   phase 4's *Files to touch*.
2. Add to phase 2's *Files to touch*: `src/settings.ts`, `src/chat/serial-queue.ts`,
   `src/chat/update-log.ts`, `src/chat/failure-policy.ts`; `test/settings.test.ts`,
   `test/bot.test.ts`, `test/chat/schema.test.ts`, `test/chat/serial-queue.test.ts`,
   `test/chat/failure-policy.test.ts`.
3. `technical.md` → *Telegram calls*: state the worst case as about 15 s for one call that keeps
   getting 429s (three sleeps of up to 5 s), and that `rethrowHttpErrors` is what bounds network
   errors.
4. `test/telegram.test.ts` builds one example per type through a `Record<AllowedUpdate, …>` and
   loops over `ALLOWED_UPDATES`.
5. `failed_updates` is counted with one UPSERT … `RETURNING attempts, first_failed_at`, in its own
   `transactionSync` after the failed one rolled back.

## Defaults applied

- Settings are checked before migrations in the constructor (pure and cheap, fails before
  touching storage); `technical.md:69-70` lists them the other way round, with no reason.
- `API_TIMEOUT_SECONDS = 10` lives in `src/telegram.ts`, shared by the bot and the Worker's
  `leaveChat` client.
- Formatting: Biome with tabs and single quotes (C3's style), line width 100.
- `vitest.config.mts` stays out of `tsc`; Biome lints it.

## Forks for you

None.
