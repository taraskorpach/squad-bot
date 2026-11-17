---
title: /artemisalwaysright — the bot reminds the chat that Artem is always right
tags: [jokes]
created: 2026-11-17T15:03:57+02:00
resolution: done without a spec in PR #4 (d3c0101); in the command menu since PR #5 (00bb16a). Not counted on /stats, no cooldown
---
Taras, 2026-11-17: "команда типу /artemisalwaysright коли пишемо, має видалятись повідомлення з
командою і бот має писати щось типу «Нагадую, Артем Поліченко завжди правий і це не
обговорюється.»"

The bot deletes the command message (it is an admin with every right in Кс?) and posts the line on
its own, not as a reply. Open: whether it counts on /stats like /domikpisik, whether repeats get
a cooldown like /all's 30 s window, and whether it stays out of the command menu as /domikpisik
does.
