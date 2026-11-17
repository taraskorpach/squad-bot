// The pools' SQL. Records come out as plain data; the rules and the card never see rows.
import type { Answer, Choice } from './pool-rules';

export interface Pool {
	id: number;
	game: string;
	size: number;
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
};

type AnswerRow = { user_id: number; choice: Choice; rank: number; answered_at: number };

export function insertPool(sql: SqlStorage, pool: NewPool): number {
	return sql
		.exec<{ id: number }>(
			`INSERT INTO pools (game, size, author_id, opened_at, starts_at, closes_at)
			 VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
			pool.game,
			pool.size,
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

export function answersOf(sql: SqlStorage, poolId: number): Answer[] {
	return sql
		.exec<AnswerRow>(
			'SELECT user_id, choice, rank, answered_at FROM answers WHERE pool_id = ?',
			poolId,
		)
		.toArray()
		.map((row) => ({
			userId: row.user_id,
			choice: row.choice,
			rank: row.rank,
			answeredAt: row.answered_at,
		}));
}

export function saveAnswer(sql: SqlStorage, poolId: number, answer: Answer): void {
	sql.exec(
		`INSERT INTO answers (pool_id, user_id, choice, rank, answered_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (pool_id, user_id) DO UPDATE SET
			choice = excluded.choice, rank = excluded.rank, answered_at = excluded.answered_at`,
		poolId,
		answer.userId,
		answer.choice,
		answer.rank,
		answer.answeredAt,
	);
}

export function markSquadAnnounced(sql: SqlStorage, poolId: number): void {
	sql.exec('UPDATE pools SET squad_announced = 1 WHERE id = ?', poolId);
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
		size: row.size,
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
	};
}
