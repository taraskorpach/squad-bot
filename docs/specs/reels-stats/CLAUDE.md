---
created: 2026-11-17T17:02:05+02:00
updated: 2026-11-17T17:02:05+02:00
status: draft
area: [bot]
domain: [stats, reels]
scope: [feature]
related:
  - mvp: /stats, its event record and its boards come from its phases 3 and 9; this spec adds a board
---

# Reels Stats Spec

The bot counts the Instagram reels each person sends to the chat, and `/stats` gains a
`🎬 Рілси` board: each reel once per person, from the day it ships. A reel new to the chat gets a
👀 reaction. A reel the chat has already seen gets a reply: `🪗 Баян! Уже було — Олег, вчора о
21:40 → оригінал`.

## Files

| File | Purpose |
|------|---------|
| `design.md` | Decisions, what counts as a reel, the board, the баян and 👀, copy, edge cases |
| `technical.md` | Migration 6, the link matcher, the feature's flow, files and tests |
| `progress.md` | Thin index of phases (checkboxes + pointers) |
| `pr-opening.md` | PR-readiness gate — spec state + pre-PR checks (not a phase) |
| `code-map.md` | Load-bearing files inventory |
| `phases/` | Per-phase detail — one entry per phase, flat file or folder |
| `ledger/INDEX.md` | Forward-propagating learnings — scan here first |
| `in-flight/` | Ephemeral pending state, one file per phase (on-demand) |
| `reviews/` | Collegium review snapshots (on-demand) |
| `research/` | Deep research output snapshots (on-demand) |

## Relationship to code

This spec is a *design document*, not a live mirror. For ground truth:
- `/CLAUDE.md` — Ukrainian in the chat, English in code and docs
- `docs/specs/mvp/design.md` — `/stats`, its boards and what the bot stores, which this spec extends
- `src/stats/` — the event record and the boards; `src/chat/schema.ts` — the migrations
