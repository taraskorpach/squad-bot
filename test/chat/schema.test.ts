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
