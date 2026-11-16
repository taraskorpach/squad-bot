import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { recordEvent } from '../../src/stats/event-store';
import { freshRoom } from '../helpers/rooms';

describe('recordEvent', () => {
	it('appends every event, repeats included, for the stats queries to count', async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			const { sql } = state.storage;

			recordEvent(sql, { kind: 'all', userId: 1001, at: 1_000 });
			recordEvent(sql, { kind: 'all', userId: 1001, at: 1_000 });
			recordEvent(sql, { kind: 'domikpisik', userId: 1002, at: 2_000 });

			expect(
				sql.exec('SELECT kind, user_id, pool_id, at FROM events ORDER BY id').toArray(),
			).toEqual([
				{ kind: 'all', user_id: 1001, pool_id: null, at: 1_000 },
				{ kind: 'all', user_id: 1001, pool_id: null, at: 1_000 },
				{ kind: 'domikpisik', user_id: 1002, pool_id: null, at: 2_000 },
			]);
		});
	});
});
