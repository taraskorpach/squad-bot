# Ledger Index (layout v1)

Warm cache for forward-propagating learnings. One row per ledger entry with its
`[applies-to]` scope tag. See `SKILL.md` for entry format and filtering rules.

## Gotchas
- `docs/specs/_ledger/gotcha-telegram-redelivery-stalls-chat.md` — [general] — a webhook update failing every delivery stalls the chat for 24 h; cap the 500s
- `docs/specs/_ledger/gotcha-wrangler-secrets-required-first-deploy.md` — [general] — secrets.required fails wrangler deploy until every listed secret is set
- `docs/specs/_ledger/gotcha-telegram-group-upgrade-changes-chat-id.md` — [general] — a basic group upgraded to a supergroup gets a new -100… chat id

## Principles

## Domain

## Decisions
- `decision-failure-policy.md` — [general, load-bearing] — 500 only before any commit or send, at most 3 times over 5 min
- `decision-timers-from-pools.md` — [phase 6, 7, 8] — the alarm reads open pools; no jobs table; failed actions retry 3×
- `decision-events-append-only.md` — [phase 3, 6, 9] — no unique index or kind CHECK; once-per-pool counting in queries
- `decision-tag-window.md` — [phase 3, 7] — /all and 🔔 tag at most once per 30 s; every /all counts (Taras)

## Workarounds
