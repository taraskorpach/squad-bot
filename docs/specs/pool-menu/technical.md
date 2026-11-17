# Pool Menu — Technical

Builds on the pools feature (`docs/specs/mvp/technical.md` → *Pools*, *Callback data*). Nothing
new is stored: the menu lives in its buttons, and a pool without a limit is a size of 0.

## Pools without a limit (phase 1)

- **Storage.** `pools.size` stays `INTEGER NOT NULL`; `0` means no limit. A nullable column would
  need a table rebuild in a live object's migration (`docs/specs/mvp/technical.md` → *Data model*),
  for no gain. The store is the only place that knows: `pool-store.ts` writes `size ?? 0` and reads
  `row.size === 0 ? undefined : row.size`, so the domain's `size` is `number | undefined`.
- **Rules** (`pool-rules.ts`): `lineupOf(undefined, …)` puts everyone who said Граю among the
  players, in line order, with an empty bench. `answer()` never reports `squadCompleted` and never
  moves anyone up. `draw()` is never reached: the keyboard shows 🎲 only while the bench holds
  someone, and `drawRefusal` answers `benchEmpty` to an old keyboard.
- **Copy** (`texts.ts`): `card.header`, `card.players` and `replies.fill` take an optional size and
  read `без ліміту`, `✅ Грають ({n})` and `{n} у грі` without one; `card.seats(size)` names a
  pool's seats (`5 місць`, `без ліміту`) for the menu too. The start ping leaves out `startFill`.
- **Callers to update:** `pool-format.ts` (header, players), `pool-messages.ts` (`/pools` fill,
  start ping), `pool-alarm.ts`, `pool-handlers.ts` (`/pools`), `pool-actions.ts` (draw),
  `pool-card.ts`. `tsc` lists every caller once `size` turns optional.

## The menu (phase 2)

### Button data
`m:{author}:{game}:{seats}:{time}`, every field always present, `-` when not chosen yet:

| Field | Values |
|---|---|
| `author` | the Telegram id of whoever sent `/pool` |
| `game` | an index into `texts.pool.menu.games` (`0` CS2, `1` Мафія) |
| `seats` | `2`–`10`, or `0` for no limit |
| `time` | `n` now · `tHH` a first-screen hour · `o` the other-time hour step · `oHH` the minutes step for that hour · `HHMM` a chosen other time |

`m:{author}:x` cancels. Each button carries the whole next state, and `← Назад` carries the state
one step back, so a tap needs no stored menu. The longest, `m:9092183208:1:10:o21`, is 22 bytes
against Telegram's 64.

`decodeMenu(data)` returns the state or nothing; anything that isn't `m:` goes on to the pool taps
and the catch-all, as `decodePoolAction` does today.

### Screens
`menuScreen(state, now)` is pure: it returns the text and the inline keyboard for the step the
state names (`texts.pool.menu`). The time step's hours are `upcomingHours(now)` from
`src/kyiv-time.ts`: every full hour after `now` on today's Kyiv date up to 23, built with the
existing `occurrencesAround`.

### Taps (`src/pools/pool-menu-taps.ts`)
A Composer registered in `src/bot.ts` before the pool taps' catch-all:
1. Not the author: `answerCallbackQuery` with `notYours`.
2. Cancel: delete the menu (`deleteMessage`), toast `cancelled`.
3. A state with a time still to pick: edit the menu to `menuScreen(state, clock)`.
4. `tHH` whose hour has passed on the room's clock: re-render the time step, toast `hourPassed`.
5. `n`, `tHH` or `HHMM`: claim `menu:{message}` in the room's throttle for a minute, so a
   second tap opens nothing; `openPool(room, { game, size, authorId, openedAt: clock, startsAt,
   commandId })`, where `commandId` is the menu's `reply_to_message` and `startsAt` is
   `undefined` for now, today's `HH:00` for `tHH`, and `startOf({ hour, minute }, clock)` for
   `HHMM`; then delete the menu (on failure, edit it to `opened` without buttons).

Every tap is answered, or its button keeps spinning. Taps carry no date, so they use the room's
clock (`docs/specs/mvp/ledger/decision-event-time-is-when-the-person-acted.md`).

### `/pool` with nothing after it
`pool-handlers.ts`: when `ctx.match` is blank, reply to the command with
`menuScreen({ author, game: undefined, … }, clock)` instead of opening CS2 for five. With anything
after it, `/pool` parses and opens as before.

## Files

```
src/
  kyiv-time.ts            + upcomingHours(now)                                  phase 2
  texts.ts                + pool.menu, card.headerNoLimit, card.playersNoLimit,
                            replies.fillNoLimit                                 phases 1, 2
  bot.ts                  registers the menu taps before the catch-all          phase 2
  pools/
    pool-store.ts         size 0 ↔ undefined at the boundary                    phase 1
    pool-rules.ts         lineups, answers and draws without a limit            phase 1
    pool-format.ts        the no-limit header and players line                  phase 1
    pool-messages.ts      the no-limit /pools fill and start ping               phase 1
    pool-menu.ts          button data and screens (pure)                        phase 2
    pool-menu-taps.ts     the menu's taps                                       phase 2
    pool-handlers.ts      a bare /pool replies with the menu                    phase 2
test/
  pools/pool-menu.test.ts, pools/pool-menu-taps.test.ts, and the no-limit cases in the
  existing pool-rules, pool-format, pool-messages and pool-handlers tests
```

## Testing

- Pure: the button data round-trips, stays under 64 bytes, and rejects other data; each screen's
  text and keyboard, including the time step at 18:40, at 23:10 (no hours) and across a DST day.
- Through the object (`roomWith`, as the pool tests do): `/pool` alone posts the menu as a reply;
  the author's taps walk game → seats → time; someone else's tap gets the toast and changes
  nothing; cancel deletes; a passed hour re-renders; a chosen time deletes the menu and posts the
  card as a reply to `/pool`; a second tap opens no second pool; a no-limit pool takes an eighth
  Граю with no bench.
