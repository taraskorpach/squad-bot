# Reels Stats — Technical

The code calls a post sent to the chat a **share**: the event kind `share`, the folder
`src/shares/`.

## Storage

Migration 6 lets an event say what it is about and which message made it:

```sql
ALTER TABLE events ADD COLUMN ref        TEXT;
ALTER TABLE events ADD COLUMN message_id INTEGER;
CREATE INDEX idx_events_kind_ref ON events (kind, ref);
```

- `ref` is a share's post id, `{platform}:{id}`: `instagram:DezXNvMGxHM`, `threads:DFp3Kx2tQ9a`,
  `tiktok:7312345678901234567`, `youtube:dQw4w9WgXcQ`. It is NULL for every other kind, and for
  every event before the migration.
- `message_id` is the message a share came in, for the баян's link. It is NULL elsewhere.
- The index serves the баян's lookup and the board's grouping. Old rows are untouched, so the
  five boards count as before.
- The statements bind nothing, so one `exec` runs them all inside the migration's transaction
  (`docs/specs/_ledger/gotcha-do-sql-multi-statement-bindings.md`).
- `EventKind` gains `'share'`. There is no CHECK to change (migration 2's comment).

`StatEvent` (`src/stats/event-store.ts`) gains `ref?: string` and `messageId?: number`, and
`recordEvent` writes both, NULL when absent.

## What a post is (`src/shares/share-links.ts`)

Pure, and it knows nothing of grammY:

```ts
type Platform = 'instagram' | 'threads' | 'tiktok' | 'youtube';
interface Post { platform: Platform; id: string }

postOf(link: string): Post | undefined
postRefs(links: readonly string[]): string[]   // each `{platform}:{id}` once, in link order
```

Parse with `URL`. A link without a scheme (`instagram.com/reel/…`, which Telegram links too) gets
`https://` first, and a link that doesn't parse is no post. Hosts compare in lower case, and "on
`x.com`" means `x.com` itself or any subdomain of it. Paths are read as segments; the query and the
fragment matter only for YouTube's `v`.

| Platform | Host | Path → id |
|---|---|---|
| Instagram | `instagr.am`, or any host ending in `instagram.com`: www., m., and the preview hosts ddinstagram.com and kkinstagram.com | the segment after the first `reel`, `reels`, `p` or `tv` (`/{user}/reel/{id}` too); `/share/{id}`, `/share/reel/{id}` and `/share/p/{id}` give the share's own code. `reels/audio/…` is a sound's page. Id: `[A-Za-z0-9_-]+`, kept as it is, since ids are case-sensitive |
| Threads | on `threads.com` or `threads.net` | `/@{user}/post/{id}`. Id: `[A-Za-z0-9_-]+` |
| TikTok | on `tiktok.com` | `/@{user}/video/{id}` and `/@{user}/photo/{id}`, id digits; `/t/{code}` on tiktok.com and `/{code}` on `vm.tiktok.com` or `vt.tiktok.com` give the short link's own code, `[A-Za-z0-9]+` |
| YouTube | on `youtube.com` (www., m., music.) | `/watch?v={id}`, `/shorts/{id}`, `/live/{id}`, `/embed/{id}` |
| YouTube | `youtu.be` | `/{id}` |

A YouTube id is exactly 11 of `[A-Za-z0-9_-]`; anything else is no post. A TikTok short code and a
video id can't collide: ids are all digits, and codes have letters.

A message's links are the text of its `url` entities and the `url` of its `text_link` entities,
from the text or the caption: grammY's `ctx.entities(['url', 'text_link'])` reads whichever the
message has (grammY 1.46.0, `out/context.js`). Entity offsets are UTF-16, as JavaScript strings are.

## The feature (`src/shares/share-handlers.ts`)

`trackShares` is a `Composer<BotContext>` listening on `['::url', '::text_link']`, which covers
message text and captions. It comes first in `FEATURES` (`src/bot.ts`), so a command's message is
seen too. Register the composer itself, not what `.on()` returns
(`docs/specs/_ledger/gotcha-grammy-composer-command-returns-branch.md`).

```
a message with links ──► post refs ── none ──► next()
                             │ some
                             ▼
                         await next()        a command in the same message runs first
                             │
                             ▼
        commit:  phase 2 — the first event about each ref, read before writing
                 one 'share' event per ref: sender, sent time, ref, message id
                             │
                 stale? ── yes ──► done: counted, no answer
                             │ no                                   (phase 2 from here)
                             ▼
                 баяни?  ── reply «🪗 Баян! …», a line each   (attempt)
                 a new one? ── react 👀                       (attempt)
```

- **Counted after `next()`.** If a command in the same message fails, nothing of the post has been
  written: the failure policy judges the update as before, and a redelivery counts the post then.
  Once the command has committed, the update is never redelivered, so the post can't be counted
  twice either way.
- **One event per distinct post per message**, at the message's sent time (`sentAt`). The update's
  id commits with them (`ctx.room.commit`), so a redelivered update records nothing twice.
- **Phase 2's lookup runs in the same commit, before the inserts**, so a message is never its own
  баян.
- **Stale messages** (`ctx.room.stale`) are counted and get no answer.
- **The answers come after the commit**, through `attempt` (`src/chat/attempt.ts`): a failure is
  logged and nothing is redelivered.

## The board

- `stats-queries.ts`: `COUNTED.share` is `SELECT user_id FROM events WHERE kind = ? GROUP BY ref,
  user_id`, each post and person once, the shape of `ONCE_IN_EACH_POOL`. `readStats` adds
  `share`.
- `stats-format.ts`: `board(copy.shares, 'share')` comes right after `/domikpisik`.
- `texts.ts`: `stats.shares: '🍿 Скидає контент'`.

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
  `messageLink(chatId, messageId)`, and pools and shares both import it. With no `messageId`, the
  line has no link.
- **Texts** (`texts.ts`): `shares.bayan(name, when, original)`, `shares.original(url)` (the
  ` → <a href="…">оригінал</a>` tail, as `pool.replies.cardLink`), `shares.today(time)` and
  `shares.yesterday(time)`.
- **The reply** goes out with `replyingTo(ctx.msg.message_id)`: HTML, and no link preview.
- **The reaction** is `ctx.react('👀')`, as `/all`'s 👌.

## Files

New:
- `src/shares/share-links.ts`: the matcher
- `src/shares/share-handlers.ts`: `trackShares`
- `src/shares/share-format.ts`: the баян's line (phase 2)
- `test/shares/share-links.test.ts`, `test/shares/share-handlers.test.ts`,
  `test/shares/share-format.test.ts`

Changed:
- `src/chat/schema.ts`: migration 6
- `src/stats/event-store.ts`: `'share'`, `ref`, `messageId`, `firstEventAbout`
- `src/stats/stats-queries.ts`, `src/stats/stats-format.ts`: the board
- `src/texts.ts`: the board's title and the баян
- `src/bot.ts`: `trackShares` first in `FEATURES`
- `src/telegram.ts`, `src/pools/pool-messages.ts`: `messageLink`
- `src/kyiv-time.ts`: the year
- `test/helpers/updates.ts`: messages with the entities Telegram adds
- `test/chat/schema.test.ts`, `test/stats/*.test.ts`, `test/telegram.test.ts`,
  `test/pools/pool-messages.test.ts`, `test/kyiv-time.test.ts`

## Testing

- **Migration 6** on an object holding old events: every event kept, the five boards unchanged,
  and a share event written after it.
- **`postOf`**: the two lists in design.md → *What counts*, as one table-driven test per platform.
- **Test messages.** `test/helpers/updates.ts` builds a text message with the `url` entities
  Telegram adds (UTF-16 offsets), a photo with a caption and its `caption_entities`, and a word
  under a `text_link`.
- **The feature, through the object** (`roomWith([trackShares])`): a post in text, in a caption
  and under a hidden link; two posts in one message; the same post twice in one message, and
  through two links (a Short and its watch link); a repeat by the same person; a post in a
  command's message (`roomWith([trackShares, tagAll])`: both happen); a stale message; a
  redelivered update; a bot's message.
- **`/stats`**: design.md's mockup, word for word.
- **The баян**: the line as a pure test (today, yesterday, earlier this year, another year, a
  leaver's name, no link); through the object, the reply's text and the message it answers, 👀 on
  a new post, neither on a stale message, and a failed `setMessageReaction` or `sendMessage`
  (`telegram.fail`) that leaves the count as it was.
