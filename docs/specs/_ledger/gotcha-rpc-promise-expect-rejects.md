---
kind: gotcha
paths: [test/**]
created: 2026-11-16T22:38:45+02:00
seen-in: [mvp]
---

# Settle a Durable Object RPC call before asserting on it; never pass it to `expect(...).rejects`

`await expect(stub.method()).rejects.toThrow()` passes, but leaves an unhandled rejection behind, and Vitest then exits 1 with "Vitest caught N unhandled errors" while every test is green. Settle the call with `try { await call } catch (error) { … }` first, as `failureOf()` in `test/helpers/rooms.ts` does, and assert on the result. Always read `npm test`'s exit code, not only the pass count.

Evidence: a probe in workerd 1.20261116.1 with @cloudflare/vitest-plugin 1.8.3 ran the same rejecting RPC method three ways: through `expect(...).rejects` (exit 1, one unhandled rejection), through try/await/catch (exit 0) and as a method returning a value (exit 0). In the mvp, 11 such assertions kept CI red for seven commits while the filtered local output showed 108 passing tests. workerd also prints `uncaught exception … Uncaught (in promise)` for every rejected RPC call: that line alone is noise, not a failure.
