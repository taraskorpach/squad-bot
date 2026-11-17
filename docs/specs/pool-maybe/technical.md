# Pool Maybe — Technical

## Storage

Migration 5 rebuilds `answers` without the CHECK on `choice`, in the migration's own transaction:

```sql
CREATE TABLE answers_v5 (
  pool_id     INTEGER NOT NULL REFERENCES pools (id),
  user_id     INTEGER NOT NULL,
  choice      TEXT NOT NULL,
  rank        INTEGER NOT NULL,
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (pool_id, user_id)
);
INSERT INTO answers_v5 (pool_id, user_id, choice, rank, answered_at)
  SELECT pool_id, user_id, choice, rank, answered_at FROM answers;
DROP TABLE answers;
ALTER TABLE answers_v5 RENAME TO answers;
```

Nothing references `answers`, so dropping it breaks no foreign key. The answer kinds are the
`Choice` type (`'play' | 'pass' | 'maybe'`), as the event kinds are `EventKind`.

## Rules (`src/pools/pool-rules.ts`)

- `Lineup` gains `maybe: number[]`, in the order they answered, like `passed`.
- `answer()`: a maybe keeps its rank, as a pass does; it leaves the squad, and the bench's first
  moves up. Outcomes `maybe` and `already-maybe`.
- `draw` and `drawRefusal` read plays only, so a maybe is "not playing".

## Around the rules

- `pool-actions.ts` records an event for Граю and Пас only: a maybe has no board.
- `pool-keyboards.ts`: the action `maybe`, `p:{pool}:maybe`; the first row is ✅, 🤷, ❌.
- `pool-callbacks.ts`: `maybe` answers like ✅ and ❌.
- `pool-format.ts`: the `🤷 Може` line after the bench.
- `pool-messages.ts`: `toastOf` for the two new outcomes; `startPingText` takes the maybes'
  mentions for its second line.
- `pool-alarm.ts`: the start ping passes the maybes.
- `texts.ts`: `card.maybe`, `card.maybeButton`, `toasts.maybe`, `toasts.alreadyMaybe`,
  `messages.startMaybe`.

## Testing

- Migration 5 on an object holding the old table with answers: every answer is carried over, and
  a maybe can be written after.
- Rules, card, keyboard, toasts and the start ping as pure tests; a 🤷 tap through the object.
