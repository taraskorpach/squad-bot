# Phase 2 — hand-off note

Recon done: `research/phase-2/2026-11-16-scaffold-recon.md`. Preflight not run yet; no code yet.

## Pick up from here
1. Run `spec-driven:phase-preflight` on chunk 1 (deliverables 1–5) with the recon note, then TDD.
2. Planned split beyond the phase's file list (keeps `chat-room.ts` under 250 lines):
   `src/settings.ts` (ALLOWED_CHAT_ID, BOT_INFO parsed once, named errors, used by Worker and object),
   `src/chat/serial-queue.ts`, `src/chat/update-log.ts` (processed/failed updates SQL),
   `src/chat/failure-policy.ts` (pure redeliver decision, table-tested).
3. Commit order: scaffold → harness + self-test → CI → telegram.ts → migrations/Room →
   queue + dedupe (`ctx.room.commit`) → Worker → failure policy + delivered marker → grammY caps and gate.
4. Transformers: install autoRetry first, the delivered marker last (last installed is outermost).
5. Auto-retry tests without sleeping: fake answers `retry_after: 0` (count calls) and `retry_after: 6` (no wait).

## Environment
- No npm on this machine: run it as `bun x npm@11.21.2 …` (Node 24.22 via pnpm). CI uses Node 26 from `.nvmrc`.

## Open checks
- Does `reset()` give Worker tests a fresh object instance (so a `features` swap reaches a new bot)?
- Can the 10 s client timeout be tested with fake timers on a bot built in the test? Else assert the client options.
