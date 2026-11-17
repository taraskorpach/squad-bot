// The boards' reads of the event record. What counts lives here, in code: the record keeps every
// event, so a new board or rule needs no rebuild of a table whose history can't be regenerated.
import { knownMembers } from '../members/member-store';
import { displayNames } from '../members/mentions';
import type { EventKind } from './event-store';

/** How often one person did one kind of event, in all. */
export interface Tally {
	userId: number;
	count: number;
}

/** Everything /stats shows: each kind's tallies, the joins' total, and who is who. */
export interface Stats {
	tallies: Record<EventKind, readonly Tally[]>;
	joins: number;
	/** Each person's name as the chat tells them apart, leavers' too. */
	names: ReadonlyMap<number, string>;
}

type TallyRow = { user_id: number; count: number };

const EVERY_EVENT = 'SELECT user_id FROM events WHERE kind = ?';

/** A person's answers in one pool count once, so toggling can't inflate a board. */
const ONCE_IN_EACH_POOL = 'SELECT user_id FROM events WHERE kind = ? GROUP BY pool_id, user_id';

/** The events each kind's board counts. */
const COUNTED: Record<EventKind, string> = {
	all: EVERY_EVENT,
	domikpisik: EVERY_EVENT,
	pool_open: ONCE_IN_EACH_POOL,
	join: ONCE_IN_EACH_POOL,
	pass: ONCE_IN_EACH_POOL,
};

/**
 * Everything /stats shows. Names are told apart among every member the bot knows, so a namesake
 * who left still gets the initial that tells the two apart.
 */
export function readStats(sql: SqlStorage): Stats {
	return {
		tallies: {
			all: tallies(sql, 'all'),
			domikpisik: tallies(sql, 'domikpisik'),
			pool_open: tallies(sql, 'pool_open'),
			join: tallies(sql, 'join'),
			pass: tallies(sql, 'pass'),
		},
		joins: totalJoins(sql),
		names: displayNames(knownMembers(sql)),
	};
}

/** How often each person did `kind`: everyone who ever did it. */
export function tallies(sql: SqlStorage, kind: EventKind): Tally[] {
	return sql
		.exec<TallyRow>(
			`WITH counted AS (${COUNTED[kind]})
			 SELECT user_id, COUNT(*) AS count FROM counted GROUP BY user_id ORDER BY user_id`,
			kind,
		)
		.toArray()
		.map((row) => ({ userId: row.user_id, count: row.count }));
}

/** Everyone's Граю together: each pool and person once, so it is the sum of the board's rows. */
export function totalJoins(sql: SqlStorage): number {
	return sql
		.exec<{ count: number }>(
			`WITH counted AS (${COUNTED.join}) SELECT COUNT(*) AS count FROM counted`,
			'join',
		)
		.one().count;
}
