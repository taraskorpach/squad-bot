# Reels Stats — Design

## Purpose

Taras, 2026-11-17: "а можна зробити щоб трекати повідомлення з рілсами типу
https://www.instagram.com/reel/DezXNvMGxHM/?vrfl=MXNoaW1lajB2ZXFtNw== і вести стастиктку хто
найбільше скидає?"

The friends send each other Instagram reels all day, and who sends the most is a running joke
nobody counts. The bot already sees every message, because it is an admin, and `/stats` already
keeps the group's jokes as boards. So reels become one more board. Two answers in the chat show
the counting at work: 👀 on a reel the chat hasn't seen, and «Баян!» when someone sends one it
has.

**The real change:** a link in an ordinary message becomes a counted event, the first thing the
bot counts that nobody typed as a command.

## Audience

The same seven friends (`docs/specs/mvp/design.md` → *Audience*). Everyone who sends a reel is
counted, and everyone reads the board in `/stats`.

## Decisions

| Decision | What we chose | Rejected alternative | Why |
|---|---|---|---|
| What counts | Instagram reel links (`/reel/…`, `/reels/…`, `/{user}/reel/…`, `/share/reel/…`) on instagram.com, its subdomains and the look-alike preview hosts (ddinstagram.com, kkinstagram.com) | TikTok and YouTube Shorts on the same board, or a board each; Instagram posts and stories | Reels are what the chat sends and what Taras asked about (Taras) |
| The rule | Each reel once per person: two reels in one message count 2, the same reel again from the same person counts 0, and the same reel from two people counts 1 each | One per message, however many links; every link, repeats included | Re-posting can't inflate the board, and two people who send the same reel each sent it (Taras) |
| Where the rule lives | The board's query counts each reel and person once, over one event per reel per message | Refusing a repeat when it is written | The record keeps every event and the rules live in the queries, as for Граю and Пас (mvp → *Decisions*, "Stats") |
| What is stored | The reel's code and the message's id, with each event; never the text or the link | Keeping the link; a reels table of its own | The code is all the rule and the баян need, and the MVP stores no message text (mvp → *Decisions*, "What is stored"). One event record stays the one source of every board |
| When counting starts | From the deploy | Importing the chat's history from a Telegram Desktop export | A bot can't read old messages, and an import needs a protected way into the bot for one evening's history (Taras) |
| The bot's answer | 👀 on a message with a reel new to the chat; a reply «🪗 Баян! Уже було — …» to a reel the chat has seen | Counting silently, as `/domikpisik` | Taras wanted both the баян and a reaction |
| The баян's words | `🪗 Баян! Уже було — {name}, {when} → оригінал`: whoever sent the reel first, by name and without a tag, when they sent it, and a link to their message | «🪗 Баян. Першоджерело — …»; «🪗 Баян! Це вже скидали: …» | Short, and no verb that needs a gender (Taras) |
| Who was first | Whoever the bot counted first for that reel, the sender themselves included | Leaving a person's own repeat alone | A баян means the chat has seen it, whoever sent it |
| A board of баяни | None | `🪗 Баяни` in `/stats` | Taras: «Ні». The record keeps every repeat, so one can come later with no rebuild |
| A reel inside a command | Counts: `/all глянь https://instagram.com/reel/…` sent a reel too | Leaving a command's message to the command | It is a message with a reel; the command runs first and the reel counts after it |
| The board's place | `🎬 Рілси` right after `🏠 /domikpisik` | At the end | The jokes stay together, before the pool boards |

## What counts

```
counts                                                     the reel's code
https://www.instagram.com/reel/DezXNvMGxHM/?vrfl=…         DezXNvMGxHM
instagram.com/reels/DezXNvMGxHM                            DezXNvMGxHM
https://www.instagram.com/oleg/reel/DezXNvMGxHM/           DezXNvMGxHM
https://m.instagram.com/reel/DezXNvMGxHM/?igsh=…           DezXNvMGxHM
https://www.ddinstagram.com/reel/DezXNvMGxHM/              DezXNvMGxHM
https://www.instagram.com/share/reel/BAdGk2x9Qp/           BAdGk2x9Qp (a share link has a code of its own)
«дивись», a word linked to any of the above                as the link

doesn't count
https://www.instagram.com/p/C1a2b3c4d5e/                   a post
https://www.instagram.com/stories/oleg/3141592653/         a story
https://www.instagram.com/reels/audio/123456789/           a sound's page
https://www.instagram.com/reels/                           the reels tab
https://www.tiktok.com/@oleg/video/7312345678901234567     another site
```

## Screens and copy

### `/stats`

```
📊 Статистика за весь час

📢 /all
1. Тарас — 31
2. Олег — 17

🏠 /domikpisik
1. Андрій — 120

🎬 Рілси
1. Макс — 54
2. Олег — 23
3. Тарас — 9

✅ Граю · разом 143
1. Ігор — 40

🎮 Відкриває пули
1. Тарас — 25

❌ Пас
1. Макс — 30
```
- Rows as on every board: `{place}. {name} — {count}`, by the count, then the name; equal counts
  share a place.
- Nobody counted yet: `— поки порожньо`.

### A reel new to the chat

```
Макс:  https://www.instagram.com/reel/DezXNvMGxHM/
       👀
```
The bot reacts with 👀 and says nothing.

### A баян

```
Олег:  https://www.instagram.com/reel/DezXNvMGxHM/
└ Бот: 🪗 Баян! Уже було — Макс, вчора о 21:40 → оригінал
```
- A reply to the message, so it notifies its sender. Whoever sent the reel first is named in plain
  text, without a tag.
- `{when}` is when the first one was sent, on the Kyiv clock, against when the баян was sent:

  | The first one was sent | `{when}` |
  |---|---|
  | the same day | `сьогодні о 21:40` |
  | the day before | `вчора о 21:40` |
  | earlier this year | `12.11` |
  | in another year | `12.11.2026` |

- `оригінал` links to the first message. If that message was deleted, the link opens nothing; the
  name and the time still stand.
- A баян gets no 👀: the reply is its answer.
- A message with several reels gets 👀 when any of them is new, and one reply with a line per
  баян.

### Copy

| Where | Text |
|---|---|
| `/stats`, the board's title | `🎬 Рілси` |
| A reel new to the chat | the reaction 👀 |
| A баян | `🪗 Баян! Уже було — {name}, {when} → оригінал`, with `оригінал` as the link |

## Edge cases

- **The sender's own repeat** gets «🪗 Баян! Уже було — Тарас, …» with their own name, and isn't
  counted again.
- **The same reel twice in one message** is one reel, and not a баян.
- **Forwards.** A forwarded message with a reel counts for whoever forwarded it.
- **Captions and hidden links.** A reel in a photo's or video's caption counts, and so does a word
  linked to a reel.
- **Edits.** The bot doesn't receive edited messages, so a reel added in an edit isn't counted.
- **Deletions.** The bot isn't told about them, so a deleted reel stays counted.
- **Late delivery.** A message that reaches the bot over 10 minutes late is counted, with no 👀 and
  no баян (mvp → *Edge cases*, "Outages").
- **Bots, channels and anonymous admins** are never counted, as on every board.
- **A redelivered update** is counted once.
- **A reel sent as a video file** has no link, so it isn't counted.
- **A share link and a direct link to the same reel** have different codes. They count as two
  reels, and the second isn't a баян.
- **A failed answer.** If the chat doesn't allow 👀, or a reply fails, the failure is logged and
  the count stands.
- **A burst of reels** gets a 👀 each, with no window like `/all`'s: a burst is rare here, and a
  429 is retried like every call (mvp → *Decisions*, "Rate limits (429)").

## Out of scope

- TikTok, YouTube Shorts, Instagram posts and stories.
- The chat's history before the deploy.
- A `🪗 Баяни` board, and a board for this month or week (`/stats` counts all time, mvp →
  *Decisions*, "Stats").
- Telling a share link and a direct link to the same reel apart: that needs Instagram itself.
