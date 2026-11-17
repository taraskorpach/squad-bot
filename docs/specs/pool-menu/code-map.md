# Code Map — Pool Menu

Load-bearing files this spec depends on or introduces. Only list files a new agent
needs to know exist to navigate the code — not every file that's touched.

## Introduced by this spec

| File | Role | Phase |
|------|------|-------|
| `src/pools/pool-menu.ts` | Pure: the menu's button data (`m:{author}:{game}:{seats}:{time}`, `encodeMenu`, `decodeMenu`, `isComplete`) and each step's words and buttons (`menuScreen`) | 2 |
| `src/pools/pool-menu-taps.ts` | The menu's taps: only the author's count, steps edited in place, cancel, a passed hour, and the time opening the pool through `openPool` | 2 |

## Existing files touched

| File | Why we care | Ledger |
|------|-------------|--------|
| `src/pools/pool-store.ts` | The only code that knows a pool without a limit is size 0 | `decision-no-limit-is-size-0.md` |
| `src/pools/pool-rules.ts` | `lineupOf`, `answer` and `draw` without a size: everyone plays, nobody waits | `decision-no-limit-is-size-0.md` |
| `src/pools/pool-handlers.ts` | A bare `/pool` replies with the menu; with arguments it opens at once | |
| `src/kyiv-time.ts` | `upcomingHours(now)`: the time step's full hours | |
| `src/texts.ts` | `pool.menu`, `card.seats`, and the optional size in `card.header`, `card.players`, `replies.fill` | |
| `src/bot.ts` | `poolMenu` sits before `poolTaps` and the catch-all | |

## External references

- Telegram Bot API: callback data is at most 64 bytes; a bot can delete its own message for 48 hours.
