---
from: a Claude Code session started in ~/Projects/crm (an unrelated project; nothing there needs this)
from-session: bc2afa00-b741-4e2b-9348-7d13db523eb2
created: 2026-11-16T13:56:26+02:00
---

# mvp — Seed

## Why it branched
Taras's pet project, unrelated to CRM Dance. He asked for it from a session in the crm checkout,
so the research ran there and this repo was created for it. `/spec` continues in a session started here.

## In the user's words
> "Контекст: у нас є чат з 7 людей друзів. Ми часто граємо в кс2 та інші ігри.
> Проблема: ми часто тегаємо усіх через іншого бота, щоб отримати відповідь чи буде хтось грати чи ні. і часто ми втрачаємо контекст хто погодився, а хто ні і так далі
> Тз: нам треба бот, і він повинен вміти
> 1. Тегати усіх учасників групи через команду /all. Писати статистику, хто найчастіше використовує цю команду в чаті.
> 2. Писати статистику, хто найчастіше пише команду /domikpisik. На команду бот не реагує.
> 3. Треба зробити якийсь типу пул. Наприклад людина хоче грати і пише /pool. Бот тегає усіх людей в чаті після цього. Якщо людина пише /join, вона потрапляє в pool. Коли назбиралось в пулі наприклад 5 людей, пише пул повний, ось список. Якщо людей в пулі більше 5, то треба можливість рандому, щоб вибрати хто один не піде грати наприклад. Або також визначити по часу хто останній приєднався до пулу. Має бути команда щоб глянути скільки людей приєдналось до пул, типу стат чи щось такого. Також треба писати статистику скільки людей взагалі приєдналось до пулу за весь час, хто найактивніший. Пул має бути не один я так розумію, а якось має бути команда для створення нового пул. Але над цим треба подумати як буде зручніше
>
> Треба описати також як ти це все бачиш, можливо в тебе є кращі ідеї по UX. Може хтось вже робив схожий проєкт. Почитай, досліди" (Taras, 2026-11-16)

## Decided
- Answering: one live pool message with buttons ✅ Граю / ❌ Пас, edited in place; `/join` stays as a typed fallback. Rejected: commands only (every answer is a new chat message, the list shows only on request) · user
- A 🔔 button pings only the members who haven't answered yet · user (part of the buttons answer)
- Two answers plus "hasn't answered": Граю / Пас. Rejected: adding Пізніше (takes no slot), and join-only (a "no" can't be told from silence) · user
- Overflow: a bench in join order; when someone in the five leaves, the first on the bench moves up and is pinged; a one-shot 🎲 button draws who sits out. Rejected: queue only, an automatic draw at the start time, rotation by who sat out last time · user
- Several pools at once, each its own message with its own buttons: `/pool [game] [size] [time]` (defaults CS2, 5, now), `/pools` lists the open ones, `/join` without a reply goes to the latest open pool. Rejected: one pool per chat · user
- "Pool full" goes out as a new message that tags the five · recommended, unconfirmed
- The bot is a group admin with only the Pin right, so no command is lost (privacy mode) and roster changes arrive · recommended, unconfirmed
- The old tag bot is retired once `/all` works here; both would answer a bare `/all` · recommended, unconfirmed
- The bot keeps only member ids, names and counts, never message text · recommended, unconfirmed
- Not in the MVP: ready check when a pool fills, named mention groups (`@cs2`), native-poll votes on game or time · recommended, unconfirmed

## What crm needs
Nothing.

## Evidence
- `research/2026-11-16-wave-0-telegram-platform.md`: Bot API 10.4 facts that shape the design (no member list, privacy mode, mentions by id, limits, polls, timers)
- `research/2026-11-16-wave-0-prior-art.md`: tag-all, RSVP and gaming-queue bots compared, with recurring UX patterns

## Open questions
- When does an open pool close by itself: N hours after its start time, or at the end of the evening?
- If a pool has a start time, does the bot ping the five at that time?
- Which leaderboards `/stats` shows (callers of `/all`, `/domikpisik`, pool joins, pool starters, most passes), all-time only or this month too
- Does `/all` tag the caller as well, and does it need a cooldown?
