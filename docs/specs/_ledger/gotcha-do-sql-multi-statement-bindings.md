---
kind: gotcha
paths: [src/chat/**, src/**/*-store.ts, src/**/*-queries.ts, test/**]
created: 2026-11-16T22:38:45+02:00
seen-in: [mvp]
---

# Durable Object SQLite runs several statements in one `exec` only without bindings

`ctx.storage.sql.exec('A; B')` runs both statements, but with `?` bindings it throws "When executing multiple SQL statements in a single call, only the last statement can have parameters." Give each parameterised statement its own `exec`. A multi-statement string is fine for migrations, which bind nothing, and inside `transactionSync` a failing second statement rolls the first back too.

Evidence: probe and the mvp's phase 2 tests in workerd 1.20261116.1. `BEGIN` and `SAVEPOINT` are refused in SQL: transactions go through `transactionSync`. `sqlite_version()` is "not authorized".
