// The menu a bare /pool opens, pure: what its buttons carry and what each step shows. Nothing is
// stored: every button carries the choices made so far, and the step is read off them.
import type { InlineKeyboardButton, InlineKeyboardMarkup } from 'grammy/types';
import { upcomingHours, type WallTime } from '../kyiv-time';
import { texts } from '../texts';
import { POOL_SIZES } from './pool-args';

/** A size, or no seat limit. */
export type MenuSeats = number | 'no-limit';

/**
 * The time so far: nothing yet, the other time's hour step, its minutes step for an hour, or a
 * choice that opens the pool: now, a full hour from the time step, or another time.
 */
export type MenuTime =
	| { kind: 'unset' }
	| { kind: 'other' }
	| { kind: 'other-hour'; hour: number }
	| { kind: 'now' }
	| { kind: 'hour'; hour: number }
	| { kind: 'at'; time: WallTime };

export interface MenuState {
	/** Who sent /pool: the only one whose taps count. */
	author: number;
	/** An index into `texts.pool.menu.games`. */
	game?: number;
	seats?: MenuSeats;
	time: MenuTime;
}

/** A menu with everything its pool needs. */
export interface CompleteMenu extends MenuState {
	game: number;
	seats: MenuSeats;
	time: Extract<MenuTime, { kind: 'now' | 'hour' | 'at' }>;
}

export type MenuTap = { kind: 'cancel'; author: number } | { kind: 'state'; state: MenuState };

export interface MenuScreen {
	text: string;
	keyboard: InlineKeyboardMarkup;
}

type Button = InlineKeyboardButton.CallbackButton;

const { games } = texts.pool.menu;
const UNSET = '-';
const NO_LIMIT = '0';
const UNSET_TIME: MenuTime = { kind: 'unset' };
// `m:{author}:x`, or `m:{author}:{game}:{seats}:{time}`: far under Telegram's 64 bytes.
const MENU_DATA = /^m:(\d{1,16}):(?:x|(-|\d):(-|\d{1,2}):(-|n|o|o\d{2}|t\d{2}|\d{4}))$/;
const SEAT_ROWS = [
	[2, 3, 4, 5, 6],
	[7, 8, 9, 10],
];
const HOUR_ROWS = [0, 6, 12, 18].map((from) => Array.from({ length: 6 }, (_, i) => from + i));
const MINUTE_ROWS = [0, 30].map((from) => Array.from({ length: 6 }, (_, i) => from + i * 5));
const HOURS_PER_ROW = 3;

/** The menu a bare /pool posts: the game step. */
export function menuFor(author: number): MenuState {
	return { author, time: UNSET_TIME };
}

/** The game a menu picked, by name. */
export function gameOf(menu: { game: number }): string {
	return games[menu.game] ?? games[0];
}

export function encodeMenu({ author, game, seats, time }: MenuState): string {
	return ['m', author, game ?? UNSET, seatsCode(seats), timeCode(time)].join(':');
}

export function encodeCancel(author: number): string {
	return `m:${author}:x`;
}

/** The menu a button carries; nothing for other data, or for a menu no step leads to. */
export function decodeMenu(data: string): MenuTap | undefined {
	const match = MENU_DATA.exec(data);
	if (!match) return undefined;
	const [, authorText = '', gameText, seatsText = UNSET, timeText = UNSET] = match;
	const author = Number(authorText);
	if (gameText === undefined) return { kind: 'cancel', author };
	const game = gameText === UNSET ? undefined : Number(gameText);
	if (game !== undefined && game >= games.length) return undefined;
	const seats = seatsOf(seatsText);
	const time = timeOf(timeText);
	if (seats === null || time === undefined) return undefined;
	const state: MenuState = {
		author,
		...(game !== undefined && { game }),
		...(seats !== undefined && { seats }),
		time,
	};
	return reachable(state) ? { kind: 'state', state } : undefined;
}

export function isComplete(state: MenuState): state is CompleteMenu {
	const { kind } = state.time;
	return (
		state.game !== undefined &&
		state.seats !== undefined &&
		(kind === 'now' || kind === 'hour' || kind === 'at')
	);
}

/**
 * The step a menu is on, with its words and buttons. A complete menu shows the time step again:
 * the taps do that when the hour tapped has passed.
 */
export function menuScreen(state: MenuState, now: number): MenuScreen {
	const { menu } = texts.pool;
	const { author, game, seats, time } = state;
	const cancel: Button = { text: menu.cancelButton, callback_data: encodeCancel(author) };
	const backTo = (previous: MenuState): Button[] => [to(menu.backButton, previous), cancel];
	if (game === undefined) {
		const pick = (name: string, index: number) =>
			to(name, { author, game: index, time: UNSET_TIME });
		return screen(menu.pickGame, [games.map(pick), [cancel]]);
	}
	const name = gameOf({ game });
	if (seats === undefined) {
		const pick = (label: string, chosen: MenuSeats) =>
			to(label, { author, game, seats: chosen, time: UNSET_TIME });
		return screen(menu.pickSeats(name), [
			...SEAT_ROWS.map((row) => row.map((size) => pick(String(size), size))),
			[pick(menu.noLimitButton, 'no-limit')],
			backTo(menuFor(author)),
		]);
	}
	const seatsLabel = texts.pool.card.seats(seats === 'no-limit' ? undefined : seats);
	const at = (next: MenuTime): MenuState => ({ author, game, seats, time: next });
	if (time.kind === 'other') {
		return screen(menu.pickHour(name, seatsLabel), [
			...HOUR_ROWS.map((row) =>
				row.map((hour) => to(twoDigits(hour), at({ kind: 'other-hour', hour }))),
			),
			backTo(at(UNSET_TIME)),
		]);
	}
	if (time.kind === 'other-hour') {
		const { hour } = time;
		return screen(menu.pickMinute(name, seatsLabel, twoDigits(hour)), [
			...MINUTE_ROWS.map((row) =>
				row.map((minute) =>
					to(`:${twoDigits(minute)}`, at({ kind: 'at', time: { hour, minute } })),
				),
			),
			backTo(at({ kind: 'other' })),
		]);
	}
	return screen(menu.pickTime(name, seatsLabel), [
		[to(menu.nowButton, at({ kind: 'now' }))],
		...rowsOf(upcomingHours(now), HOURS_PER_ROW).map((row) =>
			row.map((hour) => to(`${twoDigits(hour)}:00`, at({ kind: 'hour', hour }))),
		),
		[to(menu.otherTimeButton, at({ kind: 'other' }))],
		backTo({ author, game, time: UNSET_TIME }),
	]);
}

function to(text: string, next: MenuState): Button {
	return { text, callback_data: encodeMenu(next) };
}

function screen(text: string, rows: Button[][]): MenuScreen {
	return { text, keyboard: { inline_keyboard: rows } };
}

/** A step is reached only in order: the seats after the game, the time after the seats. */
function reachable({ game, seats, time }: MenuState): boolean {
	if (seats !== undefined && game === undefined) return false;
	return time.kind === 'unset' || seats !== undefined;
}

function seatsCode(seats: MenuSeats | undefined): string {
	if (seats === undefined) return UNSET;
	return seats === 'no-limit' ? NO_LIMIT : String(seats);
}

/** Unset, a size or no limit; `null` for a size the pools don't take. */
function seatsOf(code: string): MenuSeats | undefined | null {
	if (code === UNSET) return undefined;
	if (code === NO_LIMIT) return 'no-limit';
	const size = Number(code);
	return size >= POOL_SIZES.min && size <= POOL_SIZES.max ? size : null;
}

function timeCode(time: MenuTime): string {
	switch (time.kind) {
		case 'unset':
			return UNSET;
		case 'now':
			return 'n';
		case 'other':
			return 'o';
		case 'other-hour':
			return `o${twoDigits(time.hour)}`;
		case 'hour':
			return `t${twoDigits(time.hour)}`;
		case 'at':
			return `${twoDigits(time.time.hour)}${twoDigits(time.time.minute)}`;
	}
}

function timeOf(code: string): MenuTime | undefined {
	if (code === UNSET) return UNSET_TIME;
	if (code === 'n') return { kind: 'now' };
	if (code === 'o') return { kind: 'other' };
	if (code.startsWith('o') || code.startsWith('t')) {
		const hour = hourOf(code.slice(1));
		if (hour === undefined) return undefined;
		return code.startsWith('o') ? { kind: 'other-hour', hour } : { kind: 'hour', hour };
	}
	const hour = hourOf(code.slice(0, 2));
	const minute = Number(code.slice(2));
	return hour === undefined || minute > 59 ? undefined : { kind: 'at', time: { hour, minute } };
}

function hourOf(text: string): number | undefined {
	const hour = Number(text);
	return hour <= 23 ? hour : undefined;
}

function rowsOf<T>(items: readonly T[], perRow: number): T[][] {
	const rows: T[][] = [];
	for (let at = 0; at < items.length; at += perRow) rows.push(items.slice(at, at + perRow));
	return rows;
}

function twoDigits(value: number): string {
	return String(value).padStart(2, '0');
}
