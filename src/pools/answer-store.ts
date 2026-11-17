// The answers' SQL: one row per person per pool, in line by rank.
import type { Answer, Choice } from './pool-rules';

type AnswerRow = { user_id: number; choice: Choice; rank: number; answered_at: number };

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

/** The draw's new line: every play renumbered, and the draw marked used. */
export function saveDraw(sql: SqlStorage, poolId: number, plays: readonly Answer[]): void {
	for (const given of plays) {
		sql.exec(
			'UPDATE answers SET rank = ? WHERE pool_id = ? AND user_id = ?',
			given.rank,
			poolId,
			given.userId,
		);
	}
	sql.exec('UPDATE pools SET drawn = 1 WHERE id = ?', poolId);
}
