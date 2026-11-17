---
date: 2026-11-17
phase: 6
chunk: migration, pure modules and /pool (deliverables 1–5)
inputs: [phases/phase-6-pools-core.md, technical.md, design.md, ledger/principle-actions-commit-through-update-room.md]
---

# Phase 6 recon — migration, pure modules and /pool

*Source of record — do not edit.*

A direct read of every module the pools build on. The same session wrote phases 4's code and had
read most of these already, so there was no agent wave.

## The seam

- **Tree.** `feat/mvp-pr-b` is cut from `feat/mvp-pr-a` at `40b0e9a`. PR A isn't merged (it
  merges inside phase 5), and phase 6 builds on its code. So PR B is stacked on PR A.
- **`src/chat/schema.ts:16-57`** holds two migrations in an append-only list. Migration 3 is the
  third entry. Multi-statement SQL is fine there, because it binds nothing.
- **Rooms.**
  - `Room` (`src/chat/room.ts:17-58`) has `tx`, `write`, `clock`, `random`, `chatId`,
    `mentionChunk`, `api` and `throttle`.
  - `UpdateRoom` (`src/context.ts:12-72`) has `commit`, `write`, `clock`, `mentionChunk` and
    `throttle`, but no `tx`, `chatId`, `api` or `random`.

  The ledger principle wants actions written against one interface that both satisfy, with
  `tx` meaning `commit` on the update's room.
- **Events.** `EventKind` is `'all' | 'domikpisik'` (`src/stats/event-store.ts:5`).
  `recordEvent` writes no `pool_id` (:15-21), though the column exists (`schema.ts:51`).
- **Members.**
  - `membersInChat` (`member-store.ts:32-39`) reads only members in the chat. The card also
    needs the names of people who answered and then left.
  - `displayNames` (`mentions.ts:13-22`) tells shared first names apart.
  - `mentionsOf` (:30-36) links and sorts by name.
  - `chunk` (:39-45) and `escapeHtml` (:5-7) are reusable as they are.
- **`/all`'s shape** is the model for a command (`all-handlers.ts:19-39`):
  - the commit returns what the handler needs, with no await;
  - `ctx.room.stale` stops it after the commit;
  - the replies use `MESSAGE_FORMAT` and `reply_parameters` with `allow_sending_without_reply`;
  - each call goes through a local `attempt` (:49-55). The code map says to extract `attempt`
    on its second use, and the pools are that use.
- **The bot** (`src/bot.ts:12, 52-54`): `FEATURES` comes before the catch-all that answers any
  tap left unanswered. A feature that answers a tap must not call `next()`.
- **Stale.** `flaggingStale` (`bot.ts:81-86`) marks a message more than 10 minutes old. A tap has
  no date and is never stale.
- **Telegram types.** `InlineKeyboardButton.style` is `"danger" | "success" | "primary"`
  (`@grammyjs/types/markup.d.ts:149`). `Intl.PluralRules('uk')` gives `one` for 1 and 21, `few`
  for 2–4 and 22, and `many` for 5–20 and 25.
- **The tests' harness** (`test/helpers/rooms.ts`, `telegram.ts`, `updates.ts`):
  - `roomWith(features, { clock })` and `rows(stub, sql)`.
  - The Telegram fake answers every method with `true`, and `sendMessage` returns a message
    with an increasing id. `telegram.fail(method, failure)` makes the next call fail.
  - `command(text, { from, date })` builds a command; `tap(data, { from, messageId })` a tap.
    There is no reply builder: the fields `reply_to_message` and `serviceMessage` extend messages.

## Reuse

- `escapeHtml`, `displayNames`, `mention`, `chunk`, `MESSAGE_FORMAT`, `sentAt`, `recordEvent`
  and `compareNames`.
- `attempt` moves to `src/chat/attempt.ts` for `/all` and the pools.
- A plural helper goes in `src/texts.ts` on `Intl.PluralRules('uk')`, for `місце`, `місця` and
  `місць`.

## Testing-issue estimate

- **The pure modules take time as arguments.**
  - `pool-args` takes the message's date.
  - `pool-format` takes `now`.
  - `kyiv-time` needs native `Temporal`, which the `temporal` flag in `wrangler.jsonc` turns on
    in the tests too. Its DST cases use fixed instants: 2026-03-29 and 2026-10-25 in Kyiv.
- **Object tests drive `/pool` and taps through `roomWith([pooling])`.**
  - Members become known by writing a message first, as `/all`'s tests do (`all-handlers.test.ts:25-29`).
  - "Two taps for the last seat" sends both without awaiting either: the serial queue orders them.
- **Size.**
  - `test/helpers/updates.ts` is at 220 lines. A reply builder there would push it near the
    cap, so pool tests build replies with `serviceMessage`-style fields, or the reply option
    goes in a few lines.
  - The pool handlers and callbacks are split by trigger, so each file stays well under 250.
