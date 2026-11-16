---
kind: gotcha
paths: [src/index.ts, src/chat/**]
created: 2026-11-16T18:40:58+02:00
seen-in: [mvp]
---

# A webhook update that fails on every delivery stalls the chat for up to 24 hours

Telegram retries a non-2xx webhook answer with no attempt limit, until the update expires: 24 h for messages, 150 s for button taps. It keeps one message per chat in flight, so every later message in that chat waits behind the failing one. Never answer 500 without a cap. Count failures per `update_id` in storage, outside the rolled-back transaction, then acknowledge with 200 once the cap is reached.

Evidence: research `docs/specs/mvp/research/2026-11-16-wave-1-stack-hosting-state.md` §Telegram webhook delivery (read in Telegram's open-source Bot API server, WebhookActor.cpp). The docs only say it gives up "after a reasonable amount of attempts". Button taps are queued per user, so they stall only that user. The mvp review found that an uncapped 500 would turn any deterministic bug, such as a plain INSERT hitting a unique index, into a dead chat.
