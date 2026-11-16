---
date: 2026-11-16
wave: 0
lens: inherited
slug: telegram-platform
brief: product-brief.md
from: a Claude Code session started in ~/Projects/crm (an unrelated project)
---

# Recon Wave 0 — telegram-platform

*Source of record — do not edit. Distilled into the spec by `/spec create`.*

Read against Bot API 10.4 (November 9, 2026). A = core.telegram.org/bots/api,
F = /bots/features, Q = /bots/faq, C = /bots/api-changelog. ✓ = the quoted sentence was
re-found in the pages saved on 2026-11-16; [unverified] = community source only.

## Verified

1. **No member list.** No method lists a group's members. getChatAdministrators gives
   admins, getChatMemberCount a number, and getChatMember needs a known user id and is
   "only guaranteed to work for other users if the bot is an administrator in the chat" ✓
   (A#getchatmember). `chat_member` updates need admin rights and `chat_member` named in
   allowed_updates, which the default set leaves out (A#update). Join/leave service
   messages reach every bot (Q). MTProto `channels.getParticipants` accepts a bot token
   but needs an api_id. So the bot keeps its own roster.
2. **Mentions by id work for group members.** Use a text_mention entity, HTML
   `<a href="tg://user?id=…">` or MarkdownV2. "Unless the user is a member of the chat where
   they were mentioned, these mentions are only guaranteed to work if the user has
   contacted the bot in private…" ✓ (A#formatting-options). Mentions notify even in a muted
   group unless the user muted the sender or turned off mention alerts for that chat
   (telegram.org/tour/groups#mentions). No documented cap; "up to 50, only the first 5
   notify" is [unverified] (limits.tginfo.me/en).
3. **Privacy mode (on by default) loses bare commands.** A privacy-mode bot gets
   `/cmd@this_bot`, a bare `/cmd` only if it was the "last bot to send a message to the
   group" ✓, replies to its own messages, and service messages. "Each particular message
   can only be available to one privacy-enabled bot at a time" ✓; replies win. "Bot admins
   always receive all messages" ✓ (F#privacy-mode). Turning privacy off in BotFather
   (`/setprivacy`) takes effect only after the bot is removed and re-added. Other bots'
   messages stay hidden unless Bot-to-Bot Communication Mode (10.0) is on. So a bare
   `/domikpisik` is lost whenever the old tag bot posted last or it replies to that bot.
4. **Commands.** A bot that sees every message also gets `/cmd@otherbot` and must check
   the suffix itself; updates can carry commands the bot never registered (F#command-scopes).
   setMyCommands with BotCommandScopeAllGroupChats shows the menu; names are 1–32 chars of
   `[a-z0-9_]`; choosing a command from the menu sends it at once. `BotCommand.is_ephemeral`
   exists ✓ (10.2).
5. **One live message with buttons is supported.** Always call answerCallbackQuery (else a
   spinner); its text (≤200 chars) shows as a toast, `show_alert` as a modal. A bot can edit
   its own messages with inline keyboards; the only documented edit window (48 h) is for
   business messages, while deleteMessage works only within 48 h. Limits: ~1 message per
   second per chat, and "In a group, bots are not be able to send more than 20 messages per
   minute." ✓ (Q). A 429 carries `retry_after`. Whether edits count toward that limit is
   [unverified] (grammy.dev/advanced/flood says yes). An edit that changes nothing fails with
   MESSAGE_NOT_MODIFIED. Newer: button `style` (9.4), disabled buttons (10.3), and an
   ephemeral message to one user within 15 s of their action ✓ (10.3/10.4), not guaranteed.
6. **Native polls cannot be the roster.** sendPoll supports non-anonymous votes, 1–12
   options, revoting, user-added options and a close date (C, April 2026). Bots receive
   `poll_answer` only for polls they sent; options can't be edited; the question takes no
   mentions; nothing stops a poll at 5. Fine for "which game / what time?" votes.
7. **Reactions.** `message_reaction` updates need admin and explicit allowed_updates;
   reactions set by bots aren't delivered. setMessageReaction sets one reaction per message.
8. **Pinning** needs admin with `can_pin_messages`; `disable_notification` skips the
   notification that otherwise reaches even muted members.
9. **No scheduled sends.** Reminders and expiry need the bot's own scheduler and stored
   state. Telegram keeps pending updates for at most 24 h. `date_time` entities (9.5) show a
   time in each viewer's own format.
10. **Checklists are out.** sendChecklist works only "on behalf of a connected business
    account" ✓; in a group a bot can only read checklists users post (Premium).

## Reuse

- Make the bot an admin with only the Pin right: commands are never lost, `chat_member`
  and reaction updates arrive, getChatMember is reliable, pinning works.
- Set allowed_updates explicitly: message, edited_message, callback_query, chat_member,
  my_chat_member (+ message_reaction if reactions are used).
- Roster = the members' user ids, kept current from messages and `chat_member` updates,
  seeded from getChatAdministrators. No MTProto at this size.
- Pool = one message with buttons, a toast per press, batched edits, a disabled "full"
  button; "pool full" goes out as a new message with mentions (edits are not known to notify).
- Close finished pools by editing them; never rely on deleting.

## Still open

- Does the 6th mention in one message notify? Test in the chat, or send at most 5 per message.
- Do edits count toward the 20-per-minute group limit?
- The old tag bot: once ours sees every message, a bare `/all` may trigger both. Retire it
  or name our command differently.
- Stack and hosting were not researched here (prep Wave 1).
