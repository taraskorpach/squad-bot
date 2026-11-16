---
kind: gotcha
paths: [src/bot.ts, src/index.ts, scripts/**]
created: 2026-11-16T22:11:25+02:00
seen-in: [mvp]
---

# Cap @grammyjs/auto-retry on every option, including `rethrowHttpErrors`

`autoRetry()` defaults to unbounded waits and attempts. Pass `maxRetryAttempts`, `maxDelaySeconds`, `rethrowInternalServerErrors: true` and `rethrowHttpErrors: true` together: network errors (`HttpError`) have their own backoff loop, 3 s doubling to an hour, that never counts against `maxRetryAttempts`, so only `rethrowHttpErrors` bounds them.

Evidence, from auto-retry 2.0.2 `out/mod.js`: defaults at :36-39; the `HttpError` loop at :49-68; the main loop at :69-89 sleeps before it checks the attempt count, so the worst case is one more sleep than the retries (with 2 retries and 5 s: three sleeps, about 15 s). A `retry_after` above `maxDelaySeconds` returns the 429 at once, and grammY throws it as a `GrammyError`. Install it on `bot.api` before any transformer that should see only the final result: grammY makes the last-installed transformer the outermost (`grammy/out/core/client.js:91-95`).
