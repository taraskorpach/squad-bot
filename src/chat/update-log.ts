// Which updates were processed and which failed: dedupe and the redelivery cap.
import type { FailureCount } from './failure-policy';

/** Telegram keeps an update for 24 h at most, so a redelivery after 48 h can't happen. */
const RETENTION_MS = 48 * 60 * 60 * 1000;

export function isProcessed(sql: SqlStorage, updateId: number): boolean {
	return (
		sql.exec('SELECT 1 FROM processed_updates WHERE update_id = ?', updateId).toArray().length > 0
	);
}

/** Harmless to repeat: a second record in the same update changes nothing. */
export function recordProcessed(sql: SqlStorage, updateId: number, now: number): void {
	sql.exec(
		'INSERT OR IGNORE INTO processed_updates (update_id, processed_at) VALUES (?, ?)',
		updateId,
		now,
	);
}

/** Counts one more failure of the update and returns the count so far. */
export function recordFailure(sql: SqlStorage, updateId: number, now: number): FailureCount {
	const row = sql
		.exec<{ attempts: number; first_failed_at: number }>(
			`INSERT INTO failed_updates (update_id, attempts, first_failed_at) VALUES (?, 1, ?)
			 ON CONFLICT (update_id) DO UPDATE SET attempts = attempts + 1
			 RETURNING attempts, first_failed_at`,
			updateId,
			now,
		)
		.one();
	return { attempts: row.attempts, firstFailedAt: row.first_failed_at };
}

export function pruneUpdateLog(sql: SqlStorage, now: number): void {
	const cutoff = now - RETENTION_MS;
	sql.exec('DELETE FROM processed_updates WHERE processed_at < ?', cutoff);
	sql.exec('DELETE FROM failed_updates WHERE first_failed_at < ?', cutoff);
}
