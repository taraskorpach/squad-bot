# Code Map — Reels Stats

Load-bearing files this spec depends on or introduces. Only list files a new agent
needs to know exist to navigate the code — not every file that's touched.

## Introduced by this spec

| File | Role | Phase |
|------|------|-------|
| `src/shares/share-links.ts` | What counts as a post: one reader per platform, `postOf` and `postRefs` (`{platform}:{id}`) | 1 |
| `src/shares/share-handlers.ts` | `trackShares`: first in `FEATURES`, records one `share` event per post after the rest have run | 1 |
| `test/helpers/links.ts` | Test messages with the entities Telegram adds: links, a caption, a hidden link | 1 |
| `src/shares/share-format.ts` | The баян's words: `bayanText`, and `sentWhen` for today, yesterday or a date | 2 |

## Existing files touched

| File | Why we care | Ledger |
|------|-------------|--------|
| `src/chat/schema.ts` | Migration 6: `events.ref`, `events.message_id`, index on `(kind, ref)` | |
| `src/stats/event-store.ts` | `share` kind; `StatEvent.ref` and `messageId`; `firstEventAbout` (first by record order) | |
| `src/telegram.ts` | `messageLink`, moved from pools: `/pools` and the баян both link messages | |
| `src/kyiv-time.ts` | `fullDate` and `sameYear` for the баян's date | |
| `src/stats/stats-queries.ts` | `ONCE_FOR_EACH_POST`: each post once per person | |
| `src/bot.ts` | `trackShares` first in `FEATURES` | `gotcha-commands-end-the-feature-chain` |

## External references

-
