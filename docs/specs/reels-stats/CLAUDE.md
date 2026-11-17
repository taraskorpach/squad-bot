---
created: 2026-11-17T17:02:05+02:00
updated: 2026-11-17T17:02:05+02:00
status: draft
area: [bot]
domain: [stats, shares]
scope: [feature]
related:
  - mvp: /stats, its event record and its boards come from its phases 3 and 9; this spec adds a board
---

# Reels Stats Spec

The bot counts the posts each person sends to the chat from Instagram (reels and posts), Threads,
TikTok and YouTube, all as one kind of event, and `/stats` gains a `🍿 Скидає контент` board:
each post once per person, from the day it ships. A post new to the chat gets a 👀 reaction. A
post the chat has already seen gets a reply: `🪗 Баян! Уже було — Олег, вчора о 21:40 → оригінал`.

The spec keeps the name Taras first gave it, reels. The code calls these events shares
(`src/shares/`, the event kind `share`).

## Files

| File | Purpose |
|------|---------|
| `design.md` | Decisions, what counts as a post, the board, the баян and 👀, copy, edge cases |
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
- `src/stats/` — the event record and the boards; `src/shares/` — the posts sent to the chat;
  `src/chat/schema.ts` — the migrations
