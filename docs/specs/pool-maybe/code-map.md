# Code Map — Pool Maybe

Load-bearing files this spec depends on or introduces. Only list files a new agent
needs to know exist to navigate the code — not every file that's touched.

## Introduced by this spec

| File | Role | Phase |
|------|------|-------|

## Existing files touched

| File | Why we care | Ledger |
|------|-------------|--------|
| `src/chat/schema.ts` | Migration 5 rebuilt `answers` without its CHECK; the answer kinds are `Choice` in code | |
| `src/pools/pool-rules.ts` | `Choice` has `maybe`; `Lineup.maybe`; a maybe frees a seat like a pass | |
| `src/pools/pool-messages.ts` | `startPingText` asks the maybes in a second line | |

## External references

-
