---
kind: gotcha
paths: [src/bot.ts, src/**/*-handlers.ts, src/**/*-callbacks.ts, src/chat/room.ts, src/context.ts]
seen-in: [mvp]
created: 2026-11-16T23:02:05+02:00
---

# Keep per-chat memory on `Room`, never in a feature module

A feature's `Composer` is a module constant, and `FEATURES` hands the same instances to every
`ChatRoom` in the isolate (`src/bot.ts`, the `features` field in `src/chat/chat-room.ts`). A
variable in a feature module, or one its handlers close over, is shared by every object the
isolate runs. Keep in-memory state, such as the 30 s tag window, on `Room` (one per object,
built by `ChatRoom`) and reach it through `ctx.room`.

Why it bites: the test objects of one file run in the test's own isolate (`roomWith` features
close over test variables, `test/helpers/rooms.ts`), so a module-level "last tagged at" written by
one test's object would silence the next test's `/all`. In production the bot has one object, so
the leak would stay hidden until a second object appears.
