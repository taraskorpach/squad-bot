# Pool Menu — Design

## Purpose

Opening a pool means remembering `/pool [гра] [розмір] [час]`. A tap on `/pool` in Telegram's
command menu sends `/pool` with nothing after it, which opens CS2 for five, now: rarely what anyone
wanted. And some games have no squad size at all: for Мафія, whoever comes plays.

So `/pool` alone opens a menu of buttons, and a pool can have no seat limit.

## Audience

The same seven friends (`docs/specs/mvp/design.md` → *Audience*). Whoever opens the menu builds
the pool; everyone else sees the usual card once it opens.

## Decisions

| Decision | What we chose | Rejected alternative | Why |
|---|---|---|---|
| `/pool` with nothing after it | Opens the menu | Keep the instant CS2-for-five pool; the menu as a new command | The command menu sends a bare `/pool`, and the menu is the easy way in (Taras) |
| Games on buttons | CS2 and Мафія; any other game by command | A step that asks for a typed name | A typed name needs a remembered menu and parsed replies; the command still opens any game (Taras) |
| Times | Зараз, the full hours still ahead today up to 23:00, and 🕓 Інший час: an hour, then minutes in fives | Half hours on the first screen; typing a time in reply | Two taps reach any time, with nothing to store or parse (Taras chose this) |
| Seats | 2–10, or ∞ Без ліміту | Sizes only | Мафія and evenings like it have no squad size (Taras) |
| No limit by command | Not offered: the menu only | `/pool мафія ∞` | The command's grammar stays as it is; easy to add later |
| Menu state | Each button carries the choices so far in its data | A table of menus in progress | Nothing to store, migrate or expire, and `m:…` stays far under Telegram's 64 bytes |
| Who taps | The menu's author only | Anyone in the chat | Two people building one pool would fight over it |
| After the time | The menu is deleted and the card posts as a reply to `/pool`, as typed | Editing the menu into the card | One way to post a card, so the alarm's recovery of a lost card keeps working |
| A first-screen hour tapped too late | The time step is shown again with fresh hours, with a toast | Opening it for tomorrow | A menu left open shouldn't open a pool for the next day by surprise |
| 🕓 Інший час | A past time means tomorrow, as typed `/pool` does (under an hour past means now) | Refusing past times | The same rule as the command, so a late game still opens |

## Core flow

```
/pool (nothing after it)
   │  menu posted as a reply to /pool; only its author's taps count
   ▼
game ──► seats ──► time ──────────────► pool opens: menu deleted, card posted, everyone tagged
  ▲        │  ▲      │  ▲                    ▲
  └ Назад ─┘  └ Назад┘  │                    │
                        └─ 🕓 Інший час ─► hour ─► minutes ─┘
✖️ Скасувати on any step deletes the menu
```

`/pool` with anything after it opens a pool at once, exactly as before (`docs/specs/mvp/design.md`).

## Screens and copy

### Game
```
🎮 Новий пул — у що граємо?
Іншу гру відкривай командою: /pool назва 5 21:00
[ CS2 ] [ Мафія ]
[ ✖️ Скасувати ]
```

### Seats
```
🎮 Мафія — скільки місць?
[ 2 ] [ 3 ] [ 4 ] [ 5 ] [ 6 ]
[ 7 ] [ 8 ] [ 9 ] [ 10 ]
[ ∞ Без ліміту ]
[ ← Назад ] [ ✖️ Скасувати ]
```

### Time
Opened at 18:40 in Kyiv:
```
🎮 Мафія · 8 місць — коли?
[ Зараз ]
[ 19:00 ] [ 20:00 ] [ 21:00 ]
[ 22:00 ] [ 23:00 ]
[ 🕓 Інший час ]
[ ← Назад ] [ ✖️ Скасувати ]
```
- The seats read `{n} місце | місця | місць` or `без ліміту`: `🎮 Мафія · без ліміту — коли?`.
- The hours are every full hour after now, today in Kyiv, up to 23:00, three to a row. After 23:00
  there are none, and the step shows `Зараз` and `🕓 Інший час` only.

### Other time: the hour
```
🎮 Мафія · 8 місць — о котрій?
[ 00 ] [ 01 ] [ 02 ] [ 03 ] [ 04 ] [ 05 ]
[ 06 ] [ 07 ] [ 08 ] [ 09 ] [ 10 ] [ 11 ]
[ 12 ] [ 13 ] [ 14 ] [ 15 ] [ 16 ] [ 17 ]
[ 18 ] [ 19 ] [ 20 ] [ 21 ] [ 22 ] [ 23 ]
[ ← Назад ] [ ✖️ Скасувати ]
```

### Other time: the minutes
```
🎮 Мафія · 8 місць — о 21:__?
[ :00 ] [ :05 ] [ :10 ] [ :15 ] [ :20 ] [ :25 ]
[ :30 ] [ :35 ] [ :40 ] [ :45 ] [ :50 ] [ :55 ]
[ ← Назад ] [ ✖️ Скасувати ]
```
`← Назад` from the minutes goes back to the hours; from the hours, back to the time step.

### Toasts (answers to menu taps)
| Tap | Toast |
|---|---|
| Any button of someone else's menu | `Це меню не твоє — відкрий своє: /pool` |
| A first-screen hour that has passed | `Ця година вже минула — обери іншу` |
| ✖️ Скасувати | `Скасовано` |
| Anything else | no text |

### A pool without a limit
The card, open, with the usual buttons minus 🎲, which never shows:
```
🎮 Мафія · без ліміту · сьогодні о 21:00
Автор: Тарас

✅ Грають (6): Тарас, Олег, Андрій, Ігор, Макс, Діма
❌ Пас: Саша
```
- `✅ Грають ({n}): {names}`, with no `/{size}`. Nobody sits on a bench, nothing is drawn, and no
  "squad complete" message goes out.
- The start ping is `⏰ {game} — час! {mentions}`, never followed by `({n}/{size})`.
- `/pools` shows the fill as `{n} у грі`: `• Мафія · сьогодні о 21:00 · 6 у грі → картка`.
- Closed, it reads like any closed card: `🎮 Мафія · без ліміту · 17.11 о 21:00`.

## Edge cases

- **A second quick tap on the time** (a double tap, a slow network) opens nothing more: the first
  opens the pool, and a tap on a menu already used is answered with no text.
- **The menu message is gone** (someone deleted it): its buttons are gone with it, nothing to do.
- **Deleting the menu fails** (it is older than Telegram lets a bot delete): the menu is edited to
  `✅ Пул відкрито` with no buttons instead.
- **A command typed while a menu is open** (`/pool cs2 5 21:00`) opens its own pool; the menu
  stays until it is used or cancelled.
- **Stats.** A pool opened from the menu counts like a typed one: one opened pool and the author's
  Граю (`docs/specs/mvp/design.md` → *Stats*).
