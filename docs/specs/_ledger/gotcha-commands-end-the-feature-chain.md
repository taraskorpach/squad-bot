---
kind: gotcha
paths: [src/bot.ts, src/**/*-handlers.ts]
created: 2026-11-17T18:06:13+02:00
seen-in: [reels-stats]
---

# A command ends the feature chain: a feature that reads every message goes first and calls `next()`

grammY runs `FEATURES` in order, and a `.command()` handler that doesn't call `next()` is the last
feature its message meets. A feature that must see every message, such as `trackShares` counting
posts, sits first in `FEATURES` (`src/bot.ts`) and awaits `next()` before it commits, so the
command still runs and a command that fails leaves nothing of the listener's written.

Why it bites: a listener placed after the commands passes every test that builds its own feature
list (`roomWith([listener, command])`) and silently misses `/all глянь <link>` in production.
Guard the order with a test through `freshRoom()`, which runs the production `FEATURES`
(`test/shares/share-handlers.test.ts`, "is one of the bot's features, ahead of its commands").
