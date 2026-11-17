// The boards' reads of the event record. What counts lives here, in code: the record keeps every
// event, so a new board or rule needs no rebuild of a table whose history can't be regenerated.
import type { MonthWindow } from '../kyiv-time';
import type { EventKind } from './event-store';

/** A count this month and in all. */
export interface Counts {
	month: number;
	allTime: number;
}

/** One person's counts of one kind of event. */
export interface Tally extends Counts {
	userId: number;
}

/** Everything /stats shows: each kind's tallies, the joins' total, and who is who. */
export interface Stats {
	tallies: Record<EventKind, readonly Tally[]>;
	joins: Counts;
	/** Each person's name as the chat tells them apart, leavers' too. */
	names: ReadonlyMap<number, string>;
}

type CountsRow = { month: number; all_time: number };
type TallyRow = CountsRow & { user_id: number };

const EVERY_EVENT = 'SELECT user_id, at FROM events WHERE kind = ?';

/** A person's answers in one pool count once, at the first, so toggling can't inflate a board. */
const FIRST_IN_EACH_POOL =
	'SELECT user_id, MIN(at) AS at FROM events WHERE kind = ? GROUP BY pool_id, user_id';

/** The events each kind's board counts. */
const COUNTED: Record<EventKind, string> = {
	all: EVERY_EVENT,
	domikpisik: EVERY_EVENT,
	pool_open: FIRST_IN_EACH_POOL,
	join: FIRST_IN_EACH_POOL,
	pass: FIRST_IN_EACH_POOL,
};

const THIS_MONTH_AND_IN_ALL =
	'COUNT(*) FILTER (WHERE at >= ? AND at < ?) AS month, COUNT(*) AS all_time';

/** How often each person did `kind`, this month and in all: everyone who ever did it. */
export function tallies(sql: SqlStorage, kind: EventKind, month: MonthWindow): Tally[] {
	return sql
		.exec<TallyRow>(
			`WITH counted AS (${COUNTED[kind]})
			 SELECT user_id, ${THIS_MONTH_AND_IN_ALL} FROM counted GROUP BY user_id ORDER BY user_id`,
			kind,
			month.start,
			month.end,
		)
		.toArray()
		.map((row) => ({ userId: row.user_id, month: row.month, allTime: row.all_time }));
}

/** Everyone's Граю together: each pool and person once, so it is the sum of the board's rows. */
export function totalJoins(sql: SqlStorage, month: MonthWindow): Counts {
	const row = sql
		.exec<CountsRow>(
			`WITH counted AS (${COUNTED.join}) SELECT ${THIS_MONTH_AND_IN_ALL} FROM counted`,
			'join',
			month.start,
			month.end,
		)
		.one();
	return { month: row.month, allTime: row.all_time };
}
