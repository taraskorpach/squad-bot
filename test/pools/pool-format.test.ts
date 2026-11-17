import { describe, expect, it } from 'vitest';
import { renderCard } from '../../src/pools/pool-format';
import { poolKeyboard } from '../../src/pools/pool-keyboards';
import type { Lineup } from '../../src/pools/pool-rules';
import type { Pool } from '../../src/pools/pool-store';

// Kyiv is two hours ahead of UTC in winter.
const kyiv = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 2, minute);

const NAMES = new Map([
	[1, 'Тарас'],
	[2, 'Олег'],
	[3, 'Андрій'],
	[4, 'Ігор'],
	[5, 'Макс'],
	[6, 'Діма'],
	[7, 'Саша'],
]);

const pool: Pool = {
	id: 7,
	game: 'CS2',
	size: 5,
	authorId: 1,
	openedAt: kyiv(16, 18),
	startsAt: kyiv(16, 21),
	closesAt: kyiv(17, 0),
	status: 'open',
	squadAnnounced: false,
	drawn: false,
	startPinged: false,
	timerAttempts: 0,
};

const lineup = (fields: Partial<Lineup>): Lineup => ({
	players: [],
	bench: [],
	passed: [],
	unanswered: [],
	...fields,
});

describe('renderCard', () => {
	it('shows an open pool: who plays, who passed and who has yet to answer, by name', () => {
		const shown = lineup({ players: [1, 2], passed: [3], unanswered: [4, 5, 6, 7] });
		const card = renderCard(pool, shown, NAMES, kyiv(16, 19));

		expect(card).toEqual({
			text: [
				'🎮 CS2 · 5 місць · сьогодні о 21:00',
				'Автор: Тарас',
				'',
				'✅ Грають (2/5): Тарас, Олег',
				'❌ Пас: Андрій',
				'⏳ Ще не відповіли: Діма, Ігор, Макс, Саша',
			].join('\n'),
			keyboard: poolKeyboard(pool, shown),
		});
	});

	it('notes under the author that the draw picked the squad', () => {
		const drawn: Pool = { ...pool, drawn: true };
		const [, author, note] = renderCard(
			drawn,
			lineup({ players: [1] }),
			NAMES,
			kyiv(16, 19),
		).text.split('\n');

		expect([author, note]).toEqual(['Автор: Тарас', '🎲 Склад визначено жеребом']);
	});

	it('lists the bench once the squad is full, and only the lines that have someone', () => {
		const { text } = renderCard(
			pool,
			lineup({ players: [1, 2, 4, 5, 6], bench: [7] }),
			NAMES,
			kyiv(16, 19),
		);

		expect(text.split('\n').slice(3)).toEqual([
			'✅ Грають (5/5): Тарас, Олег, Ігор, Макс, Діма',
			'🪑 Лава: Саша',
		]);
	});

	it('shows a dash while nobody plays', () => {
		const { text } = renderCard(pool, lineup({}), NAMES, kyiv(16, 19));

		expect(text.split('\n')[3]).toBe('✅ Грають (0/5): —');
	});

	it.each([
		['now', { ...pool, startsAt: undefined }, kyiv(16, 19), 'зараз'],
		['tomorrow', { ...pool, startsAt: kyiv(17, 1) }, kyiv(16, 23), 'завтра о 01:00'],
		['after midnight, for a start yesterday', pool, kyiv(17, 0, 30), '16.11 о 21:00'],
	])('labels a start %s by the render time', (_case, labelled, now, label) => {
		const [header] = renderCard(labelled, lineup({}), NAMES, now).text.split('\n');

		expect(header).toBe(`🎮 CS2 · 5 місць · ${label}`);
	});

	it('counts the seats in Ukrainian', () => {
		const [two] = renderCard({ ...pool, size: 2 }, lineup({}), NAMES, kyiv(16, 19)).text.split(
			'\n',
		);

		expect(two).toBe('🎮 CS2 · 2 місця · сьогодні о 21:00');
	});

	it('shows a closed pool with its date, who played, and no buttons', () => {
		const closed: Pool = { ...pool, status: 'closed', closedBy: 'auto' };

		expect(
			renderCard(
				closed,
				lineup({ players: [1, 2], bench: [7], passed: [3], unanswered: [4] }),
				NAMES,
				kyiv(17, 1),
			),
		).toEqual({
			text: [
				'🎮 CS2 · 5 місць · 16.11 о 21:00',
				'Автор: Тарас · 🔒 закрито',
				'',
				'✅ Грали: Тарас, Олег',
				'🪑 Лава: Саша',
				'❌ Пас: Андрій',
			].join('\n'),
		});
	});

	it('says the author closed it, and dates a pool for now by when it opened', () => {
		const closed: Pool = { ...pool, startsAt: undefined, status: 'closed', closedBy: 'author' };
		const [header, author] = renderCard(closed, lineup({}), NAMES, kyiv(16, 20)).text.split('\n');

		expect(header).toBe('🎮 CS2 · 5 місць · 16.11 о 18:00');
		expect(author).toBe('Автор: Тарас · 🔒 закрито автором');
	});

	it('escapes the game word and every name', () => {
		const names = new Map([[1, '<3 Тарас']]);
		const [header, author, , players] = renderCard(
			{ ...pool, game: 'R&D' },
			lineup({ players: [1] }),
			names,
			kyiv(16, 19),
		).text.split('\n');

		expect(header).toBe('🎮 R&amp;D · 5 місць · сьогодні о 21:00');
		expect(author).toBe('Автор: &lt;3 Тарас');
		expect(players).toBe('✅ Грають (1/5): &lt;3 Тарас');
	});
});
