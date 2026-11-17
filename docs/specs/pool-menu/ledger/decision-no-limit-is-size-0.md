---
kind: decision
applies-to: [general]
created: 2026-11-17T15:03:57+02:00
---

# A pool without a seat limit is size 0 in the table, and no size everywhere else

`pools.size` stays `INTEGER NOT NULL`, and `0` means no limit: a nullable column would need a table
rebuild in a live object's migration. `pool-store.ts` is the only code that knows the 0: it writes
`size ?? 0` and reads `0` back as `undefined`, so `Pool.size`, `Seats.size` and `PoolRequest.size`
are optional, and every rule takes "no size" as "everyone who says Граю plays".

So never compare a stored size with 0 outside the store, and give any new rule that reads a size
an answer for `undefined` (`lineupOf`, `answer`, `draw`, the card, the start ping and `/pools` all
have one).
