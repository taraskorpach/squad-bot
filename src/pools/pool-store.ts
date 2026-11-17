// The pools' SQL. Records come out as plain data; the rules and the card never see rows.

/** `pools.size` of a pool without a seat limit: the column is NOT NULL, so 0 stands in. */
const NO_LIMIT = 0;

export interface Pool {
	id: number;
	game: string;
	/** The seats; none for a pool without a limit. */
	size?: number;
	authorId: number;
	openedAt: number;
	/** None for a pool "now". */
	startsAt?: number;
	closesAt: number;
	/** The card's message; none until the card has been posted. */
	messageId?: number;
	status: 'open' | 'closed';
	closedBy?: 'auto' | 'author';
	squadAnnounced: boolean;
	drawn: boolean;
	/** The last render Telegram accepted, so an unchanged card isn't edited again. */
	cardRender?: string;
	/** The players were tagged at the start, or the ping was skipped or given up. */
	startPinged: boolean;
	/** How many timer actions in a row have failed for this pool. */
	timerAttempts: number;
	/** No timer action of this pool runs before this, after a failure. */
	timerRetryAt?: number;
}

export type NewPool = Pick<
	Pool,
	'game' | 'size' | 'authorId' | 'openedAt' | 'startsAt' | 'closesAt'
>;

type PoolRow = {
	id: number;
	game: string;
	size: number;
	author_id: number;
	opened_at: number;
	starts_at: number | null;
	closes_at: number;
	message_id: number | null;
	status: 'open' | 'closed';
	closed_by: 'auto' | 'author' | null;
	squad_announced: number;
	drawn: number;
	card_render: string | null;
	start_pinged: number;
	timer_attempts: number;
	timer_retry_at: number | null;
};

export function insertPool(sql: SqlStorage, pool: NewPool): number {
	return sql
		.exec<{ id: number }>(
			`INSERT INTO pools (game, size, author_id, opened_at, starts_at, closes_at)
			 VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
			pool.game,
			pool.size ?? NO_LIMIT,
			pool.authorId,
			pool.openedAt,
			pool.startsAt ?? null,
			pool.closesAt,
		)
		.one().id;
}

export function poolById(sql: SqlStorage, poolId: number): Pool | undefined {
	const [row] = sql.exec<PoolRow>('SELECT * FROM pools WHERE id = ?', poolId).toArray();
	return row && poolOf(row);
}

/** The pool a message of the bot's belongs to: its card, or anything posted for it. */
export function poolOfMessage(sql: SqlStorage, messageId: number): Pool | undefined {
	const [row] = sql
		.exec<PoolRow>(
			`SELECT pools.* FROM pool_messages JOIN pools ON pools.id = pool_messages.pool_id
			 WHERE pool_messages.message_id = ?`,
			messageId,
		)
		.toArray();
	return row && poolOf(row);
}

export function newestOpenPool(sql: SqlStorage): Pool | undefined {
	const [row] = sql
		.exec<PoolRow>(
			"SELECT * FROM pools WHERE status = 'open' ORDER BY opened_at DESC, id DESC LIMIT 1",
		)
		.toArray();
	return row && poolOf(row);
}

export function openPools(sql: SqlStorage): Pool[] {
	return sql
		.exec<PoolRow>("SELECT * FROM pools WHERE status = 'open' ORDER BY opened_at, id")
		.toArray()
		.map(poolOf);
}

export function markSquadAnnounced(sql: SqlStorage, poolId: number): void {
	sql.exec('UPDATE pools SET squad_announced = 1 WHERE id = ?', poolId);
}

/** Closes a pool that is still open; false when it already was closed. */
export function closeOpenPool(sql: SqlStorage, poolId: number, by: 'auto' | 'author'): boolean {
	const closed = sql.exec(
		"UPDATE pools SET status = 'closed', closed_by = ? WHERE id = ? AND status = 'open'",
		by,
		poolId,
	).rowsWritten;
	return closed > 0;
}

/** The card is posted: the pool knows its message, and the message knows its pool. */
export function saveCard(sql: SqlStorage, poolId: number, messageId: number, render: string): void {
	sql.exec(
		'UPDATE pools SET message_id = ?, card_render = ? WHERE id = ?',
		messageId,
		render,
		poolId,
	);
	savePoolMessage(sql, poolId, messageId);
}

/** A tap on a card whose id was never stored: that message is the card. */
export function adoptCard(sql: SqlStorage, poolId: number, messageId: number): void {
	const adopted = sql.exec(
		'UPDATE pools SET message_id = ? WHERE id = ? AND message_id IS NULL',
		messageId,
		poolId,
	).rowsWritten;
	if (adopted > 0) savePoolMessage(sql, poolId, messageId);
}

export function saveCardRender(sql: SqlStorage, poolId: number, render: string): void {
	sql.exec('UPDATE pools SET card_render = ? WHERE id = ?', render, poolId);
}

export function savePoolMessage(sql: SqlStorage, poolId: number, messageId: number): void {
	sql.exec(
		'INSERT OR IGNORE INTO pool_messages (message_id, pool_id) VALUES (?, ?)',
		messageId,
		poolId,
	);
}

function poolOf(row: PoolRow): Pool {
	return {
		id: row.id,
		game: row.game,
		size: row.size === NO_LIMIT ? undefined : row.size,
		authorId: row.author_id,
		openedAt: row.opened_at,
		startsAt: row.starts_at ?? undefined,
		closesAt: row.closes_at,
		messageId: row.message_id ?? undefined,
		status: row.status,
		closedBy: row.closed_by ?? undefined,
		squadAnnounced: row.squad_announced === 1,
		drawn: row.drawn === 1,
		cardRender: row.card_render ?? undefined,
		startPinged: row.start_pinged === 1,
		timerAttempts: row.timer_attempts,
		timerRetryAt: row.timer_retry_at ?? undefined,
	};
}
