import { describe, expect, it } from 'vitest';
import { statsText } from '../../src/stats/stats-format';
import type { Counts, Stats, Tally } from '../../src/stats/stats-queries';

const NAMES = new Map([
	[1, 'Тарас'],
	[2, 'Олег'],
	[3, 'Андрій'],
	[4, 'Ігор'],
	[5, 'Макс'],
	[6, 'Діма'],
	[7, 'Саша'],
]);

const NOBODY: Stats['tallies'] = { all: [], domikpisik: [], join: [], pool_open: [], pass: [] };

function stats(
	tallies: Partial<Stats['tallies']>,
	joins: Counts = { month: 0, allTime: 0 },
	names: ReadonlyMap<number, string> = NAMES,
): Stats {
	return { tallies: { ...NOBODY, ...tallies }, joins, names };
}

function tally(userId: number, month: number, allTime: number): Tally {
	return { userId, month, allTime };
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
				all: [tally(1, 4, 31), tally(2, 2, 17)],
				domikpisik: [tally(3, 9, 120)],
				join: [tally(4, 5, 40)],
				pool_open: [tally(1, 3, 25)],
				pass: [tally(5, 2, 30)],
			},
			{ month: 12, allTime: 143 },
		);

		expect(statsText(shown, 'листопад')).toBe(
			[
				'📊 Статистика · листопад / за весь час',
				'',
				'📢 /all',
				'1. Тарас — 4 / 31',
				'2. Олег — 2 / 17',
				'',
				'🏠 /domikpisik',
				'1. Андрій — 9 / 120',
				'',
				'✅ Граю · разом 12 / 143',
				'1. Ігор — 5 / 40',
				'',
				'🎮 Відкриває пули',
				'1. Тарас — 3 / 25',
				'',
				'❌ Пас',
				'1. Макс — 2 / 30',
			].join('\n'),
		);
	});

	it('ranks by this month, then by all time', () => {
		const text = statsText(
			stats({ all: [tally(2, 1, 9), tally(1, 2, 30), tally(4, 2, 5)] }),
			'листопад',
		);

		expect(board(text, '📢 /all')).toEqual([
			'📢 /all',
			'1. Тарас — 2 / 30',
			'2. Ігор — 2 / 5',
			'3. Олег — 1 / 9',
		]);
	});

	it('gives equal counts one place, in Ukrainian name order, and skips the places they fill', () => {
		const text = statsText(
			stats({ pool_open: [tally(4, 3, 10), tally(7, 1, 2), tally(6, 3, 10)] }),
			'листопад',
		);

		expect(board(text, '🎮 Відкриває пули')).toEqual([
			'🎮 Відкриває пули',
			'1. Діма — 3 / 10',
			'1. Ігор — 3 / 10',
			'3. Саша — 1 / 2',
		]);
	});

	it('leaves out whoever has nothing counted, and keeps whoever has nothing this month', () => {
		const text = statsText(stats({ pass: [tally(5, 0, 0), tally(3, 0, 4)] }), 'листопад');

		expect(board(text, '❌ Пас')).toEqual(['❌ Пас', '1. Андрій — 0 / 4']);
	});

	it('says each empty board is empty so far, the Граю title keeping its total', () => {
		expect(statsText(stats({}), 'грудень')).toBe(
			[
				'📊 Статистика · грудень / за весь час',
				'',
				'📢 /all',
				'— поки порожньо',
				'',
				'🏠 /domikpisik',
				'— поки порожньо',
				'',
				'✅ Граю · разом 0 / 0',
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

		const text = statsText(stats({ domikpisik: [tally(8, 1, 1)] }, undefined, names), 'листопад');

		expect(board(text, '🏠 /domikpisik')).toEqual([
			'🏠 /domikpisik',
			'1. Ж&lt;b&gt;ук&lt;/b&gt; &amp; Co — 1 / 1',
		]);
	});

	it('shows the id of someone the bot never learned, rather than dropping their count', () => {
		const text = statsText(stats({ all: [tally(99, 1, 1)] }), 'листопад');

		expect(board(text, '📢 /all')).toEqual(['📢 /all', '1. 99 — 1 / 1']);
	});
});
