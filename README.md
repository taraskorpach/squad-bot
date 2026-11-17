# squad-bot

A Telegram bot for one group chat of seven friends. `/all` tags everyone, `/pool` gathers
players for a game on one live card, and `/stats` keeps the group's running jokes as
leaderboards. It runs on Cloudflare Workers Free, with one Durable Object for the chat.

The design and the reasons behind it are in [`docs/specs/mvp/`](docs/specs/mvp/). This file is
the runbook: going live, deploys and local development.

## Settings

The bot reads four secrets. One bot serves both the friends' chat and a test group, so the same
four keys, with the same token, go in two gitignored files:

- `.dev.vars` for the test group, which `wrangler dev` reads;
- `.prod.vars` for the friends' chat, which the setup script and `wrangler secret bulk` read.

Copy `.dev.vars.example` to start either one.

| Key               | Value                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| `BOT_TOKEN`       | The bot's token from @BotFather                                               |
| `WEBHOOK_SECRET`  | 32 to 256 characters of `A-Za-z0-9_-`, generated once in the password manager |
| `ALLOWED_CHAT_ID` | The chat's supergroup id, `-100…`, as `discover` prints it                    |
| `BOT_INFO`        | The bot's `getMe` JSON on one line, as `discover` prints it                   |

The setup script reads the file named with `--env`, `.dev.vars` by default:

```sh
npm run telegram:configure -- --env .prod.vars <command>
```

Every command prints the bot's `@username` first, so check it before going on.

## Go live

Do this once, in this order. Step 5 deploys, and the deploy fails while any of the four secrets
is missing on the Worker.

1. **Accounts.**
   - A GitHub repo.
   - A Cloudflare account on the Free plan, which asks for no card. Open Workers & Pages once,
     so the account gets its `workers.dev` subdomain, and run `npx wrangler login`. Leave
     Workers Builds off (no Git connection in the dashboard): deploys come only from GitHub
     Actions, after the checks.
   - One bot in @BotFather, and a test group of at least two accounts where it is an admin
     with only the right to pin messages.
   - The GitHub Actions secrets `CLOUDFLARE_API_TOKEN` (a token from the "Edit Cloudflare
     Workers" template) and `CLOUDFLARE_ACCOUNT_ID`.
2. **Add the bot to the chat** as an admin with only the right to pin messages. Admins receive
   every message, so privacy mode can stay on.
3. **Find the chat's id.** Put `BOT_TOKEN` in `.prod.vars`, post any message in the chat, then
   run:

   ```sh
   npm run telegram:configure -- --env .prod.vars discover
   ```

   It prints `BOT_INFO` and the groups in the bot's pending updates. Use the supergroup's
   `-100…` id.
   - Making the bot an admin may have upgraded a basic group to a supergroup with a new id.
     `discover` shows both and says which one to use.
   - If the chat is still a basic group, turn on a setting only supergroups have, such as chat
     history visible to new members. Post a message, then run `discover` again.
   - Pending updates last 24 hours. `discover` works only until step 6 sets the webhook.
   - The test group shows up too if it had a message in the last day. Its id is the one
     `.dev.vars` needs, so note it now.
4. **Set the secrets.** Fill in all four keys in `.prod.vars`, then send them to the Worker:

   ```sh
   npx wrangler secret bulk .prod.vars
   ```

   The first time, wrangler offers to create the Worker: say yes. The Worker and the setup script
   then read the same `WEBHOOK_SECRET`.
5. **Merge PR A.** The merge runs the `deploy` workflow: the checks, then `wrangler deploy`. Wait
   for it to go green. The Worker's URL is `https://squad-bot.<subdomain>.workers.dev`.
6. **Point Telegram at the Worker:**

   ```sh
   npm run telegram:configure -- --env .prod.vars webhook https://squad-bot.<subdomain>.workers.dev
   ```

   It first sends the Worker the request Telegram will send, and stops unless the answer is 200.
   - A 401 means the Worker holds another `WEBHOOK_SECRET`.
   - A 404 means nothing is deployed at that URL.

   Then it sets the webhook and the command menu. The updates that waited during setup are
   dropped, so nothing sent then is acted on late.
7. **Post the welcome:**

   ```sh
   npm run telegram:configure -- --env .prod.vars welcome
   ```

   Everyone who taps 👋 or writes in the chat becomes known to `/all`.

## Deploys

Every merge to `main` deploys once the checks pass (`.github/workflows/deploy.yml`). To deploy
`main` again without a merge, run the `deploy` workflow from the Actions tab. The webhook and the
menu stay set across deploys. Run `webhook` again only when the Worker's URL changes.

## Local development

The same bot runs locally in the test group, where you can try taps from two people. A bot has
one webhook, though. Once the bot is live, pointing it at your machine takes it away from the
friends' chat: the chat gets no answers, and what it sends meanwhile is lost. So keep sessions
short, and always finish with step 5.

1. Copy `.dev.vars.example` to `.dev.vars`. Put in the bot's token and its `BOT_INFO` (the same
   as in `.prod.vars`), a `WEBHOOK_SECRET`, and the test group's supergroup id as
   `ALLOWED_CHAT_ID`.
   - Before go-live, `discover` finds the id: post a message in the test group, then run
     `npm run telegram:configure -- discover`.
   - Once a webhook is set, `discover` refuses to run. The live Worker logs the id instead: run
     `npx wrangler tail`, post in the test group, and look for `Ignored update … from chat -100…`.
2. Start the Worker with a public URL:

   ```sh
   npx wrangler dev --tunnel
   ```

   It prints a `https://….trycloudflare.com` address, which changes on every start.
3. Point the bot at the new address each time you start, from another terminal:

   ```sh
   npm run telegram:configure -- webhook https://….trycloudflare.com
   ```

   The first time, also run `npm run telegram:configure -- welcome`.
4. Restart `wrangler dev` before trying anything an alarm runs, such as a pool's timers. After a
   hot reload it can stop running alarms until it starts again.
5. When you stop, point the bot back at the Worker:

   ```sh
   npm run telegram:configure -- --env .prod.vars webhook https://squad-bot.<subdomain>.workers.dev
   ```

Before a commit, run:

- `npm run check`: Biome, the type checks, a run of the setup script under Node and
  `wrangler types --check`;
- `npm test`: Vitest inside workerd.
