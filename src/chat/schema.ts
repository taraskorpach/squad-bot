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
