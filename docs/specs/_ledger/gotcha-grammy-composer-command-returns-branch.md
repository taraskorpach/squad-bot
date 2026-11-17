---
kind: gotcha
paths: [src/bot.ts, src/**/*-handlers.ts, src/**/*-callbacks.ts, test/**]
created: 2026-11-16T22:38:45+02:00
seen-in: [mvp]
---

# Register a feature's `Composer` itself, not what `.command()` or `.callbackQuery()` returns

`composer.command('x', handler)` returns the branch that runs *behind* the filter, so `bot.use(new Composer().command('x', handler))` installs the handler without its filter: it runs for every update. Build the feature as `const feature = new Composer<BotContext>(); feature.command('x', handler);` and export or register `feature`.

Evidence: grammY 1.46.0 `Composer.command` calls `this.filter(...)` and returns the filtered child (`out/composer.js:275-277`). In the mvp's phase 2, a test that registered `new Composer().command('ping', …)` saw `/ping@other_bot` answered; registering the parent composer fixed it, and grammY's own matcher ignores `/cmd@otherbot` as documented.
