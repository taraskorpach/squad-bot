---
needs: [1]
needs-deployed: [4]
code: false
gate: outward
shape: cutover-and-runbook
---

# Phase 5 — Go live with /all

**Goal:** The bot runs in the friends' chat: it hears every command, knows all seven members, `/all` works, and the old tag bot is gone.

**Outcome:** The chat switches to the new bot for tagging. Free. Risk: for a few minutes both bots answer `/all`, and the welcome is one extra message.

**Files to touch:**
- none; a changed `MENTION_CHUNK` goes into the next code PR (see the mention test)

## Implementation guidance

The runbook is `README.md` (phase 4). Every item is ticked with its evidence. Order:
1. Add the production bot to the chat; make it an admin with only the pin right.
2. `telegram:configure discover` → the chat id and `BOT_INFO`.
3. `wrangler secret put` for `BOT_TOKEN`, `WEBHOOK_SECRET`, `ALLOWED_CHAT_ID`, `BOT_INFO`.
4. PR A is merged and deployed (this phase's `needs-deployed`).
5. `telegram:configure webhook https://<worker>.workers.dev`, then `welcome`.

**The mention test** settles wave 0's open question: does a sixth mention in one message notify?
Deploy once with `wrangler deploy --var MENTION_CHUNK:10`, run `/all`, and ask who got a
notification. If all six did, the next code PR sets `MENTION_CHUNK` to 10 in `wrangler.jsonc`;
otherwise 5 stays. Either way, redeploy from `main` afterwards so the live setting matches the repo.

**The CPU check** reads "CPU Time per execution" in the dashboard for the Worker and the object
after a day of use (wave 2 §2: 10 ms per request on Free, never measured for grammY).

## Deliverables

- [ ] Gate: Taras agrees to go live in the chat
- [ ] Bot added to the chat as an admin with only the pin right; chat id found with `discover` (evidence: date)
- [ ] Production secrets set: `BOT_TOKEN`, `WEBHOOK_SECRET`, `ALLOWED_CHAT_ID`, `BOT_INFO` (evidence: date)
- [ ] Webhook set and the command menu visible in the chat (evidence: date)
- [ ] Welcome posted and all seven members known (evidence: an `/all` that tags six)
- [ ] Mention test done and `MENTION_CHUNK` settled (evidence: who was notified, the value)
- [ ] CPU per update checked in the dashboard (evidence: median and p99 for the Worker and the object)
- [ ] Old tag bot removed from the chat (evidence: date)

## Phase-local notes

- If requests run over 10 ms CPU, record it in the ledger before PR B: the pool card is the heaviest render.
- The welcome must go out after the webhook is set, or 👋 taps reach nobody.
