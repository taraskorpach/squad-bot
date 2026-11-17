---
kind: decision
applies-to: [phase 5, 7, 8]
created: 2026-11-17T09:50:25+02:00
---

# Announcements go out as one message; only tag messages are chunked

The messages that tag a whole group in one sentence go out as one message whatever their size:
- `🎮 Склад на … зібрано: …` (phase 6);
- `🎲 Жереб кинуто. У склад: … На лаву: …` (phase 7);
- `✖️ Пул на … закрито автором. …` (phase 7).

Only the tag messages split their mentions by `MENTION_CHUNK`: `/all`, a new pool's opening
message, and 🔔.

- **Why:** the design's copy is one sentence each, and the draw's would make no sense split
  across messages. Seven people make at most six mentions, and the squad is at most ten.
- **Risk:** the chunk exists because a sixth mention in one message might not notify, which
  phase 5's mention test settles. If it doesn't notify, these announcements under-notify their
  sixth person and later ones.
- **How to apply:**
  - Phase 8's start ping `⏰ {game} — час! {mentions}` follows the same rule: one message.
  - If phase 5 finds that `MENTION_CHUNK` must stay at 5, the announcements get chunks too, in
    the next code PR: the first chunk keeps the sentence, and the rest go out as `📢 {mentions}`.
- **Source:** phase 7 (this session).
