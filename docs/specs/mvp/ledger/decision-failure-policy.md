---
kind: decision
applies-to: [general, load-bearing]
created: 2026-11-16T18:40:58+02:00
---

# Redeliver only what can't duplicate, and only three times

An update's error answers 500, so Telegram redelivers it, only when all three hold:
- nothing was committed and nothing reached Telegram;
- the error isn't a permanent Telegram 4xx;
- the update hasn't yet failed 3 times with its first failure at least 5 minutes ago.

Every other failure is logged, recorded as processed, and answered 200.

- **Why the cap:** Telegram has no attempt limit and queues messages per chat. One update that fails on every delivery would hold every later message in the chat for up to 24 h (research wave 1). Four of five reviewers found the uncapped 500 independently.
- **Why "nothing committed or delivered":** after a commit, the dedupe skips the redelivery anyway. After a send, a redelivery would send again (two 🔔 chunks, a second toast). The boundary is whichever comes first: the first commit, or the first successful Telegram call (a transformer sets `delivered`).
- **Why 5 minutes:** a deploy resets the object and fails the updates in flight, and those must still get their redelivery.
- **Rejected:**
  - Storage errors uncapped: a deterministic constraint violation is exactly the stall.
  - Telegram 5xx and 429 always answering 500: after a partial send, they would duplicate it.
- **Where:** `technical.md` → *Processing one update*; `failed_updates` in migration 1; phase 2.
- **Source:** `reviews/2026-11-16-failure-paths-and-go-live.md` (R1).
