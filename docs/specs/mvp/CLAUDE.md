---
created: 2026-11-16T13:56:26+02:00
updated: 2026-11-16T22:40:08+02:00
status: active
area: [bot, infra]
domain: [mentions, pools, stats]
scope: [feature]
---

# Squad Bot MVP Spec

A Telegram bot for one group chat of seven friends: `/all` tags everyone, `/pool` gathers players
for a game on one live card with buttons, and `/stats` keeps the group's running jokes as
leaderboards. TypeScript and grammY on Cloudflare Workers Free, with one SQLite Durable Object
per chat.

## Files

| File | Purpose |
|------|---------|
| `seed.md` | Origin record: Taras's ask in his own words and the first UX decisions |
| `product-brief.md` | Business intent from prep |
| `design.md` | Product & UX spec — decisions, flows, chat mockups, final copy, edge cases |
| `technical.md` | Contracts, data model, timers, configuration, testing, file tree |
| `progress.md` | Thin index of phases (checkboxes + pointers) |
| `pr-opening.md` | PR-readiness gate — spec state + pre-PR checks (not a phase) |
| `code-map.md` | Load-bearing files inventory |
| `phases/` | Per-phase detail — one entry per phase, flat file or folder |
| `ledger/INDEX.md` | Forward-propagating learnings — scan here first |
| `in-flight/` | Ephemeral pending state, one file per phase (on-demand) |
| `reviews/` | Collegium review snapshots (on-demand) |
| `research/` | Prep recon: Telegram platform, prior art, hosting and state, Cloudflare fit, craft |

## Relationship to code

This spec is a *design document*, not a live mirror. For ground truth once code exists:
- `/CLAUDE.md` — project conventions: Ukrainian in the chat, English in code and docs
- `README.md` — the go-live and local-development runbook (phase 4)
- `wrangler.jsonc` — bindings, secrets, variables and compatibility flags
