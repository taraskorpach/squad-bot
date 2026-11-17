# Pool Maybe — Design

## Purpose

Taras, 2026-11-17: "додати кнопку не знаю/+- для голосування". Today a pool knows Граю, Пас and
silence. Someone who might come either says Граю and maybe drops out, or stays silent and gets
pinged by 🔔. A maybe answer says it plainly.

## Decisions

| Decision | What we chose | Rejected alternative | Why |
|---|---|---|---|
| The button | `🤷 ±`, between ✅ Граю and ❌ Пас, in the app's own style | `🤔 ±`; `± Може` | A shrug says "don't know" without words (Taras) |
| A seat | None: a maybe isn't in the squad or on the bench | Holding a seat until they decide | A held seat blurs who plays, the very worry that kept "Пізніше" out of the MVP; a maybe who decides taps ✅ and joins the line's end (Taras) |
| 🔔 Нагадати | Leaves maybes alone | Pinging maybes too | They answered; 🔔 is for the silent (Taras) |
| The start ping | Tags maybes in a line of their own after the players | Leaving maybes out | The start is when "maybe" needs an answer (Taras) |
| Stats | A maybe isn't counted | A ± board | Nobody asked for one; the answers table keeps who said it |
| Storage | The answers table drops its CHECK on `choice` (rebuilt once) | A CHECK of three values | SQLite can't change a CHECK in place; the answer kinds are the `Choice` type in code, as the event kinds already are |

## The card

```
🎮 CS2 · 5 місць · сьогодні о 21:00
Автор: Тарас

✅ Грають (3/5): Тарас, Олег, Андрій
🤷 Може: Ігор, Макс
❌ Пас: Саша
⏳ Ще не відповіли: Діма

[ ✅ Граю ] [ 🤷 ± ] [ ❌ Пас ]
[ 🔔 Нагадати ] [ ✖️ Закрити ]
```
- `🤷 Може: {names}`, in the order they answered, comes after the bench and before the passes,
  only when someone said it. A closed card keeps the line.
- Someone who says maybe leaves the squad or the bench; if a seat frees, the bench's first moves
  up and is pinged, as after a pass.
- A maybe who taps ✅ joins the end of the line, like anyone new.

## Toasts

| Tap | Toast |
|---|---|
| 🤷 ± | `Може 🤷` |
| 🤷 ± again | `Ти вже на «може»` |

## The start ping

```
⏰ CS2 — час! Тарас, Олег, Андрій (3/5)
🤷 Ігор, Макс, ви з нами?
```
The second line only when someone said maybe. Nobody playing still means no ping at all.

## Edge cases

- `/join` stays Граю. A maybe can still `/join`.
- 🎲 draws among players only; a maybe gets `Жереб кидають ті, хто в пулі`.
- Old cards, posted before this, get the new button the next time they are edited.
