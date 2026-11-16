---
date: 2026-11-16
phase: 3
chunk: /domikpisik and the welcome (deliverables 6–7)
inputs: [phases/phase-3-members-and-all.md, research/phase-3/2026-11-16-domikpisik-and-welcome-recon.md, principles.md]
---

# Phase 3 preflight — /domikpisik and the welcome

*Source of record — do not edit.*

Self-scaled: the chunk adds two small features on chunk 1's mechanisms, and chunk 1's preflight
already covered the canon for this phase. Only what is new here.

## Findings that change the plan

1. **"👋 upserts the presser" is already done by member learning.** A tap is a sighting
   (`src/members/roster.ts`, `presencesOf`), and learning runs before the features
   (`src/bot.ts`, `createBot`). The 👋 handler only answers with its toast; a second upsert there
   would be a second writer of the same fact.
2. **A third copy of "message date in ms" is about to appear.** `flaggingStale` and `/all` each
   compute `date * 1000` (`src/bot.ts`, `src/members/all-handlers.ts:23`), and `/domikpisik`
   would make three. Extract `sentAt(message)` into `src/telegram.ts` first, as its own refactor
   commit with a test (principles.md §8–9).

## Canon, briefly

| Rule | Verdict | Concrete consequence |
|---|---|---|
| SRP | Bites | The welcome feature (`on('my_chat_member')` and the 👋 toast) gets its own module, `src/members/welcome-handlers.ts`; `member-handlers.ts` stays the learning step |
| Single source of truth | Bites | The welcome's instruction line builds `«👋 Я тут»` from the button label |
| Command/query separation | Inert | |
| Errors | Bites | The welcome send has nothing committed before it: let a failure propagate, so the failure policy redelivers a 5xx and acknowledges a 4xx. No local catch |
| Ordering | Bites | Each feature that answers a tap must not call `next()`, or the catch-all answers it a second time; grammY's `callbackQuery` handler doesn't |

## Amendments

1. `sentAt(message)` in `src/telegram.ts`, used by the stale flag and both commands.
2. The 👋 handler answers only; learning saves the presser.
3. The welcome feature lives in `src/members/welcome-handlers.ts` (`welcoming`).

## Defaults applied

- `HI_CALLBACK` is `'hi'`, far under Telegram's 64 bytes and apart from the pools' `p:` prefix.
- `welcomeMessage` returns the text and the complete send options (`MESSAGE_FORMAT` plus the
  keyboard), so the setup script and the bot send the same message.

## Forks for you

None.
