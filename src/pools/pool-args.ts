import { occurrencesAround, type WallTime } from '../kyiv-time';

/** What `/pool` asks for. No time means a pool for now. */
export interface PoolArgs {
	game: string;
	size: number;
	time?: WallTime;
}

/** Each maps to its reply in `design.md` → *Errors and empty states*. */
export type PoolArgsError = { kind: 'size' } | { kind: 'time' | 'token'; token: string };

export type ParsedPoolArgs = { ok: true; args: PoolArgs } | { ok: false; error: PoolArgsError };

export const POOL_SIZES = { min: 2, max: 10 };

const DEFAULT_GAME = 'CS2';
const DEFAULT_SIZE = 5;
const MAX_GAME_LENGTH = 32;
const TIME = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/;
/** Looks like a time but isn't one, such as 25:00: worth its own hint. */
const TIME_LIKE = /^\d{1,2}[:.]\d{2}$/;
const SIZE = /^\d{1,2}$/;
const NOW_WINDOW_MS = 60 * 60 * 1000;

/**
 * The game word comes first if at all, then a size and a time in any order. A game name with a
 * space can't be told from a size ("dota 2"), so the game is one word.
 */
export function parsePoolArgs(text: string): ParsedPoolArgs {
	let game = DEFAULT_GAME;
	let size: number | undefined;
	let time: WallTime | undefined;
	for (const [index, token] of text.split(/\s+/).filter(Boolean).entries()) {
		const timeMatch = TIME.exec(token);
		if (timeMatch) {
			if (time) return refused({ kind: 'token', token });
			time = { hour: Number(timeMatch[1]), minute: Number(timeMatch[2]) };
		} else if (TIME_LIKE.test(token)) {
			return refused({ kind: 'time', token });
		} else if (SIZE.test(token)) {
			const value = Number(token);
			if (value < POOL_SIZES.min || value > POOL_SIZES.max) return refused({ kind: 'size' });
			if (size !== undefined) return refused({ kind: 'token', token });
			size = value;
		} else {
			if (index > 0 || token.length > MAX_GAME_LENGTH) return refused({ kind: 'token', token });
			game = token;
		}
	}
	return { ok: true, args: { game, size: size ?? DEFAULT_SIZE, ...(time && { time }) } };
}

/**
 * When a pool for `time` starts, against the message's date rather than the processing time.
 * A time that passed under an hour ago means now (undefined): `/pool cs2 23:45` sent at 00:10.
 * Otherwise it is the next occurrence: `/pool cs2 21:00` sent at 22:30 means tomorrow.
 */
export function startOf(time: WallTime, sentAt: number): number | undefined {
	const { yesterday, today, tomorrow } = occurrencesAround(time, sentAt);
	const latestPast = today <= sentAt ? today : yesterday;
	if (sentAt - latestPast < NOW_WINDOW_MS) return undefined;
	return today > sentAt ? today : tomorrow;
}

function refused(error: PoolArgsError): ParsedPoolArgs {
	return { ok: false, error };
}
