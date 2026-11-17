# Reels Stats — Technical

## Storage

Migration 6 lets an event say what it is about and which message made it:

```sql
ALTER TABLE events ADD COLUMN ref        TEXT;
ALTER TABLE events ADD COLUMN message_id INTEGER;
CREATE INDEX idx_events_kind_ref ON events (kind, ref);
```

- `ref` is a reel's code. It is NULL for every other kind, and for every event before the
  migration.
- `message_id` is the message a reel came in, for the баян's link. It is NULL elsewhere.
- The index serves the баян's lookup and the board's grouping. Old rows are untouched, so the
  five boards count as before.
- The statements bind nothing, so one `exec` runs them all inside the migration's transaction
  (`docs/specs/_ledger/gotcha-do-sql-multi-statement-bindings.md`).
- `EventKind` gains `'reel'`. There is no CHECK to change (migration 2's comment).

`StatEvent` (`src/stats/event-store.ts`) gains `ref?: string` and `messageId?: number`, and
`recordEvent` writes both, NULL when absent.

## What a reel is (`src/reels/reel-links.ts`)

`reelCode(link: string): string | undefined` is pure and knows nothing of grammY:

1. Parse with `URL`. A link without a scheme (`instagram.com/reel/…`, which Telegram links too)
   gets `https://` first. A link that doesn't parse is no reel.
2. The host is `instagr.am` or ends in `instagram.com`: that covers instagram.com, www., m., and
   the preview hosts ddinstagram.com and kkinstagram.com.
3. In the path's segments, the first `reel` or `reels` must be followed by the code:
   `/reel/{code}`, `/reels/{code}`, `/{user}/reel/{code}`, `/share/reel/{code}`. A code is
   `[A-Za-z0-9_-]+`, kept as it is, since codes are case-sensitive. `reels/audio/…` is a sound's
   page, not a reel.
4. The query and the fragment (`?igsh=…`, `?vrfl=…`) don't matter.

`reelCodes(links: readonly string[]): string[]` gives each distinct code once, in the order the
links come.

A message's links are the text of its `url` entities and the `url` of its `text_link` entities,
from the text or the caption: grammY's `ctx.entities(['url', 'text_link'])` reads whichever the
message has (grammY 1.46.0, `out/context.js`). Entity offsets are UTF-16, as JavaScript strings are.

## The feature (`src/reels/reel-handlers.ts`)

`trackReels` is a `Composer<BotContext>` listening on `['::url', '::text_link']`, which covers
message text and captions. It comes first in `FEATURES` (`src/bot.ts`), so a command's message is
seen too. Register the composer itself, not what `.on()` returns
(`docs/specs/_ledger/gotcha-grammy-composer-command-returns-branch.md`).

```
a message with links ──► reel codes ── none ──► next()
                             │ some
                             ▼
                         await next()        a command in the same message runs first
                             │
                             ▼
        commit:  phase 2 — the first event about each code, read before writing
                 one 'reel' event per code: sender, sent time, code, message id
                             │
                 stale? ── yes ──► done: counted, no answer
                             │ no                                   (phase 2 from here)
                             ▼
                 баяни?  ── reply «🪗 Баян! …», a line each   (attempt)
                 a new one? ── react 👀                       (attempt)
```

- **Counted after `next()`.** If a command in the same message fails, nothing of the reel has
  been written: the failure policy judges the update as before, and a redelivery counts the reel
  then. Once the command has committed, the update is never redelivered, so the reel can't be
  counted twice either way.
- **One event per distinct reel per message**, at the message's sent time (`sentAt`). The update's
  id commits with them (`ctx.room.commit`), so a redelivered update records nothing twice.
- **Phase 2's lookup runs in the same commit, before the inserts**, so a message is never its own
  баян.
- **Stale messages** (`ctx.room.stale`) are counted and get no answer.
- **The answers come after the commit**, through `attempt` (`src/chat/attempt.ts`): a failure is
  logged and nothing is redelivered.

## The board

- `stats-queries.ts`: `COUNTED.reel` is `SELECT user_id FROM events WHERE kind = ? GROUP BY ref,
  user_id`, each reel and person once, the shape of `ONCE_IN_EACH_POOL`. `readStats` adds `reel`.
- `stats-format.ts`: `board(copy.reels, 'reel')` comes right after `/domikpisik`.
- `texts.ts`: `stats.reels: '🎬 Рілси'`.

## The баян (phase 2)

- `event-store.ts`: `firstEventAbout(sql, kind, ref)` returns the first event about `ref` by `id`,
  the order the bot took them, with `userId`, `at` and `messageId`, or nothing.
- **The name** comes from `displayNames(knownMembers(sql))`, read in the same commit, as `/stats`
  names people: a leaver keeps their name, and the id stands in for someone never seen. Escaped
  with `escapeHtml`.
- **`{when}`** compares the first event's `at` with the баян's `sentAt`, by Kyiv calendar day
  (`daysFrom` in `src/kyiv-time.ts`): 0 or later is `сьогодні о {clockTime}`, -1 is
  `вчора о {clockTime}`, and anything earlier is `dayAndMonth`, with `.{year}` when the years
  differ. `kyiv-time.ts` gains the Kyiv year of an instant.
- **The link.** `cardLink` (`src/pools/pool-messages.ts`) moves to `src/telegram.ts` as
  `messageLink(chatId, messageId)`, and pools and reels both import it. With no `messageId`, the
  line has no link.
- **Texts** (`texts.ts`): `reels.bayan(name, when, original)`, `reels.original(url)` (the
  ` → <a href="…">оригінал</a>` tail, as `pool.replies.cardLink`), `reels.today(time)` and
  `reels.yesterday(time)`.
- **The reply** goes out with `replyingTo(ctx.msg.message_id)`: HTML, and no link preview.
- **The reaction** is `ctx.react('👀')`, as `/all`'s 👌.

## Files

New:
- `src/reels/reel-links.ts`: the matcher
- `src/reels/reel-handlers.ts`: `trackReels`
- `src/reels/reel-format.ts`: the баян's line (phase 2)
- `test/reels/reel-links.test.ts`, `test/reels/reel-handlers.test.ts`,
  `test/reels/reel-format.test.ts`

Changed:
- `src/chat/schema.ts`: migration 6
- `src/stats/event-store.ts`: `'reel'`, `ref`, `messageId`, `firstEventAbout`
- `src/stats/stats-queries.ts`, `src/stats/stats-format.ts`: the board
- `src/texts.ts`: the board's title and the баян
- `src/bot.ts`: `trackReels` first in `FEATURES`
- `src/telegram.ts`, `src/pools/pool-messages.ts`: `messageLink`
- `src/kyiv-time.ts`: the year
- `test/helpers/updates.ts`: messages with the entities Telegram adds
- `test/chat/schema.test.ts`, `test/stats/*.test.ts`, `test/telegram.test.ts`,
  `test/pools/pool-messages.test.ts`, `test/kyiv-time.test.ts`

## Testing

- **Migration 6** on an object holding old events: every event kept, the five boards unchanged,
  and a reel event written after it.
- **`reelCode`**: the two lists in design.md → *What counts*, as one table-driven test.
- **Test messages.** `test/helpers/updates.ts` builds a text message with the `url` entities
  Telegram adds (UTF-16 offsets), a photo with a caption and its `caption_entities`, and a word
  under a `text_link`.
- **The feature, through the object** (`roomWith([trackReels])`): a reel in text, in a caption and
  under a hidden link; two reels in one message; the same reel twice in one message; a repeat by
  the same person; a reel in a command's message (`roomWith([trackReels, tagAll])`: both happen);
  a stale message; a redelivered update; a bot's message.
- **`/stats`**: design.md's mockup, word for word.
- **The баян**: the line as a pure test (today, yesterday, earlier this year, another year, a
  leaver's name, no link); through the object, the reply's text and the message it answers, 👀 on
  a new reel, neither on a stale message, and a failed `setMessageReaction` or `sendMessage`
  (`telegram.fail`) that leaves the count as it was.
