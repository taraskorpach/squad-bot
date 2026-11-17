import { runInDurableObject } from 'cloudflare:test';
import type { User } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import type { MonthWindow } from '../../src/kyiv-time';
import { recordEvent, type StatEvent } from '../../src/stats/event-store';
import { tallies, totalJoins } from '../../src/stats/stats-queries';
import { freshRoom } from '../helpers/rooms';
import { users } from '../helpers/updates';

const MONTH: MonthWindow = { start: 10_000, end: 20_000 };
const BEFORE = 5_000;
const DURING = 15_000;

const { taras, oleg, andriy, ihor, maks } = users;

function call(kind: 'all' | 'domikpisik', person: User, at: number): StatEvent {
	return { kind, userId: person.id, at };
}

function inPool(
	kind: 'pool_open' | 'join' | 'pass',
	person: User,
	poolId: number,
	at: number,
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
	it('counts every /all and /domikpisik, this month and in all', async () => {
		const events = [
			call('all', taras, BEFORE),
			call('all', taras, DURING),
			call('all', taras, DURING),
			call('all', oleg, DURING),
			call('domikpisik', andriy, BEFORE),
			call('domikpisik', andriy, BEFORE),
		];

		const [all, domikpisik] = await over(events, (sql) => [
			tallies(sql, 'all', MONTH),
			tallies(sql, 'domikpisik', MONTH),
		]);

		expect(all).toEqual([
			{ userId: taras.id, month: 2, allTime: 3 },
			{ userId: oleg.id, month: 1, allTime: 1 },
		]);
		expect(domikpisik).toEqual([{ userId: andriy.id, month: 0, allTime: 2 }]);
	});

	it('counts a toggle ✅ → ❌ → ✅ as one Граю and one Пас in that pool', async () => {
		const events = [
			inPool('join', ihor, 1, DURING),
			inPool('pass', ihor, 1, DURING + 1),
			inPool('join', ihor, 1, DURING + 2),
		];

		const [joins, passes] = await over(events, (sql) => [
			tallies(sql, 'join', MONTH),
			tallies(sql, 'pass', MONTH),
		]);

		expect(joins).toEqual([{ userId: ihor.id, month: 1, allTime: 1 }]);
		expect(passes).toEqual([{ userId: ihor.id, month: 1, allTime: 1 }]);
	});

	it("places a pool's Граю by the first one, so joining again later doesn't move it", async () => {
		const events = [
			inPool('join', maks, 1, BEFORE),
			inPool('pass', maks, 1, BEFORE + 1),
			inPool('join', maks, 1, DURING),
			inPool('join', maks, 2, DURING),
		];

		expect(await over(events, (sql) => tallies(sql, 'join', MONTH))).toEqual([
			{ userId: maks.id, month: 1, allTime: 2 },
		]);
	});

	it('counts each pool its author opened', async () => {
		const events = [inPool('pool_open', taras, 1, BEFORE), inPool('pool_open', taras, 2, DURING)];

		expect(await over(events, (sql) => tallies(sql, 'pool_open', MONTH))).toEqual([
			{ userId: taras.id, month: 1, allTime: 2 },
		]);
	});

	it("takes the month's first instant, and leaves its end to the next month", async () => {
		const events = [
			call('all', taras, MONTH.start - 1),
			call('all', taras, MONTH.start),
			call('all', taras, MONTH.end - 1),
			call('all', taras, MONTH.end),
		];

		expect(await over(events, (sql) => tallies(sql, 'all', MONTH))).toEqual([
			{ userId: taras.id, month: 2, allTime: 4 },
		]);
	});

	it('is empty for a kind nobody has done', async () => {
		expect(await over([call('all', taras, DURING)], (sql) => tallies(sql, 'pass', MONTH))).toEqual(
			[],
		);
	});
});

describe('totalJoins', () => {
	it('counts pools and people, not taps, each placed by its first Граю', async () => {
		const events = [
			inPool('join', ihor, 1, DURING),
			inPool('pass', ihor, 1, DURING + 1),
			inPool('join', ihor, 1, DURING + 2),
			inPool('join', ihor, 2, DURING),
			inPool('join', taras, 1, BEFORE),
			inPool('pass', taras, 1, BEFORE + 1),
			inPool('join', taras, 1, DURING),
			inPool('pass', oleg, 1, DURING),
		];

		expect(await over(events, (sql) => totalJoins(sql, MONTH))).toEqual({ month: 2, allTime: 3 });
	});

	it('is nothing before anyone has said Граю', async () => {
		expect(await over([], (sql) => totalJoins(sql, MONTH))).toEqual({ month: 0, allTime: 0 });
	});
});
