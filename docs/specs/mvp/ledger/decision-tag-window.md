---
kind: decision
applies-to: [phase 3, 7]
created: 2026-11-16T18:40:58+02:00
---

# /all and 🔔 tag at most once per 30 seconds; every /all still counts

Taras's answer to the one question the review of 2026-11-16 put to him.

- **The question:** Telegram allows a bot 20 messages a minute in a group. Each `/all` sends 1–2 messages, and the `/all` leaderboard invites spamming it. About ten calls a minute would silence the bot for up to a minute, and the pool cards and pings sent in that minute would fail.
- **Position A:** keep no cooldown, as in Taras's answer at create time ("Ні"). Retries cover cards and start pings; other messages in that minute are lost.
- **Position B (recommended, chosen):**
  - Count every `/all`, but tag at most once per 30 s; a repeat inside the window gets a 👌 reaction.
  - 🔔 works the same way per pool; a repeat gets the toast `Щойно нагадав — спробуй трохи згодом`.
- **Why B:** the joke (the count) stays whole, and the group limit can't silence the pools.
- **Mechanism:** the time of the last tagging is kept in memory. An evicted object has been idle for over a minute, so a lost value can only mean the window has passed.
  - Built in phase 3 as `ctx.room.throttle.claim(key, now, windowMs)` (`src/chat/throttle.ts`), one per `Room`: never in a feature module, which every object shares (`docs/specs/_ledger/gotcha-feature-module-state-shared-across-objects.md`).
  - `/all` claims the key `all`. `TAG_WINDOW_MS` sits in `src/members/all-handlers.ts` until 🔔 needs it too; 🔔 claims one key per pool.
  - Any `/all` reply opens the window, the "nobody to tag yet" one included.
- **Where:** `design.md` → *Decisions* (`/all`), *Toasts*, *Edge cases* (🔔); phases 3 and 7.
