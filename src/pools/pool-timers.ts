// The pools table is the alarm's schedule: what each open pool is owed, and when. No jobs table,
// so a closed pool can't fire and nothing needs cancelling.
import { nextMidnight } from '../kyiv-time';
import { startLabel } from './pool-format';
import { type Pool, TIMER_BACKOFF_MS } from './pool-store';

export type TimerAction = 'post-card' | 'start-ping' | 'close';

/** A failing action is tried at once, then after each backoff, then given up. */
const TRIES = TIMER_BACKOFF_MS.length + 1;

/** The actions due now for a pool, in the order the alarm runs them. */
export function dueActions(pool: Pool, now: number): TimerAction[] {
	if (pool.status !== 'open') return [];
	return dueTimes(pool)
		.filter(({ at }) => at <= now)
		.map(({ action }) => action);
}

/**
 * The next moment the alarm has work: the earliest due action over the open pools, or the Kyiv
 * midnight that changes an open card's day label. None while no pool is open.
 */
export function nextDue(pools: readonly Pool[], now: number): number | undefined {
	const times = pools
		.filter((pool) => pool.status === 'open')
		.flatMap((pool) => [
			...dueTimes(pool).map(({ at }) => at),
			...(relabelsAtMidnight(pool, now) ? [nextMidnight(now)] : []),
		]);
	return times.length > 0 ? Math.min(...times) : undefined;
}

/** When each action falls due. A failed action's retry holds back the whole pool. */
function dueTimes(pool: Pool): { action: TimerAction; at: number }[] {
	const due: { action: TimerAction; at: number }[] = [];
	if (pool.messageId === undefined && pool.timerAttempts < TRIES) {
		due.push({ action: 'post-card', at: pool.openedAt });
	}
	if (pool.startsAt !== undefined && !pool.startPinged) {
		due.push({ action: 'start-ping', at: pool.startsAt });
	}
	due.push({ action: 'close', at: pool.closesAt });
	const retryAt = pool.timerRetryAt;
	return retryAt === undefined
		? due
		: due.map(({ action, at }) => ({ action, at: Math.max(at, retryAt) }));
}

/** The card says сьогодні or завтра, and midnight will say something else. */
function relabelsAtMidnight(pool: Pool, now: number): boolean {
	if (pool.messageId === undefined) return false;
	return startLabel(pool.startsAt, now) !== startLabel(pool.startsAt, nextMidnight(now));
}
