---
kind: decision
applies-to: [phase 5]
created: 2026-11-17T13:22:39+02:00
---

# PRs A, B and C go live together

Taras, 2026-11-17, before going live: "я би хотів все за раз все таки релізити. Можемо якось
протестити все а потім закидати в чат з друзями?" The plan had been PR A (`/all`) first, then PR B
(pools) after a day's CPU reading, with the menu already listing `/pool`, `/join`, `/pools` and
`/stats` that would not answer yet.

So the whole stack was tried in Pisikcs Test first (`wrangler dev --tunnel` from PR B's tree,
which holds A, B and C), and the release merges #2 into PR A's branch, then #1 into main: one
deploy carries everything. The webhook and the welcome come only after that deploy is green.

The CPU check now reads a day with pools in it, which is the load that matters.
