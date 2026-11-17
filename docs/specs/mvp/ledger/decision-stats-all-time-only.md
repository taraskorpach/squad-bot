---
kind: decision
applies-to: [phase 9]
created: 2026-11-17T13:18:25+02:00
---

# /stats counts all time only

Taras, 2026-11-17, trying `/stats` in the test group: "я не думаю що нам зараз треба статистика
по місяцях. просто робимо за весь час". A row read `Taras — 3 / 3` (this month / all time), and
the two numbers meant nothing to him while the bot is new.

So each row is `{place}. {name} — {count}`, sorted by the count, then name, under
`📊 Статистика за весь час`; the Граю title reads `✅ Граю · разом {total}`. The month window and
the month's name left `src/kyiv-time.ts` with their tests.

Bringing a month back needs no data work: the record keeps every event with its `at`, and an
event's `at` is when the person acted (`decision-event-time-is-when-the-person-acted.md`).
Months were cut at Kyiv midnight with `Temporal`, never SQLite's `localtime`; git has that code.
