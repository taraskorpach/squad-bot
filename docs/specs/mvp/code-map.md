# Code Map — Squad Bot MVP

Load-bearing files this spec depends on or introduces. Only list files a new agent
needs to know exist to navigate the code — not every file that's touched.

## Introduced by this spec

| File | Role | Phase |
|------|------|-------|
| `src/index.ts` | Worker: secret check, `chatOf` routing, leaving foreign groups, 500 only when the object rejects | phases 2, 4 |
| `src/chat/chat-room.ts` | `ChatRoom`: settings, migrations, serial queue, dedupe, the failure policy's wiring; test seams `clock`, `random`, `features` | phase 2 |
| `src/chat/failure-policy.ts` | Pure redeliver-or-acknowledge decision and the 3-failures-over-5-minutes cap | phase 2 |
| `src/chat/room.ts`, `src/context.ts` | `Room` (storage + Telegram client, no grammY context) and `UpdateRoom` (`ctx.room`: `commit`, `write`, flags); the object's memory, `mentionChunk` and `throttle` | phases 2, 3 |
| `src/chat/throttle.ts` | `Throttle.claim(key, now, windowMs)`: at most once per window, per object, in memory | phase 3 |
| `src/bot.ts` | `createBot`: retry caps, 10 s timeout, delivered marker; member learning, then the gate, then `FEATURES`, then the catch-all for taps | phases 2, 3 |
| `src/chat/schema.ts` | Ordered migrations, append only: 1 the update log, 2 `members` and `events` | phases 2, 3 |
| `src/telegram.ts` | Import-free Telegram shapes shared with the setup script: `chatOf` (any update type), `isGroup`, `isInChat`, `isAdmin`, `personSending`, `sentAt`, `MESSAGE_FORMAT`, `HI_CALLBACK`, `WEBHOOK_SECRET_HEADER` | phases 2, 3, 4 |
| `src/members/roster.ts` | Pure: `presencesOf(update)` (who an update shows in or out), `tagTargets`; the `Member` type | phase 3 |
| `src/members/member-store.ts`, `src/members/member-handlers.ts` | `members` upsert and read; `learningMembers`, the idempotent write every update runs before the gate | phase 3 |
| `src/members/mentions.ts` | Pure: `escapeHtml`, `displayNames` (shared first names told apart), `mention`, `mentionsOf` (Ukrainian order), `chunk` | phase 3 |
| `src/members/all-handlers.ts` | `/all`; its local `attempt` keeps each Telegram call after a commit independent (extract it on a second use) | phase 3 |
| `src/stats/event-store.ts` | `EventKind` and `recordEvent`, the one writer of the append-only record | phase 3 |
| `src/texts.ts`, `src/welcome.ts` | The bot's Ukrainian (with `commandMenu`) and `compareNames`; `welcomeMessage({ isAdmin })`, which the setup script imports under Node (`.ts` imports, leaves only) | phases 3, 4 |
| `scripts/telegram-setup.ts` | The setup script's decisions, tested in workerd: `COMMAND_MENU`, `groupsIn`, `webhookSettings`, `deliveryError`, `probeRequest`, `probeProblem` | phase 4 |
| `scripts/configure-telegram.ts`, `scripts/tsconfig.json` | The Node shell (`discover`, `webhook`, `welcome`); nothing imports it. Typed with `nodenext` and `erasableSyntaxOnly`; `check` runs its `--help` under Node | phase 4 |
| `test/helpers/` | Telegram fake (`telegram.ts`), update builders incl. service messages and the seven people (`updates.ts`), object helpers incl. `failureOf` (`rooms.ts`) | phases 2, 3 |

## Existing files touched

| File | Why we care | Ledger |
|------|-------------|--------|

## External references

- Telegram Bot API: https://core.telegram.org/bots/api
- grammY: https://grammy.dev
- Durable Objects rules: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workers Vitest integration: https://developers.cloudflare.com/workers/testing/vitest-integration/
