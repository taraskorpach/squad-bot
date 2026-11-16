---
kind: gotcha
paths: [scripts/**, src/index.ts, src/telegram.ts]
created: 2026-11-16T18:40:58+02:00
seen-in: [mvp]
---

# Upgrading a basic group to a supergroup changes its chat id

Telegram clients upgrade a basic group to a supergroup when an admin does something only supergroups support, most likely including giving the bot a custom admin role such as pin-only. The chat then gets a new `-100…` id. The old group's last message carries `migrate_to_chat_id`, and the new one's first message carries `migrate_from_chat_id`. Read the chat id only after the bot is an admin, follow `migrate_to_chat_id`, and use only a supergroup's id. An allow-list holding the old id makes the bot deaf.

Evidence: core.telegram.org/api/channel: clients "should automatically migrate basic groups to supergroups if an admin tries to execute an action that is only supported by supergroups". A third-party guide, docs.chatkeeper.app/en/instruction/supergroup.html, counts changing an admin's rights as such an action. Whether a pin-only role alone triggers the upgrade is unverified, so the mvp runbook handles both outcomes. `t.me/c/…` message links work only in supergroups.
