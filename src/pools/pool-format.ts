import type { InlineKeyboardMarkup } from 'grammy/types';
import { clockTime, dayAndMonth, daysFrom } from '../kyiv-time';
import { escapeHtml } from '../members/mentions';
import { compareNames, texts } from '../texts';
import { poolKeyboard } from './pool-keyboards';
import type { Lineup } from './pool-rules';
import type { Pool } from './pool-store';

export interface Card {
	text: string;
	/** None on a closed card: an edit without one takes the buttons away. */
	keyboard?: InlineKeyboardMarkup;
}

/**
 * The pool's card. Deterministic: the same pool, lineup, names and time give the same card, so
 * an unchanged one is never edited again. `now` only moves the сьогодні and завтра labels.
 */
export function renderCard(
	pool: Pool,
	lineup: Lineup,
	names: ReadonlyMap<number, string>,
	now: number,
): Card {
	const nameOf = (id: number): string => names.get(id) ?? String(id);
	const open = pool.status === 'open';
	const when = open ? startLabel(pool.startsAt, now) : dated(pool.startsAt ?? pool.openedAt);
	const text = [
		texts.pool.card.header(escapeHtml(pool.game), pool.size, when),
		authorLine(pool, escapeHtml(nameOf(pool.authorId))),
		'',
		...answerLines(pool, lineup, nameOf),
	].join('\n');
	return open ? { text, keyboard: poolKeyboard(pool.id) } : { text };
}

/** An open card's start: now, today, tomorrow, or the date of a start a day behind. */
export function startLabel(startsAt: number | undefined, now: number): string {
	const { card } = texts.pool;
	if (startsAt === undefined) return card.now;
	const days = daysFrom(now, startsAt);
	if (days === 0) return card.today(clockTime(startsAt));
	if (days === 1) return card.tomorrow(clockTime(startsAt));
	return dated(startsAt);
}

function dated(ms: number): string {
	return texts.pool.card.onDate(dayAndMonth(ms), clockTime(ms));
}

function authorLine(pool: Pool, author: string): string {
	const { card } = texts.pool;
	if (pool.status === 'open') return card.author(author);
	return `${card.author(author)} · ${pool.closedBy === 'author' ? card.closedByAuthor : card.closed}`;
}

/** Who plays always shows; the bench, the passes and the silent only when someone is there. */
function answerLines(pool: Pool, lineup: Lineup, nameOf: (id: number) => string): string[] {
	const { card } = texts.pool;
	const list = (ids: readonly number[]): string =>
		ids.map((id) => escapeHtml(nameOf(id))).join(', ');
	const lineFor = (ids: readonly number[], line: (names: string) => string): string[] =>
		ids.length > 0 ? [line(list(ids))] : [];
	const open = pool.status === 'open';
	const players = list(lineup.players) || card.nobody;
	const silent = [...lineup.unanswered].sort((a, b) => compareNames(nameOf(a), nameOf(b)));
	return [
		open ? card.players(lineup.players.length, pool.size, players) : card.played(players),
		...lineFor(lineup.bench, card.bench),
		...lineFor(lineup.passed, card.passed),
		...(open ? lineFor(silent, card.unanswered) : []),
	];
}
