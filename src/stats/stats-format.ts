// What /stats says: the boards one under another, each person's count this month and in all.
import { escapeHtml } from '../members/mentions';
import { compareNames, texts } from '../texts';
import type { EventKind } from './event-store';
import type { Counts, Stats, Tally } from './stats-queries';

interface Row extends Counts {
	name: string;
}

/** The reply to /stats: the header with the Kyiv month's name, then the five boards. */
export function statsText(stats: Stats, month: string): string {
	const copy = texts.stats;
	const board = (title: string, kind: EventKind): string =>
		boardText(title, rowsOf(stats.tallies[kind], stats.names));
	return [
		copy.header(month),
		board(copy.all, 'all'),
		board(copy.domikpisik, 'domikpisik'),
		board(copy.joins(stats.joins.month, stats.joins.allTime), 'join'),
		board(copy.poolsOpened, 'pool_open'),
		board(copy.passes, 'pass'),
	].join('\n\n');
}

/** Named as the chat knows them; the id stands in rather than a count going missing. */
function rowsOf(tallies: readonly Tally[], names: ReadonlyMap<number, string>): Row[] {
	return tallies.map(({ userId, month, allTime }) => ({
		name: names.get(userId) ?? String(userId),
		month,
		allTime,
	}));
}

function boardText(title: string, rows: readonly Row[]): string {
	const standing = rows.filter(hasCounts).sort(byStanding);
	if (standing.length === 0) return [title, texts.stats.empty].join('\n');
	const lines = standing.map((row) =>
		texts.stats.row(placeOf(row, standing), escapeHtml(row.name), row.month, row.allTime),
	);
	return [title, ...lines].join('\n');
}

function hasCounts(row: Row): boolean {
	return row.month > 0 || row.allTime > 0;
}

/** This month first, then all time; the name only orders people the counts can't tell apart. */
function byStanding(a: Row, b: Row): number {
	return b.month - a.month || b.allTime - a.allTime || compareNames(a.name, b.name);
}

/** Equal counts share a place, and the places they fill are skipped: 1, 1, 3. */
function placeOf(row: Row, standing: readonly Row[]): number {
	const firstAlike = standing.findIndex((other) => sameCounts(other, row));
	return firstAlike + 1;
}

function sameCounts(a: Counts, b: Counts): boolean {
	return a.month === b.month && a.allTime === b.allTime;
}
