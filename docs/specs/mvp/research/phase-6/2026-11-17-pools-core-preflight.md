---
date: 2026-11-17
phase: 6
chunk: migration, pure modules and /pool (deliverables 1–5)
inputs: [phases/phase-6-pools-core.md, research/phase-6/2026-11-17-pools-core-recon.md, principles.md]
---

# Phase 6 preflight — migration, pure modules and /pool

*Source of record — do not edit.*

## Findings that change the plan

1. **Actions need one room interface, and `UpdateRoom` lacks half of it.**
   - `UpdateRoom` (`context.ts:12-72`) has no `tx`, `chatId`, `api` or `random`.
   - A handler that hands `ctx.room.room`, the plain `Room`, to an action loses the update's
     record. The failure policy would then redeliver a committed change (ledger principle).

   So `RoomAccess` in `src/chat/room.ts` is the interface both satisfy, and `UpdateRoom.tx` is
   its `commit`.
2. **`attempt` is about to be copied.** It lives in `all-handlers.ts:49-55` and is named for
   `/all`. It moves to `src/chat/attempt.ts`, takes the label as its first argument, and gets a
   test, before the pools use it.
3. **The event record can't hold a pool's events yet.** `EventKind` lacks `pool_open`, `join` and
   `pass` (`event-store.ts:5`), and `recordEvent` drops `pool_id` (:15-21). Both are extended
   before the pools commit events.
4. **The card's names aren't the mentions' names.** `mentionsOf` builds links of members in the
   chat (`mentions.ts:30-36`). The card shows plain names, including people who answered and
   then left, who are still in the stats. So:
   - names come from `displayNames` over the members in the chat plus the people who answered;
   - one new store query, `membersById`, reads every member whatever `in_chat` says;
   - every name is escaped.
5. **Two of the design's cases have no rule yet.**
   - The open card's "⏳ Ще не відповіли" lists people in roster order in the mockup, but SQL
     returns them in no fixed order. The card is deterministic only with an order, so it sorts
     them by name.
   - A pool that started yesterday and is still open after midnight gets no label from the
     design. It takes the closed card's `dd.MM о HH:MM`.

## Clean Code against the pools

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Functions return decisions | Bites | `answer(...)` in `pool-rules.ts` returns the new row, the toast's kind, the move-ups and whether the squad just completed. The handler applies them. PartitelleBot's `decide_join` / `Change` is the model (craft E1) |
| One level of abstraction | Bites | `pool-actions.ts` holds the side effects: open, answer, refresh the card, post the card. Handlers parse, gate and call one action |
| Errors | Bites | After a commit, every Telegram call goes through `attempt`. Before a commit, nothing is caught, so the failure policy decides. "Message is not modified" counts as accepted |
| Names | Bites | `lineupOf`, `answer`, `parsePoolArgs`, `startOf`, `renderCard`, `poolButtons`, `encodePoolAction` / `decodePoolAction` |
| Tests | Bites | The pure modules get table tests. The object gets the must-have cases: two taps for the last seat, a failed card send, a stale `/pool` |

## Clean Architecture against the pools

| Rule | Verdict | Concrete consequence |
|---|---|---|
| The dependency rule | Bites | `pools/` imports `chat/`, `members/`, `stats/`, `telegram.ts`, `texts.ts` and `kyiv-time.ts`. `chat/` imports no pool module, and the timers are wired in `bot.ts` (phase 8) |
| Humble Object | Bites | Handlers and callbacks are thin. Everything decidable is pure, and `pool-store.ts` is the SQL |
| Plain data across the boundary | Bites | The store returns `Pool` and `Answer` records, not rows. The rules see only those |

## SOLID against the pools

| Rule | Verdict | Concrete consequence |
|---|---|---|
| SRP | Bites | Two actors: the chat's rules (who plays, who sits on the bench), and Telegram's surface (card text, buttons, toasts). `pool-rules` answers to the first, `pool-format` and `pool-keyboards` to the second |
| OCP | Bites | Phase 7's buttons (🎲, 🔔, ✖️) add actions to the codec and rows to the keyboard. The codec's action list is the one place they go |
| DIP | Bites | Actions depend on `RoomAccess`, not on `Room` or a grammY context, so the alarm can call them (finding 1) |
| LSP, ISP | Inert | |

## DDD against the pools

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Ubiquitous language | Bites | Code says play and pass, squad, bench and lineup. Copy says Граю, Пас, Грають and Лава |
| Who owns the invariant | Bites | "One answer per person per pool" is the primary key. Seat order is `rank`. The rules decide, and SQL only stores |
| The aggregate | Bites | A pool and its answers change together, in one commit. Events are appended in the same commit |

## Amendments

1. `RoomAccess` (room.ts), and `UpdateRoom` gets `tx`, `chatId`, `api` and `random`. Its own commit.
2. `attempt` → `src/chat/attempt.ts`, with a test. Its own commit.
3. `EventKind` gets `pool_open`, `join` and `pass`, and `recordEvent` writes `poolId` when given.
4. `membersById(sql, ids)` in `member-store.ts`, for the card's names.
5. Unanswered people are listed by name. A start on another day than today or tomorrow is labelled
   `dd.MM о HH:MM`.

## Defaults applied

- With nobody else known, the opening tag message still goes out without mentions:
  `📢 Тарас збирає CS2 зараз — хто грає?`. It announces the pool and pings nobody.
- `/pool`'s `opened_at` and its events take the message's date (ledger: an event's time is when
  the person acted). A tap's answer takes the room's clock.
- `/join` from someone already playing still gets 👌, and the card shows nothing new.
- A closed pool's card leaves out "⏳ Ще не відповіли", as the design's closed mockup does.

## Forks for you

None.
