import { describe, expect, it } from 'vitest';
import {
	argsErrorText,
	cardLink,
	closedByAuthorText,
	drawRefusalToast,
	drawText,
	movedUpText,
	openingMessages,
	openingWhen,
	openPoolsText,
	pingMessages,
	squadCompleteText,
	startPingText,
	toastOf,
} from '../../src/pools/pool-messages';
import type { Placement } from '../../src/pools/pool-rules';
import type { Pool } from '../../src/pools/pool-store';

describe('startPingText', () => {
	it('calls the players at the start, with the fill while the squad is short', () => {
		expect(startPingText('CS2', ['m1', 'm2', 'm3', 'm4', 'm5'], 5, 5)).toBe(
			'⏰ CS2 — час! m1, m2, m3, m4, m5',
		);
		expect(startPingText('R&D', ['m1', 'm2'], 2, 5)).toBe('⏰ R&amp;D — час! m1, m2 (2/5)');
	});
});

describe('pingMessages', () => {
	it('asks for answers, with the first chunk of mentions, then the rest in chunks', () => {
		expect(pingMessages(['m1', 'm2', 'm3', 'm4', 'm5', 'm6'], 5)).toEqual([
			'🔔 Чекаємо на відповідь: m1, m2, m3, m4, m5',
			'🔔 m6',
		]);
	});
});

describe('drawText', () => {
	it('lists the whole squad and the whole bench', () => {
		expect(drawText(['m2', 'm3'], ['m1'])).toBe('🎲 Жереб кинуто. У склад: m2, m3. На лаву: m1.');
	});
});

describe('closedByAuthorText', () => {
	it('names the pool by its start time, when it had one', () => {
		expect(closedByAuthorText('CS2', kyiv(16, 21), ['m1', 'm2'])).toBe(
			'✖️ Пул на CS2 (21:00) закрито автором. m1, m2',
		);
		expect(closedByAuthorText('R&D', undefined, ['m1'])).toBe(
			'✖️ Пул на R&amp;D закрито автором. m1',
		);
	});
});

describe('drawRefusalToast', () => {
	it.each([
		['used', 'Жереб уже кинули'],
		['not-playing', 'Жереб кидають ті, хто в пулі'],
		['bench-empty', 'Лава порожня — жереб не потрібен'],
	] as const)('answers %s with its toast', (refusal, toast) => {
		expect(drawRefusalToast(refusal)).toBe(toast);
	});
});

describe('cardLink', () => {
	it("links to a supergroup's message by the chat id without its -100", () => {
		expect(cardLink(-1001234567890, 42)).toBe('https://t.me/c/1234567890/42');
	});
});

describe('openPoolsText', () => {
	const pool = (fields: Partial<Pool>): Pool => ({
		id: 1,
		game: 'CS2',
		size: 5,
		authorId: 1,
		openedAt: kyiv(16, 18),
		closesAt: kyiv(16, 21),
		status: 'open',
		squadAnnounced: false,
		drawn: false,
		startPinged: false,
		timerAttempts: 0,
		...fields,
	});

	it('lists each open pool with its start, its fill, its bench and a link to its card', () => {
		const listed = [
			{ pool: pool({ startsAt: kyiv(16, 21), messageId: 42 }), players: 3, bench: 0 },
			{ pool: pool({ id: 2, game: 'Dota2', messageId: 43 }), players: 5, bench: 1 },
			{ pool: pool({ id: 3, game: '<3' }), players: 1, bench: 0 },
		];

		expect(openPoolsText(listed, -1001234567890, kyiv(16, 19))).toBe(
			[
				'Відкриті пули:',
				'• CS2 · сьогодні о 21:00 · 3/5 → <a href="https://t.me/c/1234567890/42">картка</a>',
				'• Dota2 · зараз · 5/5, +1 на лаві → <a href="https://t.me/c/1234567890/43">картка</a>',
				'• &lt;3 · зараз · 1/5',
			].join('\n'),
		);
	});

	it('says none is open, and how to open one', () => {
		expect(openPoolsText([], -1001234567890, kyiv(16, 19))).toBe(
			'Зараз немає відкритих пулів. Відкрий: /pool',
		);
	});
});

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

describe('a pool without a seat limit', () => {
	it('calls the players at the start with no fill', () => {
		expect(startPingText('Мафія', ['m1', 'm2', 'm3'], 3, undefined)).toBe(
			'⏰ Мафія — час! m1, m2, m3',
		);
	});

	it('lists its fill on /pools as the number in the game', () => {
		const unlimited: Pool = {
			id: 4,
			game: 'Мафія',
			authorId: 1,
			openedAt: kyiv(16, 18),
			startsAt: kyiv(16, 21),
			closesAt: kyiv(17, 0),
			messageId: 44,
			status: 'open',
			squadAnnounced: false,
			drawn: false,
			startPinged: false,
			timerAttempts: 0,
		};

		expect(
			openPoolsText([{ pool: unlimited, players: 6, bench: 0 }], -1001234567890, kyiv(16, 19)),
		).toBe(
			[
				'Відкриті пули:',
				'• Мафія · сьогодні о 21:00 · 6 у грі → <a href="https://t.me/c/1234567890/44">картка</a>',
			].join('\n'),
		);
	});
});

describe('a maybe', () => {
	it('is told it was heard, and that it already was', () => {
		expect(toastOf({ outcome: 'maybe' })).toBe('Може 🤷');
		expect(toastOf({ outcome: 'already-maybe' })).toBe('Ти вже на «може»');
	});

	it('is asked at the start, in a line of its own after the players', () => {
		expect(startPingText('CS2', ['m1', 'm2', 'm3'], 3, 5, ['q1', 'q2'])).toBe(
			'⏰ CS2 — час! m1, m2, m3 (3/5)\n🤷 q1, q2, ви з нами?',
		);
	});
});
