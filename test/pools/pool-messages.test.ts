import { describe, expect, it } from 'vitest';
import { argsErrorText, openingMessages, openingWhen } from '../../src/pools/pool-messages';

// Kyiv is two hours ahead of UTC in winter.
const kyiv = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 2, minute);

describe('argsErrorText', () => {
	it.each([
		[{ kind: 'size' } as const, 'Розмір пулу — від 2 до 10. Час пиши як 21:00.'],
		[
			{ kind: 'time', token: '25:00' } as const,
			'Не зрозумів «25:00». Час пиши як 21:00 або 21.00.',
		],
		[
			{ kind: 'token', token: '<b>' } as const,
			'Не зрозумів «&lt;b&gt;». Формат: /pool [гра] [розмір] [час], напр. /pool cs2 5 21:00.',
		],
	])('answers %o with its reply, the token escaped', (error, reply) => {
		expect(argsErrorText(error)).toBe(reply);
	});
});

describe('openingWhen', () => {
	it.each([
		['now', undefined, 'зараз'],
		['later the same day', kyiv(16, 21), 'на 21:00'],
		['tomorrow', kyiv(17, 1), 'на завтра, 01:00'],
	])('says when a pool starts %s, against when it opened', (_case, startsAt, when) => {
		expect(openingWhen(startsAt, kyiv(16, 18))).toBe(when);
	});
});

describe('openingMessages', () => {
	const mentions = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

	it('says who gathers what and when, then tags in chunks', () => {
		expect(openingMessages('Тарас', 'CS2', 'зараз', mentions, 5)).toEqual([
			'📢 Тарас збирає CS2 зараз — хто грає? m1, m2, m3, m4, m5',
			'📢 m6',
		]);
	});

	it('still announces the pool when nobody else is known to tag', () => {
		expect(openingMessages('Тарас', 'CS2', 'на 21:00', [], 5)).toEqual([
			'📢 Тарас збирає CS2 на 21:00 — хто грає?',
		]);
	});

	it("escapes the author's name and the game word", () => {
		expect(openingMessages('<Тарас>', 'R&D', 'зараз', [], 5)).toEqual([
			'📢 &lt;Тарас&gt; збирає R&amp;D зараз — хто грає?',
		]);
	});
});
