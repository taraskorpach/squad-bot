# Reels Stats — Design

## Purpose

Taras, 2026-11-17: "а можна зробити щоб трекати повідомлення з рілсами типу
https://www.instagram.com/reel/DezXNvMGxHM/?vrfl=MXNoaW1lajB2ZXFtNw== і вести стастиктку хто
найбільше скидає?"

And once the first plan was written: "треба трохи поміняти, нехай рахує також пости з тредс,
тікток, ютуб. але під один тип івентів".

The friends send each other reels, TikToks, YouTube videos and Threads posts all day, and who
sends the most is a running joke nobody counts. The bot already sees every message, because it is
an admin, and `/stats` already keeps the group's jokes as boards. So these posts become one more
board. Two answers in the chat show the counting at work: 👀 on a post the chat hasn't seen, and
«Баян!» when someone sends one it has.

**A post**, in this spec, is anything the board counts: an Instagram reel or post, a Threads
post, a TikTok, a YouTube video.

**The real change:** a link in an ordinary message becomes a counted event, the first thing the
bot counts that nobody typed as a command.

## Audience

The same seven friends (`docs/specs/mvp/design.md` → *Audience*). Everyone who sends a post is
counted, and everyone reads the board in `/stats`.

## Decisions

| Decision | What we chose | Rejected alternative | Why |
|---|---|---|---|
| What counts | Instagram reels and posts, Threads posts, TikToks (videos and photo posts) and YouTube videos | Instagram reels only, the first plan; stories; profiles, channels and playlists | Taras: «нехай рахує також пости з тредс, тікток, ютуб». Instagram's posts too, since Threads posts count (Taras) |
| One kind of event | One `share` event and one board for every platform; the platform is part of the post's id | An event kind and a board per platform | Taras: «але під один тип івентів». A board per platform can come later from the same record |
| The board's title | `🍿 Скидає контент` | `🎬 Рілси`; `📲 Рілси й пости` | In the style of `🎮 Відкриває пули`, and true of every platform (Taras) |
| YouTube | Every video link: watch, youtu.be, Shorts, live and YouTube Music | Shorts only | «Ютуб» is all of it. A Short and its watch link are one video, so they are one post |
| Short links | TikTok's short links (`vm.`, `vt.`, `/t/`) and Instagram's share links count under their own code | Following each one to the post it leads to | No calls outside Telegram (Taras). The cost: a TikTok sent twice through short links is two posts, and never a баян |
| The rule | Each post once per person: two posts in one message count 2, the same post again from the same person counts 0, and the same post from two people counts 1 each | One per message, however many links; every link, repeats included | Re-posting can't inflate the board, and two people who send the same post each sent it (Taras) |
| Where the rule lives | The board's query counts each post and person once, over one event per post per message | Refusing a repeat when it is written | The record keeps every event and the rules live in the queries, as for Граю and Пас (mvp → *Decisions*, "Stats") |
| What is stored | The post's platform and id, and the message's id, with each event; never the text or the link | Keeping the link; a table of its own | The id is all the rule and the баян need, and the MVP stores no message text (mvp → *Decisions*, "What is stored"). One event record stays the one source of every board |
| When counting starts | From the deploy | Importing the chat's history from a Telegram Desktop export | A bot can't read old messages, and an import needs a protected way into the bot for one evening's history (Taras) |
| The bot's answer | 👀 on a message with a post new to the chat; a reply «🪗 Баян! Уже було — …» to a post the chat has seen | Counting silently, as `/domikpisik` | Taras wanted both the баян and a reaction |
| The баян's words | `🪗 Баян! Уже було — {name}, {when} → оригінал`: whoever sent the post first, by name and without a tag, when they sent it, and a link to their message | «🪗 Баян. Першоджерело — …»; «🪗 Баян! Це вже скидали: …» | Short, and no verb that needs a gender (Taras) |
| Who was first | Whoever the bot counted first for that post, the sender themselves included | Leaving a person's own repeat alone | A баян means the chat has seen it, whoever sent it |
| A board of баяни | None | `🪗 Баяни` in `/stats` | Taras: «Ні». The record keeps every repeat, so one can come later with no rebuild |
| A post inside a command | Counts: `/all глянь https://youtu.be/…` sent a post too | Leaving a command's message to the command | It is a message with a post; the command runs first and the post counts after it |
| The board's place | `🍿 Скидає контент` right after `🏠 /domikpisik` | At the end | The jokes stay together, before the pool boards |

## What counts

Each post's id is its platform and the platform's own id for it. Two links with the same id are
the same post.

```
counts                                                        the post's id
Instagram, reels and posts
https://www.instagram.com/reel/DezXNvMGxHM/?vrfl=…            instagram:DezXNvMGxHM
instagram.com/reels/DezXNvMGxHM                               instagram:DezXNvMGxHM
https://www.instagram.com/p/DezXNvMGxHM/                      instagram:DezXNvMGxHM (the reel's own post)
https://www.instagram.com/oleg/reel/DezXNvMGxHM/              instagram:DezXNvMGxHM
https://m.instagram.com/p/C1a2b3c4d5e/?igsh=…                 instagram:C1a2b3c4d5e
https://www.instagram.com/tv/C1a2b3c4d5e/                     instagram:C1a2b3c4d5e
https://www.ddinstagram.com/reel/DezXNvMGxHM/                 instagram:DezXNvMGxHM
https://www.instagram.com/share/reel/BAdGk2x9Qp/              instagram:BAdGk2x9Qp (a share link: its own code)
Threads
https://www.threads.com/@oleg/post/DFp3Kx2tQ9a?xmt=…          threads:DFp3Kx2tQ9a
https://www.threads.net/@oleg/post/DFp3Kx2tQ9a                threads:DFp3Kx2tQ9a
TikTok
https://www.tiktok.com/@oleg/video/7312345678901234567        tiktok:7312345678901234567
https://www.tiktok.com/@oleg/photo/7312345678901234568        tiktok:7312345678901234568
https://vm.tiktok.com/ZMhvqJ8Fx/                              tiktok:ZMhvqJ8Fx (a short link: its own code)
https://vt.tiktok.com/ZSjAb12Cd/                              tiktok:ZSjAb12Cd
https://www.tiktok.com/t/ZTRk9LmNp/                           tiktok:ZTRk9LmNp
YouTube
https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s             youtube:dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ?si=…                             youtube:dQw4w9WgXcQ
https://www.youtube.com/shorts/dQw4w9WgXcQ                    youtube:dQw4w9WgXcQ
https://m.youtube.com/watch?v=dQw4w9WgXcQ                     youtube:dQw4w9WgXcQ
https://music.youtube.com/watch?v=dQw4w9WgXcQ                 youtube:dQw4w9WgXcQ
https://www.youtube.com/live/dQw4w9WgXcQ                      youtube:dQw4w9WgXcQ
«дивись», a word linked to any of the above                   as the link

doesn't count
https://www.instagram.com/stories/oleg/3141592653/            a story
https://www.instagram.com/oleg/                               a profile
https://www.instagram.com/reels/audio/123456789/              a sound's page
https://www.instagram.com/reels/                              the reels tab
https://www.threads.com/@oleg                                 a profile
https://www.tiktok.com/@oleg                                  a profile
https://www.youtube.com/@oleg                                 a channel
https://www.youtube.com/playlist?list=PL0123456789            a playlist
https://x.com/oleg/status/1859000000000000000                 another site
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

🍿 Скидає контент
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

### A post new to the chat

```
Макс:  https://www.instagram.com/reel/DezXNvMGxHM/
       👀
```
The bot reacts with 👀 and says nothing.

### A баян

```
Олег:  https://youtu.be/dQw4w9WgXcQ
└ Бот: 🪗 Баян! Уже було — Макс, вчора о 21:40 → оригінал
```
- A reply to the message, so it notifies its sender. Whoever sent the post first is named in plain
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
- A message with several posts gets 👀 when any of them is new, and one reply with a line per
  баян.

### Copy

| Where | Text |
|---|---|
| `/stats`, the board's title | `🍿 Скидає контент` |
| A post new to the chat | the reaction 👀 |
| A баян | `🪗 Баян! Уже було — {name}, {when} → оригінал`, with `оригінал` as the link |

## Edge cases

- **The sender's own repeat** gets «🪗 Баян! Уже було — Тарас, …» with their own name, and isn't
  counted again.
- **The same post twice in one message** is one post, and not a баян.
- **One video, two links.** A Short and its watch link, or a reel and its `/p/` link, are one post:
  the second is a баян.
- **One video, two platforms.** A video posted to both TikTok and Instagram is two posts.
- **Short links.** TikTok's app shares a short link of its own each time, so the same TikTok sent
  twice that way is two posts, and the second is no баян. The same goes for Instagram's share
  links, and for a short link and a full link to the same post.
- **Forwards.** A forwarded message with a post counts for whoever forwarded it.
- **Captions and hidden links.** A post in a photo's or video's caption counts, and so does a word
  linked to a post.
- **Edits.** The bot doesn't receive edited messages, so a post added in an edit isn't counted.
- **Deletions.** The bot isn't told about them, so a deleted post stays counted.
- **Late delivery.** A message that reaches the bot over 10 minutes late is counted, with no 👀 and
  no баян (mvp → *Edge cases*, "Outages").
- **Bots, channels and anonymous admins** are never counted, as on every board.
- **A redelivered update** is counted once.
- **A video sent as a file** has no link, so it isn't counted.
- **A failed answer.** If the chat doesn't allow 👀, or a reply fails, the failure is logged and
  the count stands.
- **A burst of posts** gets a 👀 each, with no window like `/all`'s: a burst is rare here, and a
  429 is retried like every call (mvp → *Decisions*, "Rate limits (429)").

## Out of scope

- Instagram stories; profiles, channels and playlists; any other site (X, Facebook, Reddit…).
- Following a short link to the post it leads to.
- The chat's history before the deploy.
- A `🪗 Баяни` board, a board per platform, and a board for this month or week (`/stats` counts
  all time, mvp → *Decisions*, "Stats").
