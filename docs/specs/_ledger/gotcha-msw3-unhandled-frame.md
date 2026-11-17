---
kind: gotcha
paths: [test/setup.ts, test/helpers/**, vitest.config.mts]
created: 2026-11-16T22:11:25+02:00
seen-in: [mvp]
---

# msw 3 has no `onUnhandledRequest`: configure `onUnhandledFrame: 'error'` before enabling the network

With `@msw/cloudflare`'s `setupNetwork()`, an unexpected request only warns by default. Call `network.configure({ onUnhandledFrame: 'error' })` while the network is still disabled, then `network.enable()`; `configure` throws once the network is enabled. With 'error', a request no handler matches rejects the caller's `fetch`.

Evidence: msw 3.0.6 `src/core/experimental/define-network.ts:136-153` (configure only while disabled) and :199-203 (default 'warn'); `on-unhandled-frame.ts:46-73` ('error' rejects). `onUnhandledRequest` no longer exists in msw 3's source. Most guides predate v3. Also: `network.use()` prepends handlers, so per-test handlers win, and `resetHandlers()` goes back to the initial ones (`handlers-controller.ts:132-212`).
