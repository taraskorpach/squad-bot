# Ledger Index (layout v1)

Warm cache for forward-propagating learnings. One row per ledger entry with its
`[applies-to]` scope tag. See `SKILL.md` for entry format and filtering rules.

## Gotchas
- `docs/specs/_ledger/gotcha-telegram-redelivery-stalls-chat.md` — [general] — a webhook update failing every delivery stalls the chat for 24 h; cap the 500s
- `docs/specs/_ledger/gotcha-wrangler-secrets-required-first-deploy.md` — [general] — secrets.required fails wrangler deploy until every listed secret is set
- `docs/specs/_ledger/gotcha-telegram-group-upgrade-changes-chat-id.md` — [general] — a basic group upgraded to a supergroup gets a new -100… chat id
- `docs/specs/_ledger/gotcha-auto-retry-unbounded-defaults.md` — [general] — auto-retry defaults are unbounded; HttpError backoff ignores maxRetryAttempts
- `docs/specs/_ledger/gotcha-wrangler-types-check-runtime-header.md` — [general] — a wrangler upgrade fails wrangler types --check until types are regenerated
- `docs/specs/_ledger/gotcha-msw3-unhandled-frame.md` — [general] — msw 3: set onUnhandledFrame 'error' before enable; onUnhandledRequest is gone
- `docs/specs/_ledger/gotcha-rpc-promise-expect-rejects.md` — [general] — settle a DO RPC call before asserting; expect().rejects fails the run
- `docs/specs/_ledger/gotcha-grammy-composer-command-returns-branch.md` — [general] — register the Composer, not what .command() returns: it drops the filter
- `docs/specs/_ledger/gotcha-do-sql-multi-statement-bindings.md` — [general] — DO SQLite: multi-statement exec takes no bindings; one exec per statement
- `docs/specs/_ledger/gotcha-feature-module-state-shared-across-objects.md` — [general] — per-chat memory goes on Room: feature modules are shared by every object
- `docs/specs/_ledger/gotcha-bundler-tsconfig-misses-node-type-stripping.md` — [general] — type-check files Node runs as .ts under nodenext + erasableSyntaxOnly
- `docs/specs/_ledger/gotcha-webhook-info-errors-only-after-delivery.md` — [general] — getWebhookInfo shows errors only after a delivery; probe the Worker yourself
- `docs/specs/_ledger/gotcha-wrangler-action-uses-installed-wrangler.md` — [general] — npm ci before wrangler-action, or it deploys with the latest wrangler 4
- `docs/specs/_ledger/gotcha-do-alarm-past-time-runs-now.md` — [general] — a DO alarm set in the past runs now; keep alarm tests' clocks in the future

## Principles
- `principle-actions-commit-through-update-room.md` — [phase 6, 7, 8] — pool actions from a handler commit via ctx.room, or the update isn't recorded
- `docs/specs/_ledger/principle-test-zone-windows-across-the-change.md` — [general] — test a Kyiv window with now and the boundary across a DST change

## Domain

## Decisions
- `decision-failure-policy.md` — [general, load-bearing] — 500 only before any commit or send, at most 3 times over 5 min
- `decision-timers-from-pools.md` — [phase 6, 7, 8] — the alarm reads open pools; no jobs table; failed actions retry 3×
- `decision-events-append-only.md` — [phase 3, 6, 9] — no unique index or kind CHECK; once-per-pool counting in queries
- `decision-one-bot.md` — [phase 2+] — one bot for chat and tests; a local tunnel takes it out of the chat
- `decision-tag-window.md` — [phase 3, 7] — /all and 🔔 tag at most once per 30 s; every /all counts (Taras)
- `decision-event-time-is-when-the-person-acted.md` — [phase 6, 9] — an event's at is its message's date for a command, the clock for a tap
- `decision-release-all-at-once.md` — [phase 5] — A, B and C tried in the test group, then live in one deploy (Taras)
- `decision-announcements-in-one-message.md` — [phase 5, 7, 8] — squad, draw and close messages aren't chunked; only tag messages are
- `decision-stats-all-time-only.md` — [phase 9] — /stats counts all time, one number per row; no month (Taras)

## Workarounds
- `workaround-phase-5-runs-on-feat-mvp.md` — [phase 5] — no branch held phases 1 and 4; feat/mvp takes in PR A
