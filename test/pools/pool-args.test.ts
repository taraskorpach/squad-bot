import { describe, expect, it } from 'vitest';
import { parsePoolArgs, startOf } from '../../src/pools/pool-args';

describe('parsePoolArgs', () => {
	it.each([
		['', { game: 'CS2', size: 5 }],
		['dota', { game: 'dota', size: 5 }],
		['cs2 3', { game: 'cs2', size: 3 }],
		['cs2 21:00', { game: 'cs2', size: 5, time: { hour: 21, minute: 0 } }],
		['cs2 21.30 4', { game: 'cs2', size: 4, time: { hour: 21, minute: 30 } }],
		['4 9:05', { game: 'CS2', size: 4, time: { hour: 9, minute: 5 } }],
		['  valorant   10  ', { game: 'valorant', size: 10 }],
		['R&D 2', { game: 'R&D', size: 2 }],
	])('reads "%s"', (text, args) => {
		expect(parsePoolArgs(text)).toEqual({ ok: true, args });
	});

	it.each([
		['cs2 21', { kind: 'size' }],
		['cs2 1', { kind: 'size' }],
		['cs2 0', { kind: 'size' }],
		['cs2 25:00', { kind: 'time', token: '25:00' }],
		['cs2 21:60', { kind: 'time', token: '21:60' }],
		['cs2 5 6', { kind: 'token', token: '6' }],
		['cs2 21:00 22:00', { kind: 'token', token: '22:00' }],
		['cs2 dota', { kind: 'token', token: 'dota' }],
		['5 cs2', { kind: 'token', token: 'cs2' }],
		['a'.repeat(33), { kind: 'token', token: 'a'.repeat(33) }],
	])('refuses "%s"', (text, error) => {
		expect(parsePoolArgs(text)).toEqual({ ok: false, error });
	});
});

describe('startOf', () => {
	// Kyiv is two hours ahead of UTC in winter.
	const kyiv = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 2, minute);

	it.each([
		['later today', { hour: 21, minute: 0 }, kyiv(16, 20), kyiv(16, 21)],
		[
			'tomorrow once today’s has passed by an hour or more',
			{ hour: 21, minute: 0 },
			kyiv(16, 22, 30),
			kyiv(17, 21),
		],
		['tomorrow, for an early time typed late', { hour: 1, minute: 0 }, kyiv(16, 23), kyiv(17, 1)],
		['tomorrow, exactly an hour after', { hour: 20, minute: 0 }, kyiv(16, 21), kyiv(17, 20)],
	])('starts %s', (_case, time, sentAt, start) => {
		expect(startOf(time, sentAt)).toBe(start);
	});

	it.each([
		['minutes after the time', { hour: 21, minute: 0 }, kyiv(16, 21, 5)],
		['at the time itself', { hour: 21, minute: 0 }, kyiv(16, 21)],
		['just after midnight, for a time late yesterday', { hour: 23, minute: 45 }, kyiv(17, 0, 10)],
	])('is now %s: under an hour past means now', (_case, time, sentAt) => {
		expect(startOf(time, sentAt)).toBeUndefined();
	});

	it('starts 03:30 at 04:30 on the spring-forward night', () => {
		const sentAt = Date.UTC(2026, 2, 29, 0); // 02:00 in Kyiv
		expect(startOf({ hour: 3, minute: 30 }, sentAt)).toBe(Date.UTC(2026, 2, 29, 1, 30));
	});

	it('starts 03:30 at the first of the two on the autumn night', () => {
		const sentAt = Date.UTC(2026, 9, 24, 23); // 02:00 in Kyiv, summer time
		expect(startOf({ hour: 3, minute: 30 }, sentAt)).toBe(Date.UTC(2026, 9, 25, 0, 30));
	});
});
