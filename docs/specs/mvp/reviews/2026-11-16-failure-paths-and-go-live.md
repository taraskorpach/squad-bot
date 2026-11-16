---
date: 2026-11-16
spec-phase-at-review: Phase 1 — Accounts and repo (0 of 9 done; phases 1 and 2 ready)
agents: [principal-engineer, integration-architect, adversarial-tester, code-quality-reviewer, prior-art-reviewer]
slug: failure-paths-and-go-live
---

# Review — failure-paths-and-go-live

*Source of record — do not edit. Actionable findings are applied to the spec and ledger by the review run itself.*

## Summary

Every reviewer agreed the core design is right, and so do I. The plan puts a framework-free Worker in front of one SQLite Durable Object. The object runs grammY behind a serial queue, writes state before it calls Telegram, keeps the rules in pure modules and drives timers from its alarm. That is the simplest correct design for parallel button taps on a $0 plan, and the research behind it holds up. Nobody asked for a rethink: all five returned fix-then-proceed. The repo holds only docs, so reviewers checked the spec against itself and against its research snapshots. I checked the load-bearing external claims against Cloudflare's and Telegram's docs.

The problems fall into three areas.

1. **Failures on both sides of the commit.**
   - Before the commit, every error answers 500, with no limit on retries. Telegram queues messages per chat, so one update that always fails holds back every later message for up to 24 hours. Four of five reviewers found this on their own.
   - After the commit, every failure is swallowed on the promise that "the next render repairs the card". That promise is false in three cases:
     - the card itself never got out;
     - a one-time flag was written before its message was sent;
     - an alarm whose failing job re-arms into the past and can burn the free plan's daily quota in minutes.
2. **Go-live, which can't run as written.**
   - `secrets.required` makes the first deploy fail until the secrets exist, but phase 5 waits for that deploy before it sets them.
   - The setup script reads only `.dev.vars`, so it can reach only the dev bot.
   - Giving the bot a pin-only admin role most likely upgrades a basic group to a supergroup with a new id, and nothing in the spec follows the change.
3. **State stored twice or frozen into the schema.**
   - The `jobs` table copies `starts_at` and `closes_at`, so every path that closes a pool must also cancel its jobs.
   - The `events` unique index turns a stats rule into a write-time constraint. It breaks a second Граю after a Пас unless every insert remembers `OR IGNORE`.

Smaller correctness gaps:
- `/pool` ignores yesterday when it resolves a time typed just after midnight.
- Day labels on cards go stale overnight.
- A `/join` sent as a reply can resolve to the wrong pool.
- A member's own "left the group" message adds them back.
- Buttons on an outdated keyboard have no defined outcome.
- Commands replayed after an outage would tag people at night.

The structure lacks two seams the alarm path needs: a room API that doesn't depend on grammY's context, and pool actions shared by button callbacks, `/join` and timers. Phase 2 also needs a seam for injecting features, so it can test its own contract.

## Forks put to the user

**F1 — `/all` and 🔔 against Telegram's 20-messages-a-minute group limit.**
- Each `/all` sends 1–2 messages, and the `/all` leaderboard invites people to spam it. About ten calls in a minute silence the bot for up to a minute, so pool cards and pings sent in that minute fail.
- Position A, Taras's earlier answer: keep `/all` and 🔔 without a cooldown. Retries cover cards and start pings; other messages sent in that minute are lost.
- Position B: count every `/all`, but tag at most once per 30 s, and answer a repeat with 👌. 🔔 gets the same limit per pool, and a repeat gets a toast.
- My recommendation was B.
- Downstream, B adds a time kept in memory and two new texts, and it changes the `/all` decision row and the 🔔 edge case.
- **Taras's answer (2026-11-16): B, the 30-second window.** Recorded in `ledger/decision-tag-window.md`.

## Resolved by the synthesizer

- **Failure policy.** An error answers 500 only when three things hold:
  - nothing was committed or delivered;
  - it isn't a permanent Telegram 4xx;
  - the update hasn't yet failed 3 times with its first failure at least 5 minutes old.

  Everything else is logged and answered 200. The four reviewers drew this line in different places. This is the only line where a retry can never duplicate a change or a message, and the 5-minute floor keeps a deploy reset from dropping updates.
- **Timers come from `pools`, not a `jobs` table.** This sides with PE and PA over CQ's generic registry. The two job kinds were copies of pool columns, and a closed pool can now never fire. Wiring the timers through `bot.ts` keeps `chat/` free of pool imports, which was CQ's concern.
- **Failed timer actions** retry on the pool row after 1, 2 and 4 minutes, then give up. A start ping more than 15 minutes late is skipped.
- **`events` is append-only.** This sides with PE over AT's and IA's `OR IGNORE`. The boards come out the same, the history stays, and a new event kind needs no table rebuild.
- **There is one object with a fixed name, and its chat id comes from `ALLOWED_CHAT_ID`.** The bot serves one chat by design, so `alarm()` gets its chat id from one source. If the group's id changes, only a secret changes and no stored state is lost.
- **Messages sent once stay at most once, except the card and the start ping, which retry.** A duplicate ping costs more than a rare lost one, and the card always shows the true state.
- **A card that never got out** is adopted from the first tap on it, or else posted by the alarm.
- **The welcome stays in the setup script.** PA-F2 is rejected (see below); its missing API methods are added.
- **`pool_messages`** resolves `/join` replies, including replies to the bot's pings.
- **A midnight re-render through the alarm** keeps the final copy. Rejected: absolute dates. Not used: `date_time` entities, whose rendering is unverified.
- **Stale commands** (more than 10 minutes old when they arrive) are counted where they count and otherwise ignored.
- **The 30-second windows live in memory.** Cloudflare evicts an object only after more than a minute idle, so a lost value can only mean the window has passed.
- **Membership is one hand-written `isInChat` predicate**, not `@grammyjs/chat-members`. That plugin would be a dependency for one function, and its last release was in 2025-03.
- **The setup script** splits into a pure module tested in workerd and a Node shell. The shell calls Telegram through grammY's `Api` and is typed by its own tsconfig.
- **Tunable domain rules leave the schema.** There is no CHECK on `events.kind` or `pools.size`; constraints that hold structure stay.
- **Phase 5 sets the secrets before PR A merges.** The deploy now happens inside phase 5, and its edges become `needs: [1, 4]`.
- **New copy for outdated buttons and the 🔔 window**, listed in the report under "Say if wrong".

## Findings

Severity is my own judgement. Personas: PE principal-engineer, IA integration-architect, AT adversarial-tester, CQ code-quality-reviewer, PA prior-art-reviewer, SYN my own reading.

### R1 — One update that keeps failing stalls the chat for up to 24 h · high · consensus · verified
- **Raised by:** CQ-F1, AT-F2, PE-F1, IA-F1, SYN. PE-F2 refined where the boundary sits.
- **Evidence:**
  - technical.md:51, 63-66 and 85-88: errors before the commit rethrow, with no cap.
  - research wave-1:114-121: Telegram sets no attempt limit and queues messages per chat. "A message that keeps failing stalls that chat's later messages."
  - Updates that commit nothing (`/pools`, `/stats`, 🔔, 👋, taps that only show a toast) count every Telegram error as "before the commit".
- **Applied:**
  - The failure policy above.
  - `failed_updates(update_id, attempts, first_failed_at)` in migration 1, written in its own transaction.
  - A transformer that marks the update as delivered.
  - Each migration and its record run in one `transactionSync` (AT-F2c).
  - Settings are checked at construction (AT-F2b).
  - A must-have test: an update that always throws is acknowledged after the cap, and the next message goes through.

### R2 — Failures after the commit lose the card and one-time flags; `card_render` and an empty `message_id` are undefined · high · consensus · verified
- **Raised by:** AT-F1, CQ-F4, CQ-F10, PE-F2, IA-F8, IA-F9, SYN.
- **Evidence:**
  - technical.md:86-88 promises that "the next render repairs the card".
  - technical.md:135: `message_id` is nullable, but NULL is given no meaning.
  - technical.md:140: `card_render`, with no rule for when it is written.
  - technical.md:200 says "announce, then set it to 1", which contradicts decide-and-write.
  - phase-6:28-30 stores `message_id` after the send.
  - technical.md:257-258: a 429 asking to wait more than 5 s, or a single 5xx, is never retried.
- **Applied:**
  - `commit<T>(fn: (sql) => T): T`, and `recordUpdateOnce` is `INSERT OR IGNORE`.
  - Writes made after a Telegram call (`message_id`, `card_render`) go through `write`.
  - `card_render` is written only after Telegram accepts the edit or answers "not modified".
  - `squad_announced` is set in the commit that fills the squad.
  - Each Telegram call after the commit is caught on its own.
  - An empty `message_id` means "no card" everywhere.
  - A tap adopts its message as the card, and the alarm posts a missing card together with its tag message.
  - A tap on a closed pool re-renders its card.
  - design.md now states that other one-time messages are sent at most once.

### R3 — Phase 5 can't start: the first deploy fails until the secrets exist · high · consensus · verified
- **Raised by:** IA-F6, SYN.
- **Evidence:**
  - phase-5:3 has `needs-deployed: [4]`, while phase-5:20-25 and technical.md:301-302 set the secrets before the deploy.
  - technical.md:279 declares `secrets.required`.
  - Cloudflare's 2026-03-24 changelog and secrets docs say `wrangler deploy` fails "with a clear error if any required secrets are not configured on the Worker" (wrangler ≥ 4.77.0).
- **Applied:**
  - Phase 5 gets `needs: [1, 4]` and loses `needs-deployed`. Merging PR A becomes a phase 5 step after the secrets, and pr-opening.md says so.
  - `deploy.yml` also runs on manual dispatch. The "redeploy from main" after the mention test had nothing to trigger it.
  - Phase 1's Cloudflare task adds the workers.dev subdomain and `wrangler login`.

### R4 — The setup script can reach only the dev bot · high · unique-insight · verified
- **Raised by:** IA-F2.
- **Evidence:**
  - technical.md:287 says ".dev.vars holds the dev bot's values", and technical.md:291 runs the script with `--env-file-if-exists=.dev.vars`.
  - Nothing says where the production values come from, or ties the `setWebhook` secret to the stored one.
  - The dev group's "added" update expires after 24 h (wave-1:108-109), long before phase 4's `discover` runs.
- **Applied:**
  - An `--env <file>` option, defaulting to `.dev.vars`; production values live in a gitignored `.prod.vars`.
  - Every subcommand first prints the target bot's @username.
  - One `WEBHOOK_SECRET`, kept in the password manager, is used in both places.
  - `webhook` checks `getWebhookInfo`.
  - `discover` lists every group seen in any pending update, and the README says to post a message in the group first.

### R5 — The group's id likely changes at go-live, and "added" ignores the old status · medium · consensus · partially verified
- **Raised by:** AT-F12, PE-F7, PA-F8, IA-F4, IA-F10, SYN.
- **Evidence:**
  - phase-7:27-28 assumes the chat is a supergroup, and no research snapshot mentions supergroups or migration. technical.md:50 and 297 and phase-3:31 also depend on the chat id and on "added".
  - core.telegram.org/api/channel: clients "should automatically migrate basic groups to supergroups if an admin tries to execute an action that is only supported by supergroups". A third-party guide (docs.chatkeeper.app) counts changing an admin's rights as such an action.
  - The upgrade changes the id to `-100…` and sends `migrate_to_chat_id` and `migrate_from_chat_id`.
  - Whether a pin-only admin role triggers the upgrade is unverified, so the runbook handles both outcomes.
- **Applied:**
  - `discover` prints each chat's type and follows `migrate_to_chat_id`.
  - The runbook uses only a supergroup id, and phase 5's evidence names the chat type.
  - `isInChat` defines "added" (not in the chat before, in it after) for both the Worker and the welcome.
  - The Worker logs a migration of the allowed chat.
  - The fixed object name (see above).
  - The ⚠️ line reflects the bot's status at the time the welcome is posted.
  - A project lesson records the trap.

### R6 — Answering Граю again after Пас breaks on the per-pool unique index · high · consensus · verified
- **Raised by:** AT-F3, IA-F1, PE-F3.
- **Evidence:**
  - technical.md:123-124 defines the unique index, and design.md:262-265 lets people switch answers both ways.
  - There is no `OR IGNORE` or `ON CONFLICT` anywhere in the spec.
  - A plain insert throws inside `transactionSync`, so the answer rolls back, and R1 turns that into a stall.
- **Applied:**
  - `events` is append-only, with no unique index and no CHECK on `kind`, and one typed `recordEvent` writer.
  - The stats queries count join, pass and pool_open once per pool and person, placed by their first event.
  - `pools.size` loses its CHECK; the parser enforces the bounds.
  - A must-have test for ✅ → ❌ → ✅.

### R7 — A failing timer action loops the alarm and can exhaust the free plan · high · unique-insight · verified
- **Raised by:** AT-F7. IA-F3 also noted that the spec gives two different re-arm rules.
- **Evidence:**
  - technical.md:234-238: a failing job is "logged", then `arm()` points the alarm at its past due time, so it fires again at once. Only "unexpected" errors back off.
  - technical.md:89-90 and 232-233 give two different re-arm rules.
  - Each alarm run counts as one request and each `setAlarm` as one row written. A loop would use up the 100k daily caps within minutes, and every update would error until 00:00 UTC.
- **Applied:**
  - Retry state on each pool (`timer_attempts`, `timer_retry_at`), with backoff of 1, 2 and 4 minutes. After that the action is given up: the ping is skipped, or the pool is closed by a minimal update.
  - The alarm is computed and set in the same synchronous block as the commit, and there is one re-arm rule.
  - After an unexpected error, the alarm moves 60 s ahead and is never re-armed to a past time.
  - A must-have test.

### R8 — `jobs` duplicates pool timing and ties `chat/` to `pools/` · medium · consensus · verified · contradiction resolved
- **Raised by:** PE-F4 and PA-F1. CQ-F5 objected to the layering and to a "pure" planner that also arms the alarm. IA-F3 asked where `closePool` lives and noted that phase 8 needs phase 7.
- **Evidence:**
  - technical.md:133-138 versus 152-160 and 224-226: each job copies a pool column.
  - technical.md:165-167 lists `jobs.ts` as pure, while 358 says it also arms the alarm.
  - phase-7:25-26 and phase-8:30: `closePool` must cancel jobs.
- **Contradiction:** CQ proposed a generic jobs registry; PE and PA proposed dropping the table. I chose dropping it, and CQ's layering concern is met by wiring through `bot.ts`.
- **Applied:**
  - No `jobs` table. Migration 4 adds `start_pinged`, `timer_attempts` and `timer_retry_at` to `pools`.
  - `pool-timers.ts` owns the planner and the actions, and `chat/jobs.ts` is removed.
  - Phase 8 gets `needs: [6, 7]` and loses `same-files-as`.

### R9 — No grammY-free room API for the alarm path · medium · consensus · verified
- **Raised by:** CQ-F2, IA-F3, PE-F2.
- **Evidence:**
  - technical.md:76-81 and 354: `ctx.room.commit` records an update id and lives on grammY's context.
  - technical.md:99-161: no table stores the chat id.
  - phase-7:25-26: `closePool` has no home.
- **Applied:**
  - `src/chat/room.ts` provides `tx`, `write`, `clock`, `random`, `chatId` and `api`, and `ctx.room` wraps it.
  - `src/pools/pool-actions.ts` holds answers, card refresh, closing and announcements for callbacks, `/join` and timers.

### R10 — Phase 2 can't test its own contract · medium · consensus · verified
- **Raised by:** CQ-F3, SYN.
- **Evidence:** phase-2:41-43 says the phase "registers no features", yet phase-2:51-52 requires tests of the 500 and 200 paths and of `/x@otherbot`. design.md:62 says "No test hooks in bot code".
- **Applied:** `features` becomes a test seam alongside `clock` and `random`, and the bot is built lazily on the first queued task.

### R11 — `/pool` ignores yesterday, and the DST copy contradicts Temporal · medium · consensus · verified
- **Raised by:** AT-F6, SYN.
- **Evidence:**
  - technical.md:188-190 looks only at today, so `/pool cs2 23:45` sent at 00:10 lands 23.5 h ahead.
  - design.md:288-289 says a gap time moves to "the next valid minute". Temporal's `compatible` actually moves it later by the length of the gap: 03:30 becomes 04:30 on Kyiv's spring-forward night.
- **Applied:**
  - Take the nearest occurrence among yesterday, today and tomorrow, counted in calendar days.
  - Copy fixed.
  - Test rows for 00:10, 23:50, exactly 60 minutes, and both DST nights.

### R12 — Day labels go stale overnight · medium · consensus · verified
- **Raised by:** AT-F9, PA-F4, SYN.
- **Evidence:** design.md:142-143 promises that "сьогодні stays true after midnight", but cards render only on taps and closes.
- **Applied:** the alarm fires at Kyiv midnight while an open card shows a day label, and re-renders it.

### R13 — `/join` replies resolve to the wrong pool · medium · consensus · verified
- **Raised by:** AT-F5, SYN.
- **Evidence:**
  - technical.md:204 lets a reply to a closed card fall through to the newest pool, but design.md:246 says to answer "Цей пул уже закрито.".
  - People reply to the bot's pings, which are replies to the card, not the card itself. Telegram doesn't nest `reply_to_message`, so the card can't be found from them.
- **Applied:** a `pool_messages(message_id, pool_id)` table records every message the bot posts for a pool, and the rule in technical.md is fixed.

### R14 — Leaves get undone · medium · consensus · verified (that the service message's `from` is the leaver is inferred)
- **Raised by:** AT-F4 and IA-F5 (the leaver's own service message); PA-F3 (`restricted` with `is_member: false`).
- **Evidence:**
  - technical.md:170-172 counts every message's sender as a sighting, and a restricted member who left fits neither rule.
  - Messages and `chat_member` updates sit on different queues (wave-1:114-117), so they can arrive in either order.
- **Applied:**
  - `isInChat`, and service messages no longer count as sightings.
  - `left_chat_member` marks that user out.
  - Tests for both arrival orders, and a design.md row for the hand-written predicate.

### R15 — Outdated buttons have no outcome, the draw message can be empty, and the start ping can tag nobody · medium · unique-insight · verified
- **Raised by:** AT-F8.
- **Evidence:** design.md:222-237 has no toast for 🎲 with an empty bench or for 🔔 when everyone has answered. technical.md:201-203 has the draw report "who moved in and who moved out".
- **Correction:** AT wrote that a draw of 6 players for 5 seats keeps the same five "5 times out of 6". It is 1 in 6, since the six possible squads are equally likely. The empty message is still real in that case.
- **Applied:** two new toasts; the draw message lists the whole squad and the whole bench; no start ping when nobody plays.

### R16 — After an outage, queued commands replay late · medium · unique-insight · verified
- **Raised by:** AT-F10.
- **Evidence:**
  - design.md:285-286 accepts messages up to 24 h old.
  - Handlers use `clock()`, not `message.date`.
  - An outage at the Worker level (a bad deploy, the daily cap) bypasses R1's cap.
- **Applied:** commands resolve times against the message's date. A command more than 10 minutes old is counted where it counts and otherwise ignored.

### R17 — The game word isn't escaped · medium · consensus · verified
- **Raised by:** AT-F11, SYN.
- **Evidence:** technical.md:176-177 names escaping for names only, and technical.md:163 stores the game word as typed.
- **Applied:** every string a user provides is escaped, and the format tests include `&` and `<`.

### R18 — The setup script is typed and tested as Worker code · medium · consensus · inferred (workerd has no `process` without `nodejs_compat`)
- **Raised by:** CQ-F6, IA-F7.
- **Evidence:**
  - phase-4:14 and 18 put the script in the root tsconfig and test it in workerd.
  - technical.md:321-324 defines a single workerd test project.
  - IA adds that the generated `worker-configuration.d.ts` falls under `biome check .`.
- **Applied:**
  - The script splits into `scripts/telegram-setup.ts`, pure and tested, and `scripts/configure-telegram.ts`, a Node shell that uses grammY's `Api` and that tests never import.
  - `scripts/tsconfig.json`, and `tsc --noEmit -p scripts` in `check`.
  - Biome ignores the generated file.

### R19 — The welcome is built twice, and `hi` has two homes · medium · consensus · verified
- **Raised by:** CQ-F7, PE-F5, IA-F10. PA-F2 adds that the script's method list lacks `sendMessage` and `getChatMember`.
- **Evidence:** phase-3:17 and 31-33; phase-4:41; technical.md:211, 253 and 299.
- **Applied:**
  - `src/welcome.ts` provides `welcomeMessage({ isAdmin })` for both paths.
  - `HI_CALLBACK` lives in `src/telegram.ts`.
  - A catch-all for unknown callback data is registered last, in phase 3.
  - The script's methods are listed.

### R20 — Some deliverables are bigger than one TDD commit · medium · unique-insight · verified
- **Raised by:** CQ-F8.
- **Evidence:** phase-6:42, phase-8:38, phase-2:51.
- **Applied:** phases 2, 6 and 8 are split with `phase task`.

### R21 — `/all` and 🔔 can hit the group's 20-messages-a-minute limit · medium · SYN · fork F1
- **Evidence:**
  - research wave-0:50-52: "In a group, bots are not be able to send more than 20 messages per minute."
  - design.md:42: no cooldown, and every call is counted.
  - technical.md:257-258: a 429 asking to wait more than 5 s fails at once.
- **Applied:** as Taras answered.

### R22 — Phase 8 uses phase 7's `closePool` but declares only `needs: [6]` · low · consensus · verified
- **Raised by:** IA-F3, SYN.
- **Applied:** together with R8.

### R23 — Phase 3 changes `wrangler.jsonc` without regenerating its types · low · unique-insight · verified
- **Raised by:** CQ-F11.
- **Applied:** phase 3's file list now includes the regenerated `worker-configuration.d.ts`.

### R24 — Kyiv time is handled in three modules · low · unique-insight · verified
- **Raised by:** CQ-F9.
- **Applied:** `src/kyiv-time.ts` holds the zone, wall time to instant, the labels and the month window.

### R25 — The Worker's chat-id lookup must track `ALLOWED_UPDATES` · low · consensus · verified
- **Raised by:** PE-F6, PA-F5.
- **Applied:** `chatIdOf(update)` sits beside `ALLOWED_UPDATES` in `src/telegram.ts`, with a test for each allowed type. `ALLOWED_UPDATES` moves to phase 2.

### R26 — Worker tests share one object · low · unique-insight · verified
- **Raised by:** PA-F7.
- **Applied:** object tests use unique names, and Worker tests call `reset()` before each test. What `reset()` clears in plugin 1.8 is checked when phase 2 builds the harness.

### R27 — A bench member passing may announce a move-up that didn't happen · low · unique-insight · verified
- **Raised by:** AT-F13.
- **Applied:** move-ups are the squad after minus the squad before, leaving out the person who acted.

### R28 — Bot accounts and channel identities reach the handlers · low · unique-insight · verified (by absence)
- **Raised by:** AT-F14.
- **Applied:** messages and taps from a bot, or with `sender_chat`, are ignored.

### R29 — The budget misstates Durable Object billing · low · SYN · verified
- **Evidence:**
  - technical.md:240-242 and design.md:54 say "a full day resident is about 10,800 of the free 13,000 GB-s".
  - Cloudflare's pricing page bills duration only while an object runs, or sits idle but unable to hibernate. Inactive objects aren't billed, so a per-minute sweep would cost a few GB-s a day.
- **Applied:** the rationale is corrected. The decision stands on other grounds: exact minutes, no per-minute wake-ups and no gaps while cron changes propagate.

### R30 — Small platform claims · low · consensus
- **Raised by:** IA-F11, PA-F8.
- **Evidence and fixes:**
  - Button `style` comes from Bot API 9.4 (wave-0:54), not 10.3. Its values are checked against `grammy/types` at build time.
  - `wrangler dev` can stop alarms after a hot reload (wave-2:138-140), so restart it before PR B's timer check.
  - `timingSafeEqual` needs inputs of equal length; Workers' docs say so (SYN, from platform knowledge).
- **Applied:** design.md and pr-opening.md.

### R31 — The author is pinged by their own pool · low · SYN · verified
- **Evidence:** design.md:117-118 makes names under a card mentions, and design.md:178 opens with `📢 {author} збирає…`.
- **Applied:** the author's name in the opening message is plain text.

## Rejected or unverified

- **PA-F2 (rejected):** keep pending updates, let the bot greet from the pending "added" update, and drop the `welcome` subcommand. Replaying the setup window means acting on stale commands, and the welcome's ⚠️ line would depend on how the bot was added. The script instead posts the welcome last, once the bot is an admin. PA's point that the script lacked `sendMessage` and `getChatMember` is applied (R19).
- **PA-F6 (rejected for the MVP):** seed the roster from `getChatAdministrators`. The first "added" event is dropped by design, so seeding would need its own trigger. 👋 and ordinary chat cover seven people, and phase 5 checks that all seven are known.
- **PA-F5 (rejected):** a grammY router in the Worker behind `webhookCallback`. It throws after 10 s by default and answers before the object's outcome is known. Using grammY's `Api` for `leaveChat` and the script is applied.
- **CQ-F1 (rejected):** storage errors rethrow without a cap. A deterministic storage error, such as a constraint the code breaks, is exactly the stall. The 5-minute floor already covers transient outages.
- **IA-F1 (narrowed):** Telegram 5xx, network errors and 429 answer 500. Now only while nothing was committed or delivered, so a retry can't duplicate anything.
- **AT-F1 (rejected):** make "squad complete" a retrying job. Announcements sent once stay at most once; the card and the start ping retry.
- **CQ-F5 (superseded by R8):** a generic jobs registry.
- **AT-F7 (superseded by R8):** attempts on the jobs table. R8's retry columns on `pools` replace it.
- **AT-F12 (not needed):** a `deleteWebhook`-and-rediscover step. In the go-live order, `discover` already runs before the webhook exists.
- **IA-F4 (not applied):** never `leaveChat` a chat whose `migrate_from_chat_id` is the allowed one. With a supergroup id at go-live, no later upgrade can happen, and a migration is logged.
- **"Грали" on a card the author closed before its start (SYN, not changed):** the final copy is Taras's.
- **`date_time` entities for the card's time (PA-F4, unverified):** what they render is unknown. The midnight re-render keeps the final copy.
- **`wrangler deploy --var KEY:VALUE` (IA-F11, unverified):** kept as written; research doesn't cover it.
- **"query is too old" on late callback answers (PE-F2, AT-F1, inferred):** harmless under the new failure policy.
- **The workerd PR that lets an object finish after its caller disconnects (AT-F1's evidence, wave-2:87-89, unverified):** it is four days old. The design doesn't depend on it beyond dedupe.
