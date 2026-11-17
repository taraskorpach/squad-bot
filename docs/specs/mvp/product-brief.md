# Squad Bot MVP — Product Brief

## Who & what
A group chat of seven friends, Taras among them, who play CS2 and other games together, wants a bot of its own: one that tags everyone, gathers players for a game, and keeps the group's running jokes as stats.

## Why
To find out whether anyone will play, they tag everyone through another bot, and the answers scatter down the chat: soon nobody can tell who agreed, who said no and who never answered.

## What we'll build
- /all tags everyone in the chat except whoever called it, at most once every 30 seconds, and the bot counts every call to see who calls it most.
- /domikpisik gets no reply at all; the bot only counts who sends it most.
- /pool opens a pool for a game and tags everyone. Game, size and start time are optional (CS2, 5 and now by default).
- Each pool is one message with answer buttons ✅ Граю and ❌ Пас. It updates in place and always shows who plays, who passed and who hasn't answered yet. Typing /join works too.
- A 🔔 button on the pool pings only those who haven't answered.
- When the pool fills, the bot posts a new message that tags the players.
- If more say Граю than the pool has seats, the latest to join wait on a bench in order. When a player drops out, the first on the bench moves up and is pinged. A one-time 🎲 button draws who sits out instead.
- If a pool has a start time, the bot tags its players (not the bench) once at that time. A pool closes by itself three hours after its start time, or three hours after it opened if it was for now.
- Several pools can be open at once, each with its own message. /pools lists the open ones and how full each is; /join without replying to a pool goes to the newest.
- /stats shows five all-time leaderboards: who calls /all, sends /domikpisik, says Граю, opens pools and says Пас most, plus how many joins there have been overall.

## The real change
"Who's playing?" stops being a pile of replies and becomes one list per game that everyone fills in with a tap and the bot keeps current.

## Where it touches (product level)
- The group chat: the commands, the pool messages, and the pings that reach everyone's phone.
- Group settings: someone makes the bot a group admin that can only pin messages, so it hears every command and sees members join and leave. Telegram gives bots no member list, so the bot builds its own from who writes, joins and leaves.
- The old tag bot leaves the chat once /all works here, since both would answer it.
- What the bot remembers: who is in the chat and a record of their commands and pool answers, never what anyone writes.
- Running it: it must cost nothing, and its code lives on GitHub.

## Out of scope
- A ready check when a pool fills.
- Named groups for tagging, such as only the CS2 players.
- Votes on which game to play or at what time.
- Counting anything from before the bot joined the chat.
- Serving other groups: it is built for this one chat.
