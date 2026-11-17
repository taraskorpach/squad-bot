import { runInDurableObject } from 'cloudflare:test';
import type { User } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import { recordEvent, type StatEvent } from '../../src/stats/event-store';
import { tallies, totalJoins } from '../../src/stats/stats-queries';
import { freshRoom } from '../helpers/rooms';
import { users } from '../helpers/updates';

const AT = 15_000;

const { taras, oleg, andriy, ihor, maks } = users;

function call(kind: 'all' | 'domikpisik', person: User, at = AT): StatEvent {
	return { kind, userId: person.id, at };
}

function inPool(
	kind: 'pool_open' | 'join' | 'pass',
	person: User,
	poolId: number,
	at = AT,
): StatEvent {
	return { kind, userId: person.id, poolId, at };
}

/** Reads a fresh record that holds these events. */
function over<T>(events: readonly StatEvent[], read: (sql: SqlStorage) => T): Promise<T> {
	return runInDurableObject(freshRoom(), (_room, state) => {
		for (const event of events) recordEvent(state.storage.sql, event);
		return read(state.storage.sql);
	});
}

describe('tallies', () => {
	it('counts every /all and /domikpisik', async () => {
		const events = [
			call('all', taras),
			call('all', taras),
			call('all', taras),
			call('all', oleg),
			call('domikpisik', andriy),
			call('domikpisik', andriy),
		];

		const [all, domikpisik] = await over(events, (sql) => [
			tallies(sql, 'all'),
			tallies(sql, 'domikpisik'),
		]);

		expect(all).toEqual([
			{ userId: taras.id, count: 3 },
			{ userId: oleg.id, count: 1 },
		]);
		expect(domikpisik).toEqual([{ userId: andriy.id, count: 2 }]);
	});

	it('counts a toggle ✅ → ❌ → ✅ as one Граю and one Пас in that pool', async () => {
		const events = [
			inPool('join', ihor, 1, AT),
			inPool('pass', ihor, 1, AT + 1),
			inPool('join', ihor, 1, AT + 2),
		];

		const [joins, passes] = await over(events, (sql) => [
			tallies(sql, 'join'),
			tallies(sql, 'pass'),
		]);

		expect(joins).toEqual([{ userId: ihor.id, count: 1 }]);
		expect(passes).toEqual([{ userId: ihor.id, count: 1 }]);
	});

	it('counts each pool a person joined once, however often they joined it', async () => {
		const events = [
			inPool('join', maks, 1, AT),
			inPool('pass', maks, 1, AT + 1),
			inPool('join', maks, 1, AT + 2),
			inPool('join', maks, 2, AT + 3),
		];

		expect(await over(events, (sql) => tallies(sql, 'join'))).toEqual([
			{ userId: maks.id, count: 2 },
		]);
	});

	it('counts each pool its author opened', async () => {
		const events = [inPool('pool_open', taras, 1), inPool('pool_open', taras, 2)];

		expect(await over(events, (sql) => tallies(sql, 'pool_open'))).toEqual([
			{ userId: taras.id, count: 2 },
		]);
	});

	it('counts each post a person shared once, however often they shared it', async () => {
		const shared = (person: User, ref: string): StatEvent => ({
			kind: 'share',
			userId: person.id,
			ref,
			at: AT,
		});
		const events = [
			shared(maks, 'youtube:dQw4w9WgXcQ'),
			shared(maks, 'youtube:dQw4w9WgXcQ'),
			shared(maks, 'tiktok:7312345678901234567'),
			shared(oleg, 'youtube:dQw4w9WgXcQ'),
		];

		expect(await over(events, (sql) => tallies(sql, 'share'))).toEqual([
			{ userId: oleg.id, count: 1 },
			{ userId: maks.id, count: 2 },
		]);
	});

	it('is empty for a kind nobody has done', async () => {
		expect(await over([call('all', taras)], (sql) => tallies(sql, 'pass'))).toEqual([]);
	});
});

describe('totalJoins', () => {
	it('counts pools and people, not taps', async () => {
		const events = [
			inPool('join', ihor, 1, AT),
			inPool('pass', ihor, 1, AT + 1),
			inPool('join', ihor, 1, AT + 2),
			inPool('join', ihor, 2, AT),
			inPool('join', taras, 1, AT),
			inPool('pass', taras, 1, AT + 1),
			inPool('join', taras, 1, AT + 2),
			inPool('pass', oleg, 1, AT),
		];

		expect(await over(events, (sql) => totalJoins(sql))).toBe(3);
	});

	it('is nothing before anyone has said Граю', async () => {
		expect(await over([], (sql) => totalJoins(sql))).toBe(0);
	});
});
