import { describe, expect, it } from 'vitest';
import { statsText } from '../../src/stats/stats-format';
import type { Stats, Tally } from '../../src/stats/stats-queries';

const NAMES = new Map([
	[1, 'Тарас'],
	[2, 'Олег'],
	[3, 'Андрій'],
	[4, 'Ігор'],
	[5, 'Макс'],
	[6, 'Діма'],
	[7, 'Саша'],
]);

const NOBODY: Stats['tallies'] = {
	all: [],
	domikpisik: [],
	share: [],
	join: [],
	pool_open: [],
	pass: [],
};

function stats(
	tallies: Partial<Stats['tallies']>,
	joins = 0,
	names: ReadonlyMap<number, string> = NAMES,
): Stats {
	return { tallies: { ...NOBODY, ...tallies }, joins, names };
}

function tally(userId: number, count: number): Tally {
	return { userId, count };
}

/** One board of the reply, title first. */
function board(text: string, title: string): string[] {
	const found = text.split('\n\n').find((part) => part.startsWith(title));
	return found ? found.split('\n') : [`no board ${title}`];
}

describe('statsText', () => {
	it("words the design's mockup", () => {
		const shown = stats(
			{
				all: [tally(1, 31), tally(2, 17)],
				domikpisik: [tally(3, 120)],
				share: [tally(1, 9), tally(5, 54), tally(2, 23)],
				join: [tally(4, 40)],
				pool_open: [tally(1, 25)],
				pass: [tally(5, 30)],
			},
			143,
		);

		expect(statsText(shown)).toBe(
			[
				'📊 Статистика за весь час',
				'',
				'📢 /all',
				'1. Тарас — 31',
				'2. Олег — 17',
				'',
				'🏠 /domikpisik',
				'1. Андрій — 120',
				'',
				'🍿 Скидає контент',
				'1. Макс — 54',
				'2. Олег — 23',
				'3. Тарас — 9',
				'',
				'✅ Граю · разом 143',
				'1. Ігор — 40',
				'',
				'🎮 Відкриває пули',
				'1. Тарас — 25',
				'',
				'❌ Пас',
				'1. Макс — 30',
			].join('\n'),
		);
	});

	it('ranks by the count', () => {
		const text = statsText(stats({ all: [tally(2, 9), tally(1, 30), tally(4, 5)] }));

		expect(board(text, '📢 /all')).toEqual([
			'📢 /all',
			'1. Тарас — 30',
			'2. Олег — 9',
			'3. Ігор — 5',
		]);
	});

	it('gives equal counts one place, in Ukrainian name order, and skips the places they fill', () => {
		const text = statsText(stats({ pool_open: [tally(4, 10), tally(7, 2), tally(6, 10)] }));

		expect(board(text, '🎮 Відкриває пули')).toEqual([
			'🎮 Відкриває пули',
			'1. Діма — 10',
			'1. Ігор — 10',
			'3. Саша — 2',
		]);
	});

	it('says each empty board is empty so far, the Граю title keeping its total', () => {
		expect(statsText(stats({}))).toBe(
			[
				'📊 Статистика за весь час',
				'',
				'📢 /all',
				'— поки порожньо',
				'',
				'🏠 /domikpisik',
				'— поки порожньо',
				'',
				'🍿 Скидає контент',
				'— поки порожньо',
				'',
				'✅ Граю · разом 0',
				'— поки порожньо',
				'',
				'🎮 Відкриває пули',
				'— поки порожньо',
				'',
				'❌ Пас',
				'— поки порожньо',
			].join('\n'),
		);
	});

	it('escapes the names people give themselves', () => {
		const names = new Map([[8, 'Ж<b>ук</b> & Co']]);

		const text = statsText(stats({ domikpisik: [tally(8, 1)] }, undefined, names));

		expect(board(text, '🏠 /domikpisik')).toEqual([
			'🏠 /domikpisik',
			'1. Ж&lt;b&gt;ук&lt;/b&gt; &amp; Co — 1',
		]);
	});

	it('shows the id of someone the bot never learned, rather than dropping their count', () => {
		const text = statsText(stats({ all: [tally(99, 1)] }));

		expect(board(text, '📢 /all')).toEqual(['📢 /all', '1. 99 — 1']);
	});
});
