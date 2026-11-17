---
needs: []
code: false
---

# Phase 1 — Accounts and repo

**Goal:** Everything the bot runs on exists: a GitHub repo, a Cloudflare account, a production bot and a dev bot, and deploy credentials stored in GitHub.

**Outcome:** Nothing changes in the chat yet. Free, about twenty minutes in web consoles. No risk: nothing touches the chat.

**Files to touch:**
- none in the repo; `git remote add origin` and the first push of `main`

## Implementation guidance

Only Taras can do these; each item is ticked with its evidence (a link, a name or a date). Order
matters only for the last item, which needs the repo and the Cloudflare account.

- **GitHub repo.** Public or private is Taras's call: Actions minutes are unlimited on public
  repos and 2,000 a month on private ones, far more than this needs. Push the existing `main`
  (the seed and this spec) so worktrees and PRs have an origin.
- **Cloudflare.** Sign up with email and password on the Free plan; no card is asked for
  (wave 2 §1). Open Workers & Pages once so the account gets its workers.dev subdomain: the
  first deploy runs in CI and can't choose one. Run `npx wrangler login` on Taras's machine,
  which phase 5 needs for `wrangler secret put`.
- **Bots.** In @BotFather: a production bot (its name is what the chat sees) and a dev bot for
  testing. Privacy mode stays on: the production bot becomes an admin in phase 5, and admins
  receive every message anyway (wave 0 §3). Keep both tokens in a password manager.
- **Test group.** Taras plus at least one other account, with the dev bot added as an admin with
  only the pin right, so taps from two people can be tried before each PR. Making it an admin
  may upgrade the group to a supergroup with a new id; phase 4's `discover` reports the right one.
- **Deploy credentials.** A Cloudflare API token from the "Edit Cloudflare Workers" template and
  the account id, saved as GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The production bot is **not** added to the friends' chat here: that is phase 5.

## Deliverables

- [x] GitHub repo created and `main` pushed (evidence: repo URL) — https://github.com/taraskorpach/squad-bot (private), main pushed 2026-11-16
- [ ] Cloudflare account on the Free plan, no card, with its workers.dev subdomain and `wrangler login` done on Taras's machine (evidence: account id and subdomain)
- [ ] Production bot created in @BotFather, token stored outside the repo (evidence: @username)
- [ ] Dev bot created and added to a test group of at least two accounts (evidence: @username)
- [x] `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` saved as GitHub Actions secrets (evidence: date) — gh secret list: CLOUDFLARE_API_TOKEN 2026-11-16T17:12:38Z, CLOUDFLARE_ACCOUNT_ID 2026-11-16T17:12:55Z

## Phase-local notes

- Never paste a token into the repo, an issue or a chat; `.dev.vars` is gitignored (phase 2).
- The friends' chat id is found in phase 5 with the setup script, not here.
