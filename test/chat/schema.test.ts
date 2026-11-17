import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { ChatRoom } from '../../src/chat/chat-room';
import { MIGRATIONS, type Migration, migrate } from '../../src/chat/schema';
import { freshRoom, tableNames } from '../helpers/rooms';

const NOW = Date.UTC(2026, 10, 16, 20);

function appliedIds(storage: DurableObjectStorage): number[] {
	return storage.sql
		.exec<{ id: number }>('SELECT id FROM _sql_schema_migrations ORDER BY id')
		.toArray()
		.map((row) => row.id);
}

describe('migrations', () => {
	it('are numbered 1, 2, 3… in the order they apply', () => {
		expect(MIGRATIONS.map((migration) => migration.id)).toEqual(
			MIGRATIONS.map((_, index) => index + 1),
		);
	});

	it('are all applied when the object is first built', async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			expect(appliedIds(state.storage)).toEqual(MIGRATIONS.map((migration) => migration.id));
			expect(tableNames(state.storage)).toEqual([
				'_sql_schema_migrations',
				'answers',
				'events',
				'failed_updates',
				'members',
				'pool_messages',
				'pools',
				'processed_updates',
				'sqlite_sequence',
			]);
		});
	});

	it('are applied once: a second run changes nothing', async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			migrate(state.storage, MIGRATIONS, NOW);

			expect(appliedIds(state.storage)).toEqual(MIGRATIONS.map((migration) => migration.id));
		});
	});

	it('apply only the new ones, in order', async () => {
		const added: Migration[] = [
			{ id: 101, description: 'a table', sql: 'CREATE TABLE extras (id INTEGER PRIMARY KEY)' },
			{ id: 102, description: 'its column', sql: 'ALTER TABLE extras ADD COLUMN note TEXT' },
		];

		await runInDurableObject(freshRoom(), (_room, state) => {
			migrate(state.storage, [...MIGRATIONS, ...added], NOW);

			expect(appliedIds(state.storage).slice(-2)).toEqual([101, 102]);
			expect(tableNames(state.storage)).toContain('extras');
		});
	});

	it('leave nothing behind when one fails halfway', async () => {
		const broken: Migration = {
			id: 101,
			description: 'half of it works',
			sql: 'CREATE TABLE half (id INTEGER); CREATE TABLE (',
		};

		await runInDurableObject(freshRoom(), (_room, state) => {
			expect(() => migrate(state.storage, [...MIGRATIONS, broken], NOW)).toThrow();

			expect(tableNames(state.storage)).not.toContain('half');
			expect(appliedIds(state.storage)).not.toContain(101);
		});
	});
});

describe('the event record', () => {
	it('takes every event: no unique index drops a repeat, and no CHECK refuses a new kind', async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			const record = (kind: string) =>
				state.storage.sql.exec(
					'INSERT INTO events (kind, user_id, at) VALUES (?, 1001, ?)',
					kind,
					NOW,
				);

			record('all');
			record('all');
			record('a kind no phase has planned');

			expect(
				state.storage.sql.exec('SELECT kind, pool_id FROM events ORDER BY id').toArray(),
			).toEqual([
				{ kind: 'all', pool_id: null },
				{ kind: 'all', pool_id: null },
				{ kind: 'a kind no phase has planned', pool_id: null },
			]);
		});
	});
});

describe('the pools', () => {
	it('start with no timer pending: not pinged, no failed attempt, no retry', async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			state.storage.sql.exec(
				'INSERT INTO pools (game, size, author_id, opened_at, closes_at) VALUES (?, 5, 1001, ?, ?)',
				'CS2',
				NOW,
				NOW,
			);

			expect(
				state.storage.sql
					.exec('SELECT start_pinged, timer_attempts, timer_retry_at FROM pools')
					.toArray(),
			).toEqual([{ start_pinged: 0, timer_attempts: 0, timer_retry_at: null }]);
		});
	});
});

describe('the object at construction', () => {
	it.each([
		['BOT_INFO', 'not json', 'BOT_INFO must be the JSON of getMe'],
		['ALLOWED_CHAT_ID', 'the chat', 'ALLOWED_CHAT_ID must be an integer chat id'],
		['MENTION_CHUNK', '0', 'MENTION_CHUNK must be an integer of at least 1'],
	])('refuses a bad %s by name', async (name, value, message) => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			expect(() => new ChatRoom(state, { ...env, [name]: value })).toThrow(message);
		});
	});
});

describe('migration 5', () => {
	it('carries every answer over, and lets a maybe in after', async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			const { sql } = state.storage;
			// The object as migration 4 left it: answers whose CHECK allows two kinds.
			sql.exec('DELETE FROM _sql_schema_migrations WHERE id = 5');
			sql.exec('DROP TABLE answers');
			sql.exec(`CREATE TABLE answers (
				pool_id     INTEGER NOT NULL REFERENCES pools (id),
				user_id     INTEGER NOT NULL,
				choice      TEXT NOT NULL CHECK (choice IN ('play', 'pass')),
				rank        INTEGER NOT NULL,
				answered_at INTEGER NOT NULL,
				PRIMARY KEY (pool_id, user_id)
			)`);
			sql.exec(
				"INSERT INTO pools (game, size, author_id, opened_at, closes_at) VALUES ('CS2', 5, 1, 1000, 2000)",
			);
			sql.exec("INSERT INTO answers VALUES (1, 1, 'play', 1, 1000)");
			sql.exec("INSERT INTO answers VALUES (1, 2, 'pass', 0, 1100)");

			migrate(state.storage, MIGRATIONS, NOW);

			expect(
				sql
					.exec('SELECT pool_id, user_id, choice, rank, answered_at FROM answers ORDER BY user_id')
					.toArray(),
			).toEqual([
				{ pool_id: 1, user_id: 1, choice: 'play', rank: 1, answered_at: 1000 },
				{ pool_id: 1, user_id: 2, choice: 'pass', rank: 0, answered_at: 1100 },
			]);
			sql.exec("INSERT INTO answers VALUES (1, 3, 'maybe', 0, 1200)");
			expect(sql.exec("SELECT user_id FROM answers WHERE choice = 'maybe'").toArray()).toEqual([
				{ user_id: 3 },
			]);
		});
	});
});

describe('migration 6', () => {
	it('keeps every event, and lets one say what it is about and which message made it', async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			const { sql } = state.storage;
			// The object as migration 5 left it: events with no ref and no message id.
			sql.exec('DELETE FROM _sql_schema_migrations WHERE id = 6');
			sql.exec('DROP TABLE events');
			sql.exec(`CREATE TABLE events (
				id      INTEGER PRIMARY KEY AUTOINCREMENT,
				kind    TEXT NOT NULL,
				user_id INTEGER NOT NULL,
				pool_id INTEGER,
				at      INTEGER NOT NULL
			)`);
			sql.exec('CREATE INDEX idx_events_kind_at ON events (kind, at)');
			sql.exec("INSERT INTO events (kind, user_id, pool_id, at) VALUES ('all', 1, NULL, 1000)");
			sql.exec("INSERT INTO events (kind, user_id, pool_id, at) VALUES ('join', 2, 7, 1100)");

			migrate(state.storage, MIGRATIONS, NOW);

			expect(
				sql
					.exec('SELECT kind, user_id, pool_id, ref, message_id, at FROM events ORDER BY id')
					.toArray(),
			).toEqual([
				{ kind: 'all', user_id: 1, pool_id: null, ref: null, message_id: null, at: 1000 },
				{ kind: 'join', user_id: 2, pool_id: 7, ref: null, message_id: null, at: 1100 },
			]);
			sql.exec(
				"INSERT INTO events (kind, user_id, ref, message_id, at) VALUES ('share', 3, 'youtube:dQw4w9WgXcQ', 42, 1200)",
			);
			expect(
				sql.exec("SELECT user_id, ref, message_id FROM events WHERE kind = 'share'").toArray(),
			).toEqual([{ user_id: 3, ref: 'youtube:dQw4w9WgXcQ', message_id: 42 }]);
		});
	});
});
