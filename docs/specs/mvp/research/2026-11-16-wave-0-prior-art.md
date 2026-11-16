---
date: 2026-11-16
wave: 0
lens: inherited
slug: prior-art
brief: product-brief.md
from: a Claude Code session started in ~/Projects/crm (an unrelated project)
---

# Recon Wave 0 — prior-art

*Source of record — do not edit. Distilled into the spec by `/spec create`.*

No single bot does everything this one needs. Discord pickup-queue bots have the
most developed pool mechanics (cap, ready check, expiry, controlled pings, stats).
PartitelleBot is the closest Telegram code. No bot found rotates "whoever sat out
last time plays first", and none has a silent joke counter.

Stars, last push, license and archived state were spot-checked with the GitHub API
on 2026-11-16; all matched. The project descriptions come from the research agent's
reading of each repo's README and docs.

## Verified

### Tag-all bots
| Project | What it does | Borrow | Avoid |
|---|---|---|---|
| [Matt0550/TagEveryoneTelegramBot](https://github.com/Matt0550/TagEveryoneTelegramBot) · Python, MIT, 26★, pushed 2026-08 | `/all` and `@all` ping an opt-in list | `/in` `/out`; adds people as they join; `/list` without pinging; 15 s cooldown per user; event log; `/stats` | up to 50 mentions per message; needs admin |
| [miloszowi/everyone-mention-telegram-bot](https://github.com/miloszowi/everyone-mention-telegram-bot) · Python, MIT, 23★, 2024-03 | named mention groups | `/join cs2`, then `@cs2` pings only that group | inline-mode extras |
| [eonae/pingerbot](https://github.com/eonae/pingerbot) · 7★, 2026-02 | `/ping` with #tags | works with privacy mode on | anyone can add anyone |
| [AnjanaMadu/MentionAllBot](https://github.com/AnjanaMadu/MentionAllBot) · 50★, archived | lists members through Telethon (MTProto) | batches of 5 mentions, 2 s apart; `/cancel` | admin-only, no opt-out |

### RSVP and "who's in" bots
| Project | What it does | Borrow | Avoid |
|---|---|---|---|
| [col/whos_in_bot](https://github.com/col/whos_in_bot) · Elixir, no license, 21★, 2021 | roll call: `/in` `/out` `/maybe` with a reason | reasons (`/out injured`); `/set_in_for` answers for someone; `/shh` `/louder` noise control | one roll call per chat; a new one wipes the old |
| [partitelle/partitelle-bot](https://github.com/partitelle/partitelle-bot) · Python, AGPL-3.0, 7★, pushed 2026-11-16 | weekly match sign-up list | one summary message edited in place; numbered free slots; "full" announcement; random teams; pins its message; Telegram ID as identity (names change); rules kept apart from Telegram code | refuses joins when full (no waitlist) |
| [HavenDV/PadelDubaiBot](https://github.com/HavenDV/PadelDubaiBot) · TypeScript, MIT, 0★, 2026-06 | padel sign-ups | one message with buttons per game; waitlist after the cap; moves the next person up and tags them; retries on 429 | cron and AI extras |
| [Nukesor/ultimate-poll-bot](https://github.com/Nukesor/ultimate-poll-bot) · Python, GPL-3.0, 144★, archived 2024 | polls (~2M users) | yes/no/maybe; closes at a due date with a "closing soon" notice; voters sorted by vote time | unmaintained, sprawling |

### Gaming queues and LFG
| Project | What it does | Borrow | Avoid |
|---|---|---|---|
| [Leshaka/PUBobot2](https://github.com/Leshaka/PUBobot2) · Python, GPL-3.0, 38★, 2026-02 | Discord pickup queues | several named queues; starts when full; 5-minute check-in listing only who isn't ready; a decline returns the queue to collecting, minus the decliner; `/expire`; `/promote` with cooldown and opt-in role; `/subme` `/subfor`; `/top` `/lastgame` | ratings, drafts |
| [NeatQueue](https://docs.neatqueue.com/commands) · hosted | 10-man queues | pings a role at size N; 300 s ready check, no-shows replaced or match cancelled; AFK removal after a warning with an "I'm here" button | MMR focus |
| [mrtolkien/inhouse_bot](https://github.com/mrtolkien/inhouse_bot) · Python, GPL-3.0, 115★, 2022 | League in-house games | longest wait goes first; a starting game drops its players from every other queue | queues by role |
| [Apollo](https://docs.apollo.fyi/reminders) · hosted | Discord events | cap with automatic waitlist and a notice on move-up; reminder 15 min before, to accepted only | paid tiers |
| [Sesh](https://sesh.fyi/manual/) · hosted | Discord events | waitlist, first in line gets a DM; RSVP changeable until start | paid limits |

## Reuse

Recurring UX patterns in the well-liked bots:
1. **One live roster message** edited in place, plus a command that reposts it at the bottom (PartitelleBot, PUBobot, WhosInBot `/shh`).
2. **One-tap buttons** instead of typed commands (PadelDubaiBot, NeatQueue, Apollo).
3. **In / out / maybe, optionally with a reason**; "maybe" takes no slot (WhosInBot, PartitelleBot, ultimate-poll-bot).
4. **Ordered overflow**: a waitlist that moves the next person up and pings them (PadelDubaiBot, Apollo, Sesh) or longest-wait-first (inhouse_bot). Random appears only for splitting teams. "Sat out last time plays first" exists only as a [manual guild rule](https://us.forums.blizzard.com/en/wow/t/how-does-your-guild-handle-who-sits-for-raids/689659?page=2).
5. **Ready check when the pool fills**: a timeout, ping only who hasn't confirmed, then refill (PUBobot2, NeatQueue).
6. **Expiry with a warning** (PUBobot `/expire`, NeatQueue AFK timer, ultimate-poll-bot due dates, Apollo's sign-up cutoff).
7. **Controlled pings**: opt-out, cooldown, pings at thresholds ("one more needed") rather than on every change (Matt0550, PUBobot, NeatQueue).
8. **A filled pool drops its players from other open pools** (inhouse_bot).
9. **Acting for someone else**, recorded with who did it (WhosInBot `/set_in_for`, PartitelleBot).
10. **Stats from an event log** rather than counters only (Matt0550, PUBobot `/top`).

Licences: MIT repos (Matt0550, miloszowi, PadelDubaiBot) may be read for code; GPL/AGPL
ones (PUBobot2, inhouse_bot, partitelle-bot, ultimate-poll-bot) for ideas only.

## Still open

- "At most 50 mentions per message, only the first 5 notify" comes only from a community
  source ([tginfo limits](https://limits.tginfo.me/en)). `/all` in a 7-person chat makes 6
  mentions: batch by 5 or test it in the chat. See the telegram-platform snapshot.
- Raid-Helper's docs need JavaScript; whether it rotates the bench is unknown.
- Whether the hosted @WhosInBot and @TagEveryone_TheBot are still online.
- Whether message edits count toward the 20-messages-per-minute group limit.
