---
date: 2026-11-17
phase: 2
chunk: phase-2 (all five deliverables)
lens: execute-recon
---

# Phase 2 recon — the баян and 👀

*Source of record — do not edit.* Inline, in the session that built phase 1.

## The seam

- `src/shares/share-handlers.ts` (phase 1): the commit that records the shares; the lookup goes
  inside it, before the inserts, and the answers after it.
- `src/stats/event-store.ts`: `firstEventAbout` beside `hasEventNear` and `recordEvent`.
- `src/pools/pool-messages.ts:162-165` `cardLink`, used at `:171` (`listedLine`) and tested at
  `test/pools/pool-messages.test.ts:65-69`: it moves to `src/telegram.ts` as `messageLink`, its test
  to `test/telegram.test.ts`.
- `src/kyiv-time.ts:45-60`: `daysFrom`, `clockTime`, `dayAndMonth`; the year is new.
- `src/texts.ts`: a `shares` group beside `stats`.

## Reuse

- `attempt` (`src/chat/attempt.ts`) and `ctx.react` for best-effort answers after the commit, as
  `/all`'s 👌 (`src/members/all-handlers.ts:21-24`), with the same `ctx.room.stale` check first.
- `replyingTo` (`src/telegram.ts:38-43`): HTML, no preview, still sent if the message is gone.
- `displayNames(knownMembers(sql))` (`src/stats/stats-queries.ts:51`) and `escapeHtml`
  (`src/members/mentions.ts`), as `/stats` names people.
- `👀` is in grammY's `ReactionTypeEmoji` union (`@grammyjs/types/message.d.ts:1477`).

## Testing-issue estimate

- `{when}` is computed against the баян's sent time, so tests set dates through the message's
  `date`, not the room's clock.
- A failed reaction or reply: `telegram.fail('setMessageReaction' | 'sendMessage', { status: 400 })`.
- The first sender's name is learned from their own message by `learningMembers`, so through the
  object the баян names them without seeding members.
- No file nears the cap: `share-handlers.ts` ~55 lines, `kyiv-time.ts` 72 → ~82, `texts.ts`
  178 → ~186.
