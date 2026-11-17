// What /stats says: the boards one under another, each person's count in all.
import { escapeHtml } from '../members/mentions';
import { compareNames, texts } from '../texts';
import type { EventKind } from './event-store';
import type { Stats, Tally } from './stats-queries';

interface Row {
	name: string;
	count: number;
}

/** The reply to /stats: the header, then the six boards. */
export function statsText(stats: Stats): string {
	const copy = texts.stats;
	const board = (title: string, kind: EventKind): string =>
		boardText(title, rowsOf(stats.tallies[kind], stats.names));
	return [
		copy.header,
		board(copy.all, 'all'),
		board(copy.domikpisik, 'domikpisik'),
		board(copy.shares, 'share'),
		board(copy.joins(stats.joins), 'join'),
		board(copy.poolsOpened, 'pool_open'),
		board(copy.passes, 'pass'),
	].join('\n\n');
}

/** Named as the chat knows them; the id stands in rather than a count going missing. */
function rowsOf(tallies: readonly Tally[], names: ReadonlyMap<number, string>): Row[] {
	return tallies.map(({ userId, count }) => ({ name: names.get(userId) ?? String(userId), count }));
}

function boardText(title: string, rows: readonly Row[]): string {
	if (rows.length === 0) return [title, texts.stats.empty].join('\n');
	const standing = rows.toSorted(byStanding);
	const lines = standing.map((row) =>
		texts.stats.row(placeOf(row, standing), escapeHtml(row.name), row.count),
	);
	return [title, ...lines].join('\n');
}

/** The count first; the name only orders people the count can't tell apart. */
function byStanding(a: Row, b: Row): number {
	return b.count - a.count || compareNames(a.name, b.name);
}

/** Equal counts share a place, and the places they fill are skipped: 1, 1, 3. */
function placeOf(row: Row, standing: readonly Row[]): number {
	return standing.findIndex((other) => other.count === row.count) + 1;
}
