---
kind: decision
applies-to: [phase 2+]
created: 2026-11-16T19:06:25+02:00
---

# One bot, no dev bot

Taras, 2026-11-16: "робимо все через один бот, це ж просто пет проєкт". The bot `@pisikcs_bot`
serves both the friends' chat and the test group; `.dev.vars` and `.prod.vars` hold the same token
with different `ALLOWED_CHAT_ID`s.

A bot has one webhook. Before go-live (phase 5) local development costs nothing. After it, pointing
the webhook at a `wrangler dev` tunnel takes the bot out of the friends' chat until
`webhook <worker-url> --env .prod.vars` points it back, and commands sent meanwhile are lost. The
README (phase 4) says so next to the local-development steps.
