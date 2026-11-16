# Code Map — Squad Bot MVP

Load-bearing files this spec depends on or introduces. Only list files a new agent
needs to know exist to navigate the code — not every file that's touched.

## Introduced by this spec

| File | Role | Phase |
|------|------|-------|
| `src/index.ts` | Worker: secret check, `chatIdOf` routing, leaving foreign groups, 500 only when the object rejects | phase 2 |
| `src/chat/chat-room.ts` | `ChatRoom`: settings, migrations, serial queue, dedupe, the failure policy's wiring; test seams `clock`, `random`, `features` | phase 2 |
| `src/chat/failure-policy.ts` | Pure redeliver-or-acknowledge decision and the 3-failures-over-5-minutes cap | phase 2 |
| `src/chat/room.ts`, `src/context.ts` | `Room` (storage + Telegram client, no grammY context) and `UpdateRoom` (`ctx.room`: `commit`, `write`, flags) | phase 2 |
| `src/bot.ts` | `createBot`: retry caps, 10 s timeout, delivered marker, the gate before `FEATURES` | phase 2 |
| `src/chat/schema.ts` | Ordered migrations, append only | phase 2 |
| `test/helpers/` | Telegram fake (`telegram.ts`), update builders (`updates.ts`), object helpers incl. `failureOf` (`rooms.ts`) | phase 2 |

## Existing files touched

| File | Why we care | Ledger |
|------|-------------|--------|

## External references

- Telegram Bot API: https://core.telegram.org/bots/api
- grammY: https://grammy.dev
- Durable Objects rules: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workers Vitest integration: https://developers.cloudflare.com/workers/testing/vitest-integration/
