import { describe, expect, it } from 'vitest';
import {
	decodeMenu,
	encodeCancel,
	encodeMenu,
	type MenuState,
	menuScreen,
} from '../../src/pools/pool-menu';

// 16.11.2030 in Kyiv, two hours ahead of UTC in winter.
const kyiv = (hour: number, minute = 0) => Date.UTC(2030, 10, 16, hour - 2, minute);
const NOW = kyiv(18, 40);
const AUTHOR = 441458421;

const atGame: MenuState = { author: AUTHOR, time: { kind: 'unset' } };
const atSeats: MenuState = { ...atGame, game: 1 };
const atTime: MenuState = { ...atSeats, seats: 8 };
const atHour: MenuState = { ...atTime, time: { kind: 'other' } };
const atMinute: MenuState = { ...atTime, time: { kind: 'other-hour', hour: 21 } };

type Button = { text: string; callback_data: string };

function buttonsOf(state: MenuState, now = NOW): Button[][] {
	return menuScreen(state, now).keyboard.inline_keyboard.map((row) =>
		row.map((button) => button as Button),
	);
}

function labels(state: MenuState, now = NOW): string[][] {
	return buttonsOf(state, now).map((row) => row.map((button) => button.text));
}

function dataOf(state: MenuState, label: string, now = NOW): string | undefined {
	return buttonsOf(state, now)
		.flat()
		.find((button) => button.text === label)?.callback_data;
}

const twoDigits = (value: number): string => String(value).padStart(2, '0');
const hourRow = (from: number): string[] =>
	Array.from({ length: 6 }, (_, index) => twoDigits(from + index));
const BACK_AND_CANCEL = ['← Назад', '✖️ Скасувати'];

describe('the menu’s button data', () => {
	it.each([
		['the game step', atGame, `m:${AUTHOR}:-:-:-`],
		['the seats step', atSeats, `m:${AUTHOR}:1:-:-`],
		['the time step', atTime, `m:${AUTHOR}:1:8:-`],
		['no limit', { ...atTime, seats: 'no-limit' }, `m:${AUTHOR}:1:0:-`],
		['the other time’s hour step', atHour, `m:${AUTHOR}:1:8:o`],
		['the minutes for 21', atMinute, `m:${AUTHOR}:1:8:o21`],
		['now', { ...atTime, time: { kind: 'now' } }, `m:${AUTHOR}:1:8:n`],
		['a full hour', { ...atTime, time: { kind: 'hour', hour: 9 } }, `m:${AUTHOR}:1:8:t09`],
		[
			'another time',
			{ ...atTime, time: { kind: 'at', time: { hour: 21, minute: 5 } } },
			`m:${AUTHOR}:1:8:2105`,
		],
	] as const)('carries %s', (_case, state, data) => {
		expect(encodeMenu(state)).toBe(data);
		expect(decodeMenu(data)).toEqual({ kind: 'state', state });
	});

	it('cancels', () => {
		expect(encodeCancel(AUTHOR)).toBe(`m:${AUTHOR}:x`);
		expect(decodeMenu(`m:${AUTHOR}:x`)).toEqual({ kind: 'cancel', author: AUTHOR });
	});

	it.each([
		'p:1:in',
		'hi',
		'm:1',
		`m:${AUTHOR}:2:-:-`,
		`m:${AUTHOR}:1:1:-`,
		`m:${AUTHOR}:1:11:-`,
		`m:${AUTHOR}:1:8:t24`,
		`m:${AUTHOR}:1:8:2160`,
		`m:${AUTHOR}:-:8:-`,
		`m:${AUTHOR}:1:-:n`,
	])('leaves %s alone', (data) => {
		expect(decodeMenu(data)).toBeUndefined();
	});

	it('stays far under Telegram’s 64 bytes, whoever opens it', () => {
		const longest: MenuState = {
			author: Number.MAX_SAFE_INTEGER,
			game: 1,
			seats: 10,
			time: { kind: 'other-hour', hour: 23 },
		};

		expect(new TextEncoder().encode(encodeMenu(longest)).length).toBeLessThanOrEqual(64);
	});
});

describe('menuScreen', () => {
	it('asks for the game first', () => {
		expect(menuScreen(atGame, NOW).text).toBe(
			'🎮 Новий пул — у що граємо?\nІншу гру відкривай командою: /pool назва 5 21:00',
		);
		expect(labels(atGame)).toEqual([['CS2', 'Мафія'], ['✖️ Скасувати']]);
		expect(dataOf(atGame, 'Мафія')).toBe(`m:${AUTHOR}:1:-:-`);
		expect(dataOf(atGame, '✖️ Скасувати')).toBe(`m:${AUTHOR}:x`);
	});

	it('asks for the seats, or no limit, and goes back to the game', () => {
		expect(menuScreen(atSeats, NOW).text).toBe('🎮 Мафія — скільки місць?');
		expect(labels(atSeats)).toEqual([
			['2', '3', '4', '5', '6'],
			['7', '8', '9', '10'],
			['∞ Без ліміту'],
			BACK_AND_CANCEL,
		]);
		expect(dataOf(atSeats, '8')).toBe(`m:${AUTHOR}:1:8:-`);
		expect(dataOf(atSeats, '∞ Без ліміту')).toBe(`m:${AUTHOR}:1:0:-`);
		expect(dataOf(atSeats, '← Назад')).toBe(`m:${AUTHOR}:-:-:-`);
	});

	it('asks when: now, the full hours still ahead today, or another time', () => {
		expect(menuScreen(atTime, NOW).text).toBe('🎮 Мафія · 8 місць — коли?');
		expect(labels(atTime)).toEqual([
			['Зараз'],
			['19:00', '20:00', '21:00'],
			['22:00', '23:00'],
			['🕓 Інший час'],
			BACK_AND_CANCEL,
		]);
		expect(dataOf(atTime, 'Зараз')).toBe(`m:${AUTHOR}:1:8:n`);
		expect(dataOf(atTime, '21:00')).toBe(`m:${AUTHOR}:1:8:t21`);
		expect(dataOf(atTime, '🕓 Інший час')).toBe(`m:${AUTHOR}:1:8:o`);
		expect(dataOf(atTime, '← Назад')).toBe(`m:${AUTHOR}:1:-:-`);
	});

	it('names a pool without a limit, and offers only now and another time after 23:00', () => {
		const late: MenuState = { ...atTime, seats: 'no-limit' };

		expect(menuScreen(late, kyiv(23, 10)).text).toBe('🎮 Мафія · без ліміту — коли?');
		expect(labels(late, kyiv(23, 10))).toEqual([['Зараз'], ['🕓 Інший час'], BACK_AND_CANCEL]);
	});

	it('asks for the other time’s hour, then its minutes', () => {
		expect(menuScreen(atHour, NOW).text).toBe('🎮 Мафія · 8 місць — о котрій?');
		expect(labels(atHour)).toEqual([
			hourRow(0),
			hourRow(6),
			hourRow(12),
			hourRow(18),
			BACK_AND_CANCEL,
		]);
		expect(dataOf(atHour, '21')).toBe(`m:${AUTHOR}:1:8:o21`);
		expect(dataOf(atHour, '← Назад')).toBe(`m:${AUTHOR}:1:8:-`);

		expect(menuScreen(atMinute, NOW).text).toBe('🎮 Мафія · 8 місць — о 21:__?');
		expect(labels(atMinute)).toEqual([
			[':00', ':05', ':10', ':15', ':20', ':25'],
			[':30', ':35', ':40', ':45', ':50', ':55'],
			BACK_AND_CANCEL,
		]);
		expect(dataOf(atMinute, ':05')).toBe(`m:${AUTHOR}:1:8:2105`);
		expect(dataOf(atMinute, '← Назад')).toBe(`m:${AUTHOR}:1:8:o`);
	});
});
