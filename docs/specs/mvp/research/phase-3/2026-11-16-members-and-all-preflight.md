---
date: 2026-11-16
phase: 3
chunk: migration 2, roster rules, member learning, mentions, /all (deliverables 1–5), with 6–7 in view
inputs: [phases/phase-3-members-and-all.md, research/phase-3/2026-11-16-members-and-all-recon.md, technical.md, design.md, principles.md]
---

# Phase 3 preflight — members, mentions and /all

*Source of record — do not edit.*

Grounded in the recon's seam, which this session read in full: `src/` (every file),
`test/helpers/`, the phase 2 tests that guard the pipeline, and grammY 1.46.0's types and
`Context.react`. Two more facts checked here: `wrangler types` defaults to `--strict-vars`, so
`MENTION_CHUNK` will be typed as the literal `"5"`; and `tsconfig.json` has no
`allowImportingTsExtensions`.

## Findings that change the plan

1. **The file list misses where `MENTION_CHUNK` and the tag window live.** `technical.md:70` has
   the object's constructor reject a bad `MENTION_CHUNK` by name. That check belongs in
   `readRoomSettings` (`src/settings.ts:10-15`), which the constructor calls
   (`src/chat/chat-room.ts:30`). The window must be per object: `FEATURES` are module constants
   (`src/bot.ts:8`) handed to every `ChatRoom` in the isolate (`src/chat/chat-room.ts:21`), and the
   tests run many objects in one isolate (`test/helpers/rooms.ts:19-20`). So both go on `Room`
   (`src/chat/room.ts:3-29`, built at `src/chat/chat-room.ts:78-84`) and reach features through
   `UpdateRoom` (`src/context.ts:11-63`). Consequence: `src/settings.ts`, `src/chat/room.ts`,
   `src/chat/chat-room.ts` and `src/context.ts` join the phase's files, with
   `test/settings.test.ts:37-44` and `test/chat/schema.test.ts:73-81`.
2. **`.ts` extensions in `src/welcome.ts` don't compile yet.** The guidance wants `welcome.ts` to
   import `texts.ts` and `telegram.ts` "with `.ts` extensions", but `tsconfig.json:2-15` lacks
   `allowImportingTsExtensions`, so `tsc` stops with TS5097. Phase 4 lists "tsconfig.json (allow
   `.ts` imports)". Consequence: that line moves to phase 3, with `welcome.ts` (chunk 2).
3. **Learning runs before the gate, so it needs the gate's sender test too.** "Member learning
   runs first" can only mean first after `attachingRoom`, which sets `ctx.room`
   (`src/bot.ts:42,55-60`), and before `ignoringBotsAndChannels` (`src/bot.ts:63-67`), as
   `technical.md:95-97` orders it. The roster must then refuse bots and `sender_chat` messages
   itself: the same predicate the gate holds. Two copies of "a person sent this" would drift, so
   extract `personSending(update)` into `src/telegram.ts` (pure, beside `chatIdOf`), test it, and
   have the gate use it. The `sender_chat` half is load-bearing: a linked channel's automatic
   forward arrives with `from` = Telegram (777000), which is not a bot. The builders model that
   case already, a channel message from `users.taras` (`test/helpers/updates.ts:37-46`), and that
   is what lets `test/bot.test.ts:76-86` see the `sender_chat` branch at all.
4. **"Every Ukrainian string from `design.md`, plus a plural helper" would ship dead code in PR A.**
   Phase 3 sends only the welcome, the 👋 toast and the `/all` texts, and nothing in phases 2–4
   pluralizes: the first plural is phase 6's `{size} {місце|місця|місць}`. The house rule wins over
   the guidance (principles.md §16, no dead code). `src/texts.ts` starts with phase 3's strings,
   each phase adds its own, and the plural helper comes with phase 6's card header.
   Out of scope: phase 4 puts Ukrainian `COMMANDS` descriptions in `src/telegram.ts`, against
   "texts.ts holds every Ukrainian string"; flagged for phase 4's own preflight.
5. **Whose time an event records is unspecified, and late calls make it matter.** `events.at` is
   `INTEGER NOT NULL` (`technical.md:146-152`) with no owner. A stale `/all` is still counted
   (`design.md` → *Edge cases*, Outages), and phase 9 places events into Kyiv months by `at`
   (`technical.md:227,280`). Processing time would move a call made at 23:59 on the 31st,
   delivered after an outage, into the next month. Consequence: a default (below) and one line in
   `technical.md`'s data model.

## Clean Code against the chunk

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Names, one word per concept | Bites | Telegram's `User` (snake_case, `is_bot`) becomes our `Member` (`firstName`, never a bot) in `roster.ts` only. "Presence" is a member being in or out; "sighting" stays the word for a message or tap, as `technical.md` uses it |
| Small functions, one thing | Bites | The `/all` handler counts, checks staleness, checks the window, composes and sends: split the commit from the send path, each under 50 lines |
| Flag arguments | Inert | `welcomeMessage({ isAdmin })` is a named option; store functions take presences, not booleans |
| Command/query separation | Bites | The window's `claim(key, now, windowMs)` checks and records in one call: a deliberate test-and-set, named as one, since a separate check invites a missing record |
| Comments | Bites | Why-only JSDoc, as at `src/bot.ts:10-13,62,69`. The content-key list needs one line on why it lists content rather than service kinds |
| Errors and null | Bites | SQL `NULL` (`last_name`, `username`) becomes an absent field at `member-store.ts`; settings errors name the setting, never its value (`src/settings.ts:3`) |
| Boundaries | Bites | grammY types enter at `roster.ts` (`Update`) and the handlers (`BotContext`); mentions and stores never see them |
| Tests | Bites | Table tests with `it.each` for roster and mentions, the idiom of `test/telegram.test.ts:47-55` |
| Classes | Inert | One small class, the window |
| Simple design: no duplication | Violated, fix here | The sender test would exist twice (`src/bot.ts:63-67` and the roster): finding 3 |

## Clean Architecture against the chunk

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Dependency rule | Bites | `chat/` imports no feature (`technical.md:44`): the window is a generic keyed mechanism in `src/chat/`, and the 30 s rule stays with `/all`. `members/` → `stats/event-store.ts` points at the event record, which imports nothing from `members/` |
| Circles | Bites | Pure policy: `roster.ts`, `mentions.ts`, `texts.ts`. Adapters: `member-store.ts`, `event-store.ts`. Delivery: `member-handlers.ts`, `all-handlers.ts` |
| Plain data across boundaries | Bites | Stores return `Member` objects, not rows, as `recordFailure` returns `FailureCount` (`src/chat/update-log.ts:23-34`) |
| Humble Object | Bites | Handlers stay glue; decisions live in the pure modules; a few integration tests through `roomWith` cover the wiring |
| Acyclic dependencies | Bites | `bot.ts` imports the features, so nothing a feature needs can live in `bot.ts` |
| Screaming architecture | Inert | Feature folders already |

## SOLID against the chunk

| Rule | Verdict | Concrete consequence |
|---|---|---|
| SRP (actors) | Bites | Membership rules (roster), Telegram's HTML and the name rule (mentions), the copy (texts), persistence (stores), `/all` behaviour (handler): one actor each |
| OCP | Bites | Next variants: the pool-open tags (phase 6) and 🔔 (phase 7). Name the `📢 {mentions}` format for tagging, not for `/all`, and key the window by string so 🔔 can key it by pool |
| LSP | Inert | |
| ISP | Bites | `UpdateRoom` gains two getters (`mentionChunk`, the window), not `Room`'s surface; the shared action interface waits for phase 6 (`ledger/principle-actions-commit-through-update-room.md`) |
| DIP | Bites | Handlers call store functions over `SqlStorage` inside `commit` and `write`, the idiom of `src/chat/update-log.ts`; no repository classes |

## DDD against the chunk

| Rule | Verdict | Concrete consequence |
|---|---|---|
| Ubiquitous language | Bites | "Member" is a person the bot knows; Telegram's `ChatMember` is a status on the wire; "in the chat" is `isInChat`'s word |
| Entity or value | Bites | `Member` is an entity keyed by Telegram's user id, with refreshed name values; an event is an immutable record |
| Invariant ownership | Bites | "A member is never a bot": the roster, the only producer of presences. "Kinds are a union": `event-store.ts`'s type. "Names told apart among members in the chat": `mentions.ts` |
| Aggregates, cross-aggregate rules | Inert | Nothing spans members and events here |
| Anti-corruption layer | Bites | The roster turns updates into presences; nothing downstream reads `Update` |
| Domain events, specification | Inert | `events` is a stats record, not domain events |

## Guard blindness

- `wrangler types --check` (`package.json:7`, run by `.github/workflows/check.yml:17`) compares an
  env hash, so it sees a `vars` change: not blind.
- The append-only decision (`ledger/decision-events-append-only.md`) has no guard. Add one to the
  schema test: two identical events and an unknown kind both insert.
- The gate test sees the `sender_chat` branch only because the builder's channel message has a
  human `from` (finding 3). Say so at the builder, so a "more realistic" fake bot sender doesn't
  silently blind it.
- "Import-free" `texts.ts`, `telegram.ts` and `welcome.ts` have no guard until phase 4 runs the
  script under Node. Out of scope here; phase 4 should run it in CI.

## Seam and testability (deltas from the recon)

- Tests land beyond `test/members/`: a unit test for the window under `test/chat/`, and
  `test/stats/` for the event writer.
- A `MENTION_CHUNK` other than 5 can't reach an object test: the env is read at construction.
  The pure `chunk` tests cover sizes; one object test with six targets covers 5 + 1 at the real value.

## Amendments

1. Files to touch gain `src/settings.ts`, `src/chat/room.ts`, `src/chat/chat-room.ts`,
   `src/context.ts` and the window's module in `src/chat/`; `tsconfig.json`
   (`allowImportingTsExtensions`) moves from phase 4 to phase 3.
2. `parseMentionChunk` joins `src/settings.ts`; `RoomSettings.mentionChunk` goes to `Room` as
   `mentionChunk`, and features read `ctx.room.mentionChunk`.
3. The window is a keyed, in-memory mechanism, one per `Room`, read as `ctx.room.<window>`;
   `/all` claims its key for `TAG_WINDOW_MS` (30 s), a constant in `all-handlers.ts` until 🔔
   needs it too.
4. `personSending(update)` lands in `src/telegram.ts` as its own refactor commit, with tests; the
   gate and the roster both use it.
5. The roster defines an ordinary message as one carrying any of grammY's 20 content kinds, a
   list typed `satisfies readonly (keyof Message)[]`.
6. `src/texts.ts` holds the strings phase 3 sends; the plural helper arrives with phase 6. The
   phase guidance line changes accordingly.
7. Learning sits in `createBot`'s pipeline between `attachingRoom` and the gate, not in `FEATURES`,
   so tests that replace `features` still learn; one test pins that an update failing after
   learning is still redelivered.
8. The schema test guards the append-only decision: duplicate events and an unknown kind insert.
9. `technical.md`'s data model says whose time `events.at` is.

## Defaults applied

- Command events record the message's `date` (× 1000): when the person acted, not when the bot
  processed it. Taps, which carry no date, will use the room clock (phase 6).
- Any `/all` reply starts the 30 s window, the empty-state reply included: it is a message too.
- Mentions are ordered by display name in Ukrainian alphabetical order (`Intl.Collator('uk')`,
  next to the copy in `texts.ts`), joined with `, `; every chunk replies to the call.
- A shared first name without a last name gets ` @username` added (`Олег @oleg`); with neither,
  the first name stays.
- A person first heard of in a leave is saved anyway, as out, so stats always have a name.
- After the commit, each Telegram call (each chunk, the 👌) is caught and logged on its own.
- `EventKind` lists the kinds that exist now, `all` and `domikpisik`; phase 6 adds its three.

## Forks for you

None.
