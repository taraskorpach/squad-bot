import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { insertPool, type NewPool, poolById } from '../../src/pools/pool-store';
import { freshRoom } from '../helpers/rooms';

const MAFIA: NewPool = { game: 'Мафія', authorId: 1, openedAt: 1_000, closesAt: 2_000 };

describe('a pool without a seat limit', () => {
	it('is stored with a size of 0 and read back with no size', async () => {
		const [stored, read] = await runInDurableObject(freshRoom(), (_room, state) => {
			const { sql } = state.storage;
			const id = insertPool(sql, MAFIA);
			const row = sql.exec<{ size: number }>('SELECT size FROM pools WHERE id = ?', id).one();
			return [row.size, poolById(sql, id)] as const;
		});

		expect(stored).toBe(0);
		expect(read).toMatchObject({ game: 'Мафія', authorId: 1 });
		expect(read?.size).toBeUndefined();
	});

	it('keeps a size it was given', async () => {
		const read = await runInDurableObject(freshRoom(), (_room, state) => {
			const { sql } = state.storage;
			return poolById(sql, insertPool(sql, { ...MAFIA, size: 8 }));
		});

		expect(read?.size).toBe(8);
	});
});
