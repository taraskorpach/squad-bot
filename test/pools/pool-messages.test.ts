import { describe, expect, it } from 'vitest';
import {
	argsErrorText,
	movedUpText,
	openingMessages,
	openingWhen,
	squadCompleteText,
	toastOf,
} from '../../src/pools/pool-messages';
import type { Placement } from '../../src/pools/pool-rules';

describe('toastOf', () => {
	it.each<[Placement, string]>([
		[{ outcome: 'squad' }, 'Ти в грі ✅'],
		[{ outcome: 'bench', benchPlace: 2 }, 'Місць немає — ти на лаві, №2 🪑'],
		[{ outcome: 'already-in' }, 'Ти вже в пулі'],
		[{ outcome: 'passed' }, 'Пас ❌'],
		[{ outcome: 'already-passed' }, 'Ти вже пасуєш'],
	])('answers %o with its toast', (placement, toast) => {
		expect(toastOf(placement)).toBe(toast);
	});
});

describe('squadCompleteText', () => {
	it('names the squad, and its start while that is still ahead', () => {
		expect(squadCompleteText('CS2', ['m1', 'm2'], kyiv(16, 21), kyiv(16, 19))).toBe(
			'🎮 Склад на CS2 зібрано: m1, m2. Старт о 21:00.',
		);
	});

	it('leaves the start out for a pool now or a start already past', () => {
		expect(squadCompleteText('R&D', ['m1'], undefined, kyiv(16, 19))).toBe(
			'🎮 Склад на R&amp;D зібрано: m1.',
		);
		expect(squadCompleteText('CS2', ['m1'], kyiv(16, 18), kyiv(16, 19))).toBe(
			'🎮 Склад на CS2 зібрано: m1.',
		);
	});
});

describe('movedUpText', () => {
	it('tells the one who moved up that they play now', () => {
		expect(movedUpText('m1', 'CS2')).toBe('m1, звільнилось місце — ти граєш у CS2.');
	});
});

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
