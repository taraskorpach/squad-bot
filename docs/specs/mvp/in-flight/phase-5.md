# In-flight state

**Session ended:** 2026-11-17
**Active phase:** 5 — Go live with /all, pools and stats

## Where things stand

- Live since 2026-11-17 13:34: A, B and C deployed in one run (44074832682), the webhook points
  at `https://squad-bot.taraskorpach03.workers.dev`, and the welcome is posted in Кс?
  (`-1002916635390`, a supergroup). Taras: «запустилось все ок в чаті».
- Open: all seven members known and an `/all` that tags six (not confirmed yet), the mention
  test, the CPU check after a day of use, and removing the old tag bot.
- Phase 5's ticks, the deployed markers and the two new decisions live on `feat/mvp` only.
  They reach main with a small docs PR once phase 5 is done.

## Implicit context

- `.prod.vars` and `.dev.vars` sit in the `mvp` tree (gitignored). `.prod.vars` holds a fresh
  `WEBHOOK_SECRET`; Taras was asked to copy it into the password manager.
- The bot keeps every admin right in Кс?, Taras's call.
- `getWebhookInfo` showed no pending updates and no errors at 13:35.

## Pick up from here

- Ask Taras whether all seven tapped 👋 and an `/all` tagged six; tick that item with it.
- The mention test: `wrangler deploy --var MENTION_CHUNK:10`, run `/all`, ask who got a
  notification, then run the `deploy` workflow on main so the live setting matches the repo.
