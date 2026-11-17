// Durable Objects don't support PRAGMA user_version, so applied migrations are rows here.
const MIGRATIONS_TABLE = `
	CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
		id         INTEGER PRIMARY KEY,
		applied_at INTEGER NOT NULL
	)
`;

export interface Migration {
	id: number;
	description: string;
	sql: string;
}

/** Applied in this order, once each. Append only: a shipped migration never changes. */
export const MIGRATIONS: readonly Migration[] = [
	{
		id: 1,
		description: 'the update log: processed and failed updates',
		sql: `
			CREATE TABLE processed_updates (
				update_id    INTEGER PRIMARY KEY,
				processed_at INTEGER NOT NULL
			);
			CREATE TABLE failed_updates (
				update_id       INTEGER PRIMARY KEY,
				attempts        INTEGER NOT NULL,
				first_failed_at INTEGER NOT NULL
			);
		`,
	},
	{
		id: 2,
		description: 'the members, and the event record the stats count',
		// The record is history nothing can regenerate, so it takes every event: the kinds are the
		// EventKind union in src/stats/event-store.ts, and the counting rules live in the stats
		// queries, not in a unique index or a CHECK that SQLite can't change in place.
		sql: `
			CREATE TABLE members (
				user_id    INTEGER PRIMARY KEY,
				first_name TEXT NOT NULL,
				last_name  TEXT,
				username   TEXT,
				in_chat    INTEGER NOT NULL DEFAULT 1,
				seen_at    INTEGER NOT NULL
			);
			CREATE TABLE events (
				id      INTEGER PRIMARY KEY AUTOINCREMENT,
				kind    TEXT NOT NULL,
				user_id INTEGER NOT NULL,
				pool_id INTEGER,
				at      INTEGER NOT NULL
			);
			CREATE INDEX idx_events_kind_at ON events (kind, at);
		`,
	},
	{
		id: 3,
		description: 'pools, their answers, and every message the bot posts for one',
		// The size bound (2–10) is a rule the parser applies, not a CHECK: rules change, and SQLite
		// can't change a CHECK in place. A NULL message_id means the card hasn't been posted yet.
		sql: `
			CREATE TABLE pools (
				id              INTEGER PRIMARY KEY AUTOINCREMENT,
				game            TEXT NOT NULL,
				size            INTEGER NOT NULL,
				author_id       INTEGER NOT NULL,
				opened_at       INTEGER NOT NULL,
				starts_at       INTEGER,
				closes_at       INTEGER NOT NULL,
				message_id      INTEGER,
				status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
				closed_by       TEXT CHECK (closed_by IN ('auto', 'author')),
				squad_announced INTEGER NOT NULL DEFAULT 0,
				drawn           INTEGER NOT NULL DEFAULT 0,
				card_render     TEXT
			);
			CREATE INDEX idx_pools_status_opened ON pools (status, opened_at);
			CREATE TABLE answers (
				pool_id     INTEGER NOT NULL REFERENCES pools (id),
				user_id     INTEGER NOT NULL,
				choice      TEXT NOT NULL CHECK (choice IN ('play', 'pass')),
				rank        INTEGER NOT NULL,
				answered_at INTEGER NOT NULL,
				PRIMARY KEY (pool_id, user_id)
			);
			CREATE TABLE pool_messages (
				message_id INTEGER PRIMARY KEY,
				pool_id    INTEGER NOT NULL REFERENCES pools (id)
			);
		`,
	},
	{
		id: 4,
		description: "the pools' timers: the start ping, and a failed action's retries",
		// The pools table is the alarm's schedule: no jobs table, so a closed pool can't fire.
		sql: `
			ALTER TABLE pools ADD COLUMN start_pinged   INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE pools ADD COLUMN timer_attempts INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE pools ADD COLUMN timer_retry_at INTEGER;
		`,
	},
	{
		id: 5,
		description: 'answers take any kind: the CHECK on choice goes, for 🤷 ±',
		// SQLite can't change a CHECK in place, so the table is rebuilt once. The answer kinds are
		// the Choice type in src/pools/pool-rules.ts, as the event kinds are EventKind. Nothing
		// references answers, so dropping it breaks no foreign key.
		sql: `
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
		`,
	},
	{
		id: 6,
		description: 'an event says what it is about and which message made it: a shared post',
		// NULL for every kind but a share, as pool_id is outside pools. The index serves the board's
		// count of each post once per person, and the баян's lookup of a post's first share.
		sql: `
			ALTER TABLE events ADD COLUMN ref        TEXT;
			ALTER TABLE events ADD COLUMN message_id INTEGER;
			CREATE INDEX idx_events_kind_ref ON events (kind, ref);
		`,
	},
];

/** Each migration commits with its own row, so one that fails halfway leaves nothing behind. */
export function migrate(
	storage: DurableObjectStorage,
	migrations: readonly Migration[],
	now: number,
): void {
	storage.sql.exec(MIGRATIONS_TABLE);
	const applied = new Set(
		storage.sql
			.exec<{ id: number }>('SELECT id FROM _sql_schema_migrations')
			.toArray()
			.map((row) => row.id),
	);
	for (const migration of migrations) {
		if (applied.has(migration.id)) continue;
		storage.transactionSync(() => {
			storage.sql.exec(migration.sql);
			storage.sql.exec(
				'INSERT INTO _sql_schema_migrations (id, applied_at) VALUES (?, ?)',
				migration.id,
				now,
			);
		});
	}
}
