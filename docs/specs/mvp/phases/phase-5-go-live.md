---
needs: [1, 4]
code: false
gate: outward
shape: cutover-and-runbook
---

# Phase 5 — Go live with /all, pools and stats

**Goal:** The bot runs in the friends' chat: it hears every command, knows all seven members, `/all`, pools and `/stats` work, and the old tag bot is gone. PRs A, B and C go live together (`ledger/decision-release-all-at-once.md`).

**Outcome:** The chat switches to the new bot for tagging, pools and stats at once. Free. Risk: for a few minutes both bots answer /all, and the welcome is one extra message.

**Files to touch:**
- none; a changed `MENTION_CHUNK` goes into the next code PR (see the mention test)

## Implementation guidance

The runbook is `README.md` (phase 4). Every item is ticked with its evidence. Order:
1. Add the production bot to the chat as an admin with only the pin right. In a basic group this
   most likely upgrades the chat to a supergroup with a new `-100…` id.
2. `telegram:configure discover --env .prod.vars` → the supergroup's id and `BOT_INFO`.
   - Check first that it prints the production bot's `@username`.
   - If the chat is still a basic group, turn on a supergroup-only setting (for example, making
     chat history visible to new members) and run `discover` again.
3. Fill in all four keys in `.prod.vars`, with `WEBHOOK_SECRET` generated once in the password
   manager. Then run `npx wrangler secret bulk .prod.vars`, so the Worker and the setup script read
   the same values. The first time, wrangler offers to create the Worker: say yes (README → *Go live*).
4. Merge PR A. Its deploy fails while any of the four secrets is missing (`secrets.required`),
   which is why it comes after step 3. Mark phase 4 deployed once the workflow is green.
5. `telegram:configure webhook https://<worker>.workers.dev --env .prod.vars`, then `welcome`.

**The mention test** settles wave 0's open question: does a sixth mention in one message notify?
Deploy once with `wrangler deploy --var MENTION_CHUNK:10`, run `/all`, and ask who got a
notification. If all six did, the next code PR sets `MENTION_CHUNK` to 10 in `wrangler.jsonc`;
otherwise 5 stays. Either way, run the deploy workflow on `main` afterwards (manual dispatch) so the
live setting matches the repo. If the sixth didn't notify, the pools' one-message announcements need
chunks too (ledger: `decision-announcements-in-one-message.md`).

**The CPU check** reads "CPU Time per execution" in the dashboard for the Worker and the object
after a day of use (wave 2 §2: 10 ms per request on Free, never measured for grammY).

## Deliverables

- [x] Gate: Taras agrees to go live in the chat — Taras in the session, 2026-11-17 13:30: «Далі давай додавати в чат», after trying A, B and C in Pisikcs Test
- [x] Bot added to the chat as an admin (Taras keeps every right on: «Та байдуже на права, хай будуть усі»); the supergroup's id found with `discover` (evidence: date and the chat type) — 2026-11-17 13:27, Кс?, a supergroup, -1002916635390; admin with every right
- [x] Production secrets set before PR A merges: `BOT_TOKEN`, `WEBHOOK_SECRET` (the same value in `.prod.vars`), `ALLOWED_CHAT_ID`, `BOT_INFO` (evidence: date) — 2026-11-17 13:29, wrangler secret bulk .prod.vars: BOT_TOKEN, WEBHOOK_SECRET, ALLOWED_CHAT_ID, BOT_INFO on the new Worker squad-bot
- [x] PRs A, B and C merged at once (#2 into PR A's branch, then #1 into main) and the deploy workflow green; phases 2–4 and 6–9 marked deployed (evidence: the workflow run) — 2026-11-17: #2 into feat/mvp-pr-a (4443441), #1 into main (046a46d); deploy run https://github.com/taraskorpach/squad-bot/actions/runs/44074832682 green
- [x] Webhook set and the command menu visible in the chat (evidence: date) — 2026-11-17 13:34, webhook on https://squad-bot.taraskorpach03.workers.dev with the menu; Taras: «запустилось все ок в чаті»
- [ ] Welcome posted and all seven members known (evidence: an `/all` that tags six)
- [ ] Mention test done and `MENTION_CHUNK` settled (evidence: who was notified, the value)
- [ ] CPU per update checked in the dashboard (evidence: median and p99 for the Worker and the object)
- [ ] Old tag bot removed from the chat (evidence: date)

## Phase-local notes

- If requests run over 10 ms CPU, record it in the ledger: the pool card is the heaviest render, and it is live from the start.
- The welcome must go out after the webhook is set, or 👋 taps reach nobody.
