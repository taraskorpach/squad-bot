import { describe, expect, it } from 'vitest';
import type { Pool } from '../../src/pools/pool-store';
import { dueActions, nextDue } from '../../src/pools/pool-timers';

// Kyiv is two hours ahead of UTC in winter.
const kyiv = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 2, minute);
const MIDNIGHT = kyiv(17, 0);

const pool = (fields: Partial<Pool>): Pool => ({
	id: 1,
	game: 'CS2',
	size: 5,
	authorId: 1,
	openedAt: kyiv(16, 18),
	closesAt: kyiv(16, 21),
	messageId: 42,
	status: 'open',
	squadAnnounced: false,
	drawn: false,
	startPinged: false,
	timerAttempts: 0,
	...fields,
});

describe('nextDue', () => {
	it('is nothing while no pool is open', () => {
		expect(nextDue([], kyiv(16, 19))).toBeUndefined();
		expect(nextDue([pool({ status: 'closed' })], kyiv(16, 19))).toBeUndefined();
	});

	it("is a pool's close, for a pool now whose label never changes", () => {
		expect(nextDue([pool({})], kyiv(16, 19))).toBe(kyiv(16, 21));
	});

	it('is the start while its players are still to be tagged', () => {
		const timed = pool({ startsAt: kyiv(16, 21), closesAt: MIDNIGHT });

		expect(nextDue([timed], kyiv(16, 19))).toBe(kyiv(16, 21));
		expect(nextDue([{ ...timed, startPinged: true }], kyiv(16, 22))).toBe(MIDNIGHT);
	});

	it('is the midnight that turns завтра into сьогодні, before a start after it', () => {
		const tomorrow = pool({ startsAt: kyiv(17, 1), closesAt: kyiv(17, 4) });

		expect(nextDue([tomorrow], kyiv(16, 23))).toBe(MIDNIGHT);
	});

	it('is at once for a card that never got out, until it is given up', () => {
		expect(nextDue([pool({ messageId: undefined })], kyiv(16, 19))).toBe(kyiv(16, 18));
		expect(nextDue([pool({ messageId: undefined, timerAttempts: 4 })], kyiv(16, 19))).toBe(
			kyiv(16, 21),
		);
	});

	it('waits for a failed action’s retry', () => {
		const failed = pool({ messageId: undefined, timerAttempts: 1, timerRetryAt: kyiv(16, 19, 1) });

		expect(nextDue([failed], kyiv(16, 19))).toBe(kyiv(16, 19, 1));
	});

	it('is the earliest over every open pool', () => {
		const later = pool({ id: 2, closesAt: kyiv(16, 23) });

		expect(nextDue([later, pool({})], kyiv(16, 19))).toBe(kyiv(16, 21));
	});
});

describe('dueActions', () => {
	it('lists what is due now, in the order the alarm runs it', () => {
		const late = pool({ messageId: undefined, startsAt: kyiv(16, 18) });

		expect(dueActions(late, kyiv(16, 21))).toEqual(['post-card', 'start-ping', 'close']);
	});

	it('lists nothing before its time, nothing during a retry, and nothing for a closed pool', () => {
		expect(dueActions(pool({ startsAt: kyiv(16, 20) }), kyiv(16, 19))).toEqual([]);
		expect(dueActions(pool({ timerRetryAt: kyiv(16, 22) }), kyiv(16, 21))).toEqual([]);
		expect(dueActions(pool({ status: 'closed' }), kyiv(16, 21))).toEqual([]);
	});
});
