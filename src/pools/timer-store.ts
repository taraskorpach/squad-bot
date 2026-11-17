// The pools' timer bookkeeping: the start ping's flag, and a failed timer action's retries.

/** A failed timer action waits this long before each retry; after the last one it is given up. */
export const TIMER_BACKOFF_MS = [60_000, 120_000, 240_000];

export function markStartPinged(sql: SqlStorage, poolId: number, pinged: boolean): void {
	sql.exec('UPDATE pools SET start_pinged = ? WHERE id = ?', pinged ? 1 : 0, poolId);
}

/** A timer action of the pool worked: nothing waits for a retry. */
export function clearTimerRetry(sql: SqlStorage, poolId: number): void {
	sql.exec('UPDATE pools SET timer_attempts = 0, timer_retry_at = NULL WHERE id = ?', poolId);
}

/**
 * A timer action of the pool failed: it waits 1, 2, then 4 minutes. Returns true when that was
 * the last try, which the caller then gives up.
 */
export function recordTimerFailure(sql: SqlStorage, poolId: number, now: number): boolean {
	const { timer_attempts: attempts } = sql
		.exec<{ timer_attempts: number }>(
			'UPDATE pools SET timer_attempts = timer_attempts + 1 WHERE id = ? RETURNING timer_attempts',
			poolId,
		)
		.one();
	const wait = TIMER_BACKOFF_MS[attempts - 1];
	const retryAt = wait === undefined ? null : now + wait;
	sql.exec('UPDATE pools SET timer_retry_at = ? WHERE id = ?', retryAt, poolId);
	return wait === undefined;
}
