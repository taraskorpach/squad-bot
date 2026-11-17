/**
 * What the stats count. The kinds live in this union rather than in a CHECK on the table:
 * SQLite can't change a CHECK in place, and the table is history nothing can regenerate.
 */
export type EventKind = 'all' | 'domikpisik' | 'pool_open' | 'join' | 'pass';

export interface StatEvent {
	kind: EventKind;
	userId: number;
	/** The pool a `pool_open`, `join` or `pass` belongs to: the stats count each pool once. */
	poolId?: number;
	/** When the person acted, epoch milliseconds. */
	at: number;
}

/**
 * Whether the same person has an event of the same kind less than `windowMs` before or after
 * `event.at`: either way, so one delivered late is judged by when it was sent.
 */
export function hasEventNear(
	sql: SqlStorage,
	event: Pick<StatEvent, 'kind' | 'userId' | 'at'>,
	windowMs: number,
): boolean {
	return (
		sql
			.exec(
				'SELECT 1 FROM events WHERE kind = ? AND user_id = ? AND at > ? AND at < ? LIMIT 1',
				event.kind,
				event.userId,
				event.at - windowMs,
				event.at + windowMs,
			)
			.toArray().length > 0
	);
}

/** The one writer of the append-only record: every event stays, repeats included. */
export function recordEvent(sql: SqlStorage, event: StatEvent): void {
	sql.exec(
		'INSERT INTO events (kind, user_id, pool_id, at) VALUES (?, ?, ?, ?)',
		event.kind,
		event.userId,
		event.poolId ?? null,
		event.at,
	);
}
