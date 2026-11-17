# Squad Bot MVP — Design

## Purpose

Seven friends share one Telegram group and play CS2 and other games together. To learn
whether anyone will play, someone tags everyone through another bot, and the answers scatter
down the chat: soon nobody can tell who agreed, who said no and who never answered
(`product-brief.md`; Taras's own words are in `seed.md`).

The bot replaces that with **one live card per game** that everyone answers with a tap and the
bot keeps current. Around it: `/all` tags everyone, `/domikpisik` is counted silently, and
`/stats` turns the group's running jokes into leaderboards.

**The real change:** "who's playing?" stops being a pile of replies and becomes one list per game.

## Audience

One group chat of seven friends, Taras among them, on phones and desktop. Nobody has special
powers beyond Telegram's own group roles; the only per-person right is that a pool's author can
close it. Everything the bot writes is Ukrainian, informal ("ти"), and avoids gendered past-tense
verbs ("Автор: Тарас", not "Відкрив Тарас").

## Decisions

Product decisions come from Taras (in `seed.md`, or in this spec's create session on
2026-11-16) unless marked *create*. Mechanism decisions cite the research that grounds them.

| Decision | What we chose | Rejected alternative | Why |
|---|---|---|---|
| Answering a pool | One live card with ✅ Граю / ❌ Пас, edited in place; `/join` as a typed fallback | Commands only | Every answer would be a new message, and the list would show only on request (seed) |
| Who hasn't answered | The card lists them; 🔔 pings only them | Pinging everyone again | Pinging people who already answered is noise (seed) |
| Answer kinds | Граю, Пас, and "hasn't answered" | Adding "Пізніше"; join-only | Пізніше takes no slot and blurs the list; join-only can't tell a no from silence (seed) |
| Overflow | A bench in join order; when a player drops out, the first on the bench moves up and is pinged; a one-time 🎲 draw instead | Queue only; an automatic draw at the start time; rotation by who sat out last | Taras asked for both "by time" and "random"; a one-time draw can't be re-rolled until someone gets in (seed) |
| Several pools | Each pool its own card; `/pools` lists them; `/join` without a reply goes to the newest | One pool per chat | Two games can be gathered on one evening (seed) |
| `/pool` grammar | The game is one word and comes first; then, in any order, a size 2–10 and a time `21:00` or `21.00` | Game names with spaces; a strict order | In "dota 2" the 2 would read as a two-seat pool; any order is nothing to remember |
| A start time already past | Under an hour past means now; older means tomorrow; the card says which | Always tomorrow; an error | `/pool cs2 21:00` typed at 21:05 means now; `01:00` typed at 23:00 means tonight |
| Closing early | An ✖️ Закрити button that works for the author only | A `/close` command; no early close | A mistaken pool would otherwise linger up to a day and still ping its players |
| The author's answer | The author is "Граю" automatically, first in line (*create*) | The author answers like everyone else | "людина хоче грати і пише /pool": opening a pool means wanting to play (seed quote) |
| "Squad complete" | A new message tagging the players, posted once per pool | Editing the card only; re-announcing on every refill | Edits don't notify anyone; re-announcing spams (seed recommended it; "once" is *create*) |
| Start-time ping | At the start time, tag the players once, not the bench | No ping; a ping 10 minutes before | Taras: "Можна" |
| Auto-close | Three hours after the start time, or after opening for a pool "now" | At the end of the evening | One rule, no guessing when an evening ends (Taras: "через 3 год це ок") |
| `/all` | Tags everyone except the caller; every call counted; tags at most once per 30 s, and a repeat inside the window gets a 👌 reaction | Tagging the caller too; no limit at all; a cooldown that drops calls | The caller already knows, and the count is part of the joke (Taras: "Ні"). Telegram allows a bot 20 messages a minute in a group, so unlimited tagging under a leaderboard would silence the pool cards and pings; the window keeps every call counted (Taras, review 2026-11-16) |
| Stats | Five boards (`/all`, `/domikpisik`, Граю, opened pools, Пас) plus total joins, for this month and all time; Граю, Пас and opened pools counted once per pool and person, by the stats queries over an append-only event record | All-time only; counting every tap; a unique index that drops repeats when they are written | Monthly boards stay fresh (Taras: "Так"); toggling must not inflate a board (*create*); the record keeps every answer, so a new board or rule needs no table rebuild (review) |
| Bot rights | A group admin; the bot uses only the pin right. In the friends' chat it keeps every right (Taras, 2026-11-17: «Та байдуже на права») | Turning privacy mode off | Admin bots receive every message; privacy changes need the bot removed and re-added (wave 0, telegram-platform §3) |
| The old tag bot | Leaves the chat once `/all` works here | Naming our command differently | Both would answer a bare `/all` (seed) |
| What is stored | Members, pools, answers and an event record; never message text | Keeping messages | Privacy (seed) |
| Learning members | From messages, button taps and join/leave updates, plus a 👋 button in the welcome | MTProto member listing; seeding from `getChatAdministrators` | The Bot API has no member list; MTProto needs an api_id (wave 0 §1). The first "added" update is dropped at setup, so seeding would need its own trigger; 👋 covers seven people (review) |
| Membership | One `isInChat` test of a member's status: member, administrator, creator, or restricted and still a member; service messages aren't sightings | @grammyjs/chat-members filters | One function, no dependency (its last release was 2025-03); a leaver's own "left" message must not bring them back (review) |
| Other chats | Ignored; the bot leaves any other group it is added to (*create*) | Serving any chat | Out of scope, and the free plan's limits are sized for one chat |
| Hosting | Cloudflare Workers Free | Firebase Blaze (a card on file); Supabase Free (pauses after a quiet week); an always-on VM (all need a card) | $0 with no card; over a limit means errors, not a bill; deploys from GitHub (wave 1; Taras) |
| Framework | grammY, TypeScript | node-telegram-bot-api v2; aiogram 3 | Workers support, a `botInfo` seed, `/cmd@otherbot` rejected by default; NTBA v2 is three months old with breaking minors; aiogram fits only a VM (wave 1) |
| Concurrency | Every update of the chat runs inside its Durable Object, one at a time, Telegram calls included | grammY per request in the Worker, with the object as atomic storage | Taps from different members arrive in parallel; a serial queue makes seat races and out-of-order card edits impossible, and seven people never queue long (waves 1–2) |
| Exactly once | The update's id is recorded in the same transaction as its first state change; Telegram gets its answer after processing; a 500 (a redelivery) only before anything was committed or sent, and only until the update has failed 3 times over 5 minutes | An early 200 with `waitUntil`; redelivery without a limit | Redelivery still covers a crash before the commit, and the id stops doubles (wave 2). Telegram retries a failing message for 24 h and holds the chat's later messages behind it, so the retry is capped (review) |
| The object | One object with a fixed name; its chat id is `ALLOWED_CHAT_ID` | One object per chat id | One chat by design; the alarm needs the chat id from one source; a group upgrade changes a secret, not the stored state (review) |
| Failed sends | The card and the start ping retry through the alarm; other messages that go out once are sent at most once | Retrying every message; an outbox | A duplicate ping costs more than a rare lost one, and the card always shows the true state (review) |
| Late commands | A command that reaches the bot more than 10 minutes late is counted where it counts and otherwise ignored | Acting on it late | After an outage Telegram replays queued messages in order, so a late `/all` would tag everyone at night (review) |
| Storage | The object's own SQLite | D1; KV | Synchronous and atomic in the object's thread; D1 has no interactive transactions, KV no atomicity (wave 1) |
| Timers | The pools table drives the object's single alarm (start pings, closes, missing cards, the midnight relabel), re-armed with every change and checked on every update; failed actions retry three times | A jobs table; a cron sweep every minute; the Agents SDK scheduler; @cloudflare/actors | Jobs copied pool columns, and every close path had to cancel them; now a closed pool can't fire (review). A sweep wakes the object 1,440 times a day and misses minutes while cron changes propagate. The Agents SDK is pre-1.0 with 30+ dependencies and takes over the alarm. Actors is a stalled beta (craft) |
| Rate limits (429) | auto-retry, at most 2 retries and 5 s, server errors not retried | auto-retry defaults (unbounded); an outbox | Unbounded sleeps overrun the webhook and cause redelivery; an outbox is overkill at this load (wave 2) |
| Message format | HTML with a three-character escaper | @grammyjs/parse-mode entities | Tests compare plain strings; no dependency (craft) |
| Keyboard | Our own callback codec, `p:<pool>:<action>` | @grammyjs/menu | The menu plugin shows "outdated" after parallel taps and after the one-time 🎲 (craft) |
| Command menu | One `setMyCommands` call in the setup script | @grammyjs/commands | grammY already ignores `/cmd@otherbot`; the menu changes only on deploy (craft) |
| Time | Native `Temporal` behind the `temporal` flag, zone Europe/Kyiv | temporal-polyfill; Intl only | Native in workerd; Intl can't turn a wall time into an instant without a hand-written search (craft) |
| Schema changes | An ordered migration list run in the object's constructor, tracked in `_sql_schema_migrations` | Drizzle's migrator; `PRAGMA user_version` | Cloudflare's documented pattern; `user_version` is unsupported in Durable Objects (craft) |
| Declaring the object | The `exports` map with SQLite storage | The legacy `migrations` array | The current mechanism, and this is a new Worker (wave 2) |
| Tests | Vitest inside workerd (@cloudflare/vitest-plugin); MSW fakes Telegram; the clock, randomness and the feature list injected | A grammY transformer seam; Vitest fake timers | No test-only branches in bot code; fake timers never move alarms (craft) |
| Deploy | GitHub Actions: checks, then `wrangler deploy` | Workers Builds | Whether Builds waits for checks is undocumented (craft) |
| Tooling | TypeScript 6.0, Biome, npm, Node 26 | TypeScript 7; Prettier with ESLint | TypeScript 6 ships Temporal types; typescript-eslint doesn't support 7 yet; one tool lints and formats (craft) |
| Code layout | Feature folders (`src/chat`, `src/members`, `src/pools`, `src/stats`), kebab-case files, named exports | Layer folders | A feature's rules, SQL and handlers sit together (craft) |
| Texts | One `src/texts.ts` dictionary plus `Intl.PluralRules('uk')` | Fluent with @grammyjs/i18n | One language; `.ftl` isn't a module type Wrangler bundles by default (craft) |

## Core flows

### The bot joins the chat
1. Someone adds the bot as an admin with only the pin right. In a basic group this most likely
   upgrades it to a supergroup with a new id; setup uses the id the upgrade gives.
2. The setup script posts the welcome with a 👋 button (the bot is added before its webhook
   exists, so it can't greet on its own the first time; later re-adds greet automatically).
3. Every member who taps 👋, writes anything, or joins later becomes known. Leaving removes
   them from tagging; their stats stay.

### `/all`
The caller sends `/all`. The bot counts the call and replies to that message with mentions of
every known member except the caller, at most `MENTION_CHUNK` (5) per message. Within 30 s of
the last tagging, a repeat is only counted and gets a 👌 reaction.

### `/domikpisik`
No reply, ever. The call is counted for `/stats`.

### A pool's life
```
            /pool [гра] [розмір] [час]
                       │  card posted (author already "Граю"), then everyone else tagged
                       ▼
   ┌─────────────────── open ───────────────────┐
   │ ✅ / ❌ taps and /join update the card       │
   │ a player passes → first on the bench moves  │
   │   up and is pinged                           │
   │ 🔔 pings only those who haven't answered    │
   │ 🎲 once, only when players exceed seats     │
   └──────────────────────┬──────────────────────┘
   players reach the size for the first time → "squad complete" posted once
   start time reached (if one was given)     → players tagged once
                          │
      ✖️ by the author ────┤──── start + 3 h (or opening + 3 h)
                          ▼
                       closed: the card turns final and loses its buttons
```

### `/join`
- As a reply to a card, or to any message the bot posted for a pool (a ping, an announcement):
  joins that pool, or answers that it's closed.
- Otherwise: joins the newest open pool.
- The bot reacts 👌 to the `/join` message instead of replying; the card shows the result.

### `/pools`
Lists open pools with their time, fill and a link to each card.

### `/stats`
Replies with five leaderboards, each showing this month's count and the all-time count.

## Screens and copy

All copy below is final. `{…}` marks values; names on cards are plain text, names in
"messages under a card" are mentions that notify.

### Welcome (setup script, and whenever the bot is re-added)
```
Привіт! Я тегаю всіх (/all), збираю пули на гру (/pool) і веду статистику (/stats).
Щоб я міг вас тегати, натисніть «👋 Я тут» або просто напишіть щось у чат.
⚠️ Зробіть мене адміном (вистачить права закріплювати повідомлення), інакше я не бачу частини команд.

[ 👋 Я тут ]
```
The ⚠️ line appears when the bot isn't an admin at the moment the welcome is posted.

### Pool card, open
```
🎮 CS2 · 5 місць · сьогодні о 21:00
Автор: Тарас

✅ Грають (2/5): Тарас, Олег
❌ Пас: Андрій
⏳ Ще не відповіли: Ігор, Макс, Діма, Саша

[ ✅ Граю ] [ ❌ Пас ]
[ 🔔 Нагадати ] [ ✖️ Закрити ]
```
- Header: `🎮 {game} · {size} {місце|місця|місць} · {зараз | сьогодні о HH:MM | завтра о HH:MM}`.
  The label is recomputed on every render, and open cards are re-rendered at Kyiv midnight, so
  "сьогодні" and "завтра" stay true.
- `✅ Грають ({n}/{size}): {names | —}` always; `🪑 Лава`, `❌ Пас` and `⏳ Ще не відповіли` only when not empty.
- ✅ Граю uses the green button style and ❌ Пас the red one (Bot API 9.4).

### Pool card, complete with a bench
```
🎮 CS2 · 5 місць · сьогодні о 21:00
Автор: Тарас

✅ Грають (5/5): Тарас, Олег, Ігор, Макс, Діма
🪑 Лава: Саша
❌ Пас: Андрій

[ ✅ Граю ] [ ❌ Пас ]
[ 🎲 Жереб ] [ ✖️ Закрити ]
```
- 🎲 Жереб shows only while players exceed seats and the draw hasn't happened.
- 🔔 Нагадати shows only while someone hasn't answered.
- After the draw the card adds `🎲 Склад визначено жеребом` under the author line.

### Pool card, closed
```
🎮 CS2 · 5 місць · 16.11 о 21:00
Автор: Тарас · 🔒 закрито

✅ Грали: Тарас, Олег, Ігор, Макс, Діма
🪑 Лава: Саша
❌ Пас: Андрій
```
- A closed card shows a date (`{dd.MM} о {HH:MM}`; for a pool "now", its opening time) and no buttons.
- `🔒 закрито автором` when the author closed it.

### Messages under a card (each a reply to the card)
| When | Text |
|---|---|
| A pool opens | `📢 {author} збирає {game} {зараз \| на 21:00 \| на завтра, 01:00} — хто грає? {mentions}`; more mentions follow as `📢 {mentions}`. `{author}` is plain text, so the author isn't pinged |
| Players reach the size, first time | `🎮 Склад на {game} зібрано: {mentions}.` plus ` Старт о {HH:MM}.` when a future start time is set |
| A bench player moves up | `{mention}, звільнилось місце — ти граєш у {game}.` |
| 🎲 is used | `🎲 Жереб кинуто. У склад: {mentions}. На лаву: {mentions}.`, listing the whole squad and the whole bench |
| 🔔 is pressed | `🔔 Чекаємо на відповідь: {mentions}`, at most once per 30 s per pool |
| The start time arrives | `⏰ {game} — час! {mentions}` plus ` ({n}/{size})` when the squad isn't complete; nothing when nobody plays |
| The author closes it | `✖️ Пул на {game} ({HH:MM}) закрито автором. {mentions}`, tagging everyone else who said Граю; without a start time the `({HH:MM})` part is dropped; no message when nobody else said Граю |

### `/all`
A reply to the caller's message: `📢 {mentions}`, then `📢 {mentions}` for each further chunk.
With nobody to tag: `Поки нікого тегати — хай усі напишуть щось у чат.`
A repeat within 30 s of the last tagging gets a 👌 reaction instead.

### `/pools`
```
Відкриті пули:
• CS2 · сьогодні о 21:00 · 3/5 → картка
• Dota2 · зараз · 5/5, +1 на лаві → картка
```
"картка" links to the card. Empty: `Зараз немає відкритих пулів. Відкрий: /pool`

### `/stats`
```
📊 Статистика · листопад / за весь час

📢 /all
1. Тарас — 4 / 31
2. Олег — 2 / 17

🏠 /domikpisik
1. Андрій — 9 / 120

✅ Граю · разом 12 / 143
1. Ігор — 5 / 40

🎮 Відкриває пули
1. Тарас — 3 / 25

❌ Пас
1. Макс — 2 / 30
```
- Each row is `{place}. {name} — {this month} / {all time}`, sorted by this month, then all time, then name.
- People with zero in both are left out. An empty board reads `— поки порожньо`.
- The month name is the nominative Ukrainian month in Kyiv time.

### Toasts (answers to button taps)
| Tap | Toast |
|---|---|
| ✅ into the squad | `Ти в грі ✅` |
| ✅ onto the bench | `Місць немає — ти на лаві, №{n} 🪑` |
| ✅ again | `Ти вже в пулі` |
| ❌ | `Пас ❌` |
| ❌ again | `Ти вже пасуєш` |
| 🔔 | `Нагадав: {n}` |
| 🔔 within 30 s of the last reminder | `Щойно нагадав — спробуй трохи згодом` |
| 🔔 when everyone has answered (an outdated keyboard) | `Усі вже відповіли` |
| 🎲 | `Жереб кинуто 🎲` |
| 🎲 by someone not playing | `Жереб кидають ті, хто в пулі` |
| 🎲 after it was used | `Жереб уже кинули` |
| 🎲 with nobody on the bench (an outdated keyboard) | `Лава порожня — жереб не потрібен` |
| ✖️ by the author | `Пул закрито` |
| ✖️ by anyone else | `Закрити може лише автор` |
| Any button on a closed pool | `Цей пул уже закрито` |
| 👋 | `Запам'ятав 👌` |

### Errors and empty states
| Case | Reply |
|---|---|
| Size outside 2–10 (including `/pool cs2 21`) | `Розмір пулу — від 2 до 10. Час пиши як 21:00.` |
| A time-like token that isn't a time (`25:00`) | `Не зрозумів «{token}». Час пиши як 21:00 або 21.00.` |
| Any other unexpected token | `Не зрозумів «{token}». Формат: /pool [гра] [розмір] [час], напр. /pool cs2 5 21:00.` |
| `/join` with no open pool | `Зараз немає відкритих пулів. Відкрий: /pool` |
| `/join` replying to a closed card | `Цей пул уже закрито.` |

### Command menu (group chats)
| Command | Description |
|---|---|
| `all` | Тегнути всіх |
| `pool` | Відкрити пул: /pool [гра] [розмір] [час] |
| `join` | Приєднатися до пулу |
| `pools` | Відкриті пули |
| `stats` | Статистика |

`/domikpisik` stays out of the menu: it's a joke, not a feature.

## Edge cases
- **Author.** The author starts as the first player and may tap ❌ like anyone; a pool with no
  players stays open until it closes.
- **Switching answers.** Allowed both ways. Going back to Граю puts the person at the end of the
  queue (bench, if the squad is complete).
- **Counting.** Граю, Пас and opened pools count once per pool and person, so toggling can't
  inflate the boards. `/all` and `/domikpisik` count every call.
- **The draw.** Only someone who said Граю in that pool can press 🎲. It picks the squad at random
  from everyone who said Граю, the rest go to the bench in join order, and the button disappears.
  Later drop-outs are replaced from the bench as usual; later joins go to the end of the bench.
- **🔔** tags at most once per 30 s per pool (like `/all`) and disappears when everyone has
  answered. A tap on a button the card no longer shows (🎲, 🔔) gets its toast and re-renders the card.
- **"Squad complete"** is posted once. Refilling after a drop-out is silent apart from the
  move-up ping.
- **Start ping** happens only when a time was given, the pool is still open and someone plays.
  A ping more than 15 minutes late (after an outage) is skipped.
- **Closing.** Auto-close is silent: the card turns final. The author's close also tags everyone
  else who said Граю.
- **Members.** Someone who never wrote, tapped or joined since the bot arrived isn't known and
  isn't tagged; the 👋 button or any message fixes that. Someone who leaves the chat drops out
  of tagging and "hasn't answered", keeps their place in pools they answered, and stays in stats.
  A member's own "left the group" message doesn't bring them back, and a restricted member who
  left counts as left.
- **Names.** First names; when two members share one, the last name's initial (or the username)
  is added. Names and the game word are HTML-escaped.
- **Other bots.** `/all@otherbot` and the like are ignored. Until the old tag bot leaves, a bare
  `/all` gets both bots' answers. Commands and taps from bots, anonymous admins and channel
  identities are ignored.
- **Other chats.** Private messages get no reply; the bot leaves any other group it is added to.
- **A deleted card** (an admin removed it): the pool keeps working through `/join` and `/pools`,
  without buttons. Reposting is out of the MVP.
- **A card that never got out.** If Telegram refuses to post a card, the bot posts it within
  minutes (three tries) together with its tag message. If the bot posted it but lost its id,
  the first tap on it restores the link.
- **Lost messages.** If Telegram refuses a message that goes out once, even after retries (the
  opening tags, "squad complete", a move-up, the draw, 🔔, the author's close), it isn't sent
  again. The card still shows the true state.
- **Outages.** Telegram drops taps older than 150 s and messages older than 24 h (wave 1). A
  command that reaches the bot more than 10 minutes late is counted where it counts (`/all`,
  `/domikpisik`) and otherwise ignored, so nobody is tagged at night for a call made in the evening.
- **Unchanged edits** are skipped, so Telegram never gets an edit that changes nothing.
- **Daylight saving.** A start time that falls in the spring-forward gap moves later by the
  length of the gap, an hour (03:30 becomes 04:30); in the repeated autumn hour the earlier one
  is used (Temporal's "compatible" rule).
- **Just after midnight.** A time that was less than an hour ago yesterday means now:
  `/pool cs2 23:45` sent at 00:10 opens a pool for now.

## Out of scope
- Everything the brief lists: a ready check, named tag groups, votes on game or time, counting
  anything from before the bot joined, serving other groups.
- Editing a pool's time or size after opening: close it and open a new one.
- Reposting a deleted card; pinning cards.

## UX rationale
- **One card, separate pings.** Edits never notify, so every moment that needs attention
  (opening, a complete squad, a move-up, the start) is its own short message replying to the
  card, while the card stays the single source of truth.
- **Few messages.** Taps answer with toasts, `/join` with a reaction; only things that need
  someone's attention post to the chat.
- **Mentions in chunks of five** until a live test shows whether a sixth mention in one message
  notifies (phase 5); the chunk size is a setting, not code.
