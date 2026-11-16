---
kind: gotcha
paths: [scripts/**]
created: 2026-11-16T23:50:08+02:00
seen-in: [mvp]
---

# `getWebhookInfo` shows a webhook's errors only after Telegram tried a delivery

`last_error_message` is the most recent error that happened while delivering an update. Right after `setWebhook` with `drop_pending_updates`, nothing has been delivered yet. So the check passes even when the Worker answers every update with 401 (a different `WEBHOOK_SECRET`), 404 (a wrong URL) or 500 (only the draft Worker). To know the webhook works before anyone writes in the chat, send Telegram's request yourself. POST an update that has no chat, with the secret header; the Worker ignores it and answers 200.

Evidence:
- The Bot API's `WebhookInfo` defines `last_error_message` as "the most recent error that happened when trying to deliver an update via webhook".
- `src/index.ts:13-16` answers 404 off the path and 401 on a wrong secret.
- `src/index.ts:24-28` answers 200 to an update whose chat isn't the allowed one, including one with no chat.
- Found in mvp phase 4 preflight.
