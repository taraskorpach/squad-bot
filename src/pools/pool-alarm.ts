// What the alarm does for the pools. Each due action runs on its own; a failure waits for its
// retry and, after the last one, is given up, so a broken action can't loop the alarm.
import type { RoomAccess } from '../chat/room';
import { closePool } from './pool-actions';
import { cardState, mentionsIn, postCard, postUnderCard, refreshCard } from './pool-card';
import { startPingText } from './pool-messages';
import { closeOpenPool, openPools, type Pool } from './pool-store';
import { dueActions, type TimerAction } from './pool-timers';
import { clearTimerRetry, markStartPinged, recordTimerFailure } from './timer-store';

/** A start ping this late is skipped: nobody wants "час!" for a game long under way. */
const PING_LATE_MS = 15 * 60 * 1000;

// A Record, so a new timer action can't be scheduled without saying what it does.
const ACTIONS: Record<
	TimerAction,
	(room: RoomAccess, pool: Pool, now: number) => Promise<boolean>
> = {
	'post-card': (room, pool) => postCard(room, pool.id),
	'start-ping': startPing,
	close: async (room, pool) => {
		await closePool(room, pool.id, 'auto');
		return true;
	},
};

export async function runDueTimers(room: RoomAccess): Promise<void> {
	const now = room.clock();
	for (const pool of room.read((sql) => openPools(sql))) {
		for (const action of dueActions(pool, now)) {
			// A failure holds the pool's other actions back until its retry.
			if (!(await runAction(room, pool, action, now))) break;
		}
	}
	// At Kyiv midnight a card's сьогодні or завтра changes. An unchanged render isn't edited.
	for (const pool of room.read((sql) => openPools(sql))) await refreshCard(room, pool.id);
}

async function runAction(
	room: RoomAccess,
	pool: Pool,
	action: TimerAction,
	now: number,
): Promise<boolean> {
	let done = false;
	try {
		done = await ACTIONS[action](room, pool, now);
	} catch (error) {
		console.error(`pools: the ${action} of pool ${pool.id} failed`, error);
	}
	room.write((sql) => {
		if (done) return clearTimerRetry(sql, pool.id);
		if (recordTimerFailure(sql, pool.id, now)) giveUp(sql, pool, action);
	});
	return done;
}

/**
 * The last try failed. A card stays missing: its used-up tries keep it from coming due. A start
 * ping is marked done. A close goes through as a bare update, without the final card.
 */
function giveUp(sql: SqlStorage, pool: Pool, action: TimerAction): void {
	console.error(`pools: gave up the ${action} of pool ${pool.id}`);
	if (action === 'post-card') return;
	if (action === 'start-ping') markStartPinged(sql, pool.id, true);
	if (action === 'close') closeOpenPool(sql, pool.id, 'auto');
	clearTimerRetry(sql, pool.id);
}

/**
 * Tags the players, not the bench, once: the flag commits before the call, so an alarm firing
 * twice pings once. Nobody playing, or a start over 15 minutes ago, marks it done in silence.
 */
async function startPing(room: RoomAccess, pool: Pool, now: number): Promise<boolean> {
	const state = room.tx((sql) => {
		markStartPinged(sql, pool.id, true);
		return cardState(sql, pool.id);
	});
	const players = state?.lineup.players ?? [];
	if (!state || players.length === 0 || now - (pool.startsAt ?? now) > PING_LATE_MS) return true;
	const text = startPingText(pool.game, mentionsIn(state, players), players.length, pool.size);
	const sent = await postUnderCard(room, pool.id, pool.messageId, text);
	// Not sent: the flag goes back, so the retry pings.
	if (!sent) room.write((sql) => markStartPinged(sql, pool.id, false));
	return sent;
}
