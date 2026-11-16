/**
 * What the stats count. The kinds live in this union rather than in a CHECK on the table:
 * SQLite can't change a CHECK in place, and the table is history nothing can regenerate.
 */
export type EventKind = 'all' | 'domikpisik';

export interface StatEvent {
	kind: EventKind;
	userId: number;
	/** When the person acted, epoch milliseconds. */
	at: number;
}

/** The one writer of the append-only record: every event stays, repeats included. */
export function recordEvent(sql: SqlStorage, event: StatEvent): void {
	sql.exec(
		'INSERT INTO events (kind, user_id, at) VALUES (?, ?, ?)',
		event.kind,
		event.userId,
		event.at,
	);
}
