import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { firstEventAbout, recordEvent } from '../../src/stats/event-store';
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

	it("keeps a share's post and message, for the board's once-per-post count and the баян's link", async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			const { sql } = state.storage;

			recordEvent(sql, {
				kind: 'share',
				userId: 1001,
				ref: 'youtube:dQw4w9WgXcQ',
				messageId: 42,
				at: 1_000,
			});
			recordEvent(sql, { kind: 'all', userId: 1001, at: 2_000 });

			expect(
				sql.exec('SELECT kind, user_id, ref, message_id, at FROM events ORDER BY id').toArray(),
			).toEqual([
				{ kind: 'share', user_id: 1001, ref: 'youtube:dQw4w9WgXcQ', message_id: 42, at: 1_000 },
				{ kind: 'all', user_id: 1001, ref: null, message_id: null, at: 2_000 },
			]);
		});
	});

	it("keeps a pool's events with their pool, so the stats can count each pool once", async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			const { sql } = state.storage;

			recordEvent(sql, { kind: 'pool_open', userId: 1001, poolId: 7, at: 1_000 });
			recordEvent(sql, { kind: 'join', userId: 1001, poolId: 7, at: 1_000 });
			recordEvent(sql, { kind: 'pass', userId: 1002, poolId: 7, at: 2_000 });

			expect(
				sql.exec('SELECT kind, user_id, pool_id, at FROM events ORDER BY id').toArray(),
			).toEqual([
				{ kind: 'pool_open', user_id: 1001, pool_id: 7, at: 1_000 },
				{ kind: 'join', user_id: 1001, pool_id: 7, at: 1_000 },
				{ kind: 'pass', user_id: 1002, pool_id: 7, at: 2_000 },
			]);
		});
	});
});

describe('firstEventAbout', () => {
	it('finds the first event about a post in the order the bot recorded them, not sent them', async () => {
		await runInDurableObject(freshRoom(), (_room, state) => {
			const { sql } = state.storage;
			const post = 'youtube:dQw4w9WgXcQ';

			recordEvent(sql, { kind: 'share', userId: 1002, ref: post, messageId: 7, at: 5_000 });
			recordEvent(sql, { kind: 'share', userId: 1005, ref: post, messageId: 9, at: 3_000 });
			recordEvent(sql, {
				kind: 'share',
				userId: 1001,
				ref: 'tiktok:73123',
				messageId: 8,
				at: 1_000,
			});

			expect(firstEventAbout(sql, 'share', post)).toEqual({
				kind: 'share',
				ref: post,
				userId: 1002,
				messageId: 7,
				at: 5_000,
			});
			expect(firstEventAbout(sql, 'share', 'instagram:DezXNvMGxHM')).toBeUndefined();
		});
	});
});
