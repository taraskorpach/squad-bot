/**
 * What the stats count. The kinds live in this union rather than in a CHECK on the table:
 * SQLite can't change a CHECK in place, and the table is history nothing can regenerate.
 */
export type EventKind = 'all' | 'domikpisik' | 'share' | 'pool_open' | 'join' | 'pass';

export interface StatEvent {
	kind: EventKind;
	userId: number;
	/** The pool a `pool_open`, `join` or `pass` belongs to: the stats count each pool once. */
	poolId?: number;
	/** The post a `share` sent, `{platform}:{id}`: the stats count each post once per person. */
	ref?: string;
	/** The message a `share` came in, so a later баян can link to the first one. */
	messageId?: number;
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

type EventAboutRow = { user_id: number; message_id: number | null; at: number };

/**
 * The first event of `kind` about `ref`, or none yet. First means first recorded: a баян names
 * whoever the bot counted first, even if a late message was sent before theirs.
 */
export function firstEventAbout(
	sql: SqlStorage,
	kind: EventKind,
	ref: string,
): StatEvent | undefined {
	const [row] = sql
		.exec<EventAboutRow>(
			'SELECT user_id, message_id, at FROM events WHERE kind = ? AND ref = ? ORDER BY id LIMIT 1',
			kind,
			ref,
		)
		.toArray();
	if (!row) return undefined;
	const event: StatEvent = { kind, ref, userId: row.user_id, at: row.at };
	return row.message_id === null ? event : { ...event, messageId: row.message_id };
}

/** The one writer of the append-only record: every event stays, repeats included. */
export function recordEvent(sql: SqlStorage, event: StatEvent): void {
	sql.exec(
		'INSERT INTO events (kind, user_id, pool_id, ref, message_id, at) VALUES (?, ?, ?, ?, ?, ?)',
		event.kind,
		event.userId,
		event.poolId ?? null,
		event.ref ?? null,
		event.messageId ?? null,
		event.at,
	);
}
