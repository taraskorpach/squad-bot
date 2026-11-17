import { GrammyError } from 'grammy';

// When a failed update answers 500, Telegram redelivers it. It retries for 24 h and holds the
// chat's later messages behind it, so redelivery is allowed only when a retry can't duplicate
// anything, and only a few times.

/** Stop redelivering once an update has failed this often, the first failure this long ago. */
export const REDELIVERY_CAP = { attempts: 3, sinceFirstMs: 5 * 60 * 1000 } as const;

export interface FailedAttempt {
	/** A change of the update had committed before it failed. */
	committed: boolean;
	/** A Telegram call of the update had succeeded before it failed. */
	delivered: boolean;
	error: unknown;
}

export interface FailureCount {
	/** Failures so far, the latest included. */
	attempts: number;
	firstFailedAt: number;
}

/** A retry is safe: nothing was committed or sent, and the error may pass on its own. */
export function canRedeliver({ committed, delivered, error }: FailedAttempt): boolean {
	return !committed && !delivered && !isPermanentTelegramError(error);
}

/** The cap waits 5 minutes too, so a deploy that resets the object still gets its redelivery. */
export function redeliveryCapReached(
	{ attempts, firstFailedAt }: FailureCount,
	now: number,
): boolean {
	return attempts >= REDELIVERY_CAP.attempts && now - firstFailedAt >= REDELIVERY_CAP.sinceFirstMs;
}

/** A 4xx other than 429 says the request itself is wrong: sending it again won't help. */
function isPermanentTelegramError(error: unknown): boolean {
	return (
		error instanceof GrammyError &&
		error.error_code >= 400 &&
		error.error_code < 500 &&
		error.error_code !== 429
	);
}
