// What happens to a pool, for handlers and the alarm alike: written against a room, never a
// grammY context. Each action decides and writes first, then calls Telegram, each call on its own.
import type { RoomAccess } from '../chat/room';
import { recordEvent } from '../stats/event-store';
import { cardState, mentionsIn, postCard, postUnderCard, refreshCard } from './pool-card';
import { movedUpText, squadCompleteText } from './pool-messages';
import { type AnswerDecision, answer, type Choice, closingTime } from './pool-rules';
import { answersOf, insertPool, markSquadAnnounced, poolById, saveAnswer } from './pool-store';

export interface PoolRequest {
	game: string;
	size: number;
	authorId: number;
	/** When the author sent /pool: the pool and its events are dated by it. */
	openedAt: number;
	startsAt?: number;
	/** The /pool message, which the card replies to. */
	commandId: number;
}

export type AnswerResult =
	| { kind: 'answered'; decision: AnswerDecision }
	| { kind: 'closed' }
	| { kind: 'missing' };

/** Opens a pool with its author playing, in one commit, then posts its card and tags everyone. */
export async function openPool(room: RoomAccess, request: PoolRequest): Promise<void> {
	const { game, size, authorId, openedAt, startsAt } = request;
	const poolId = room.tx((sql) => {
		const closesAt = closingTime(openedAt, startsAt);
		const id = insertPool(sql, { game, size, authorId, openedAt, startsAt, closesAt });
		const { write } = answer({ size, squadAnnounced: false }, [], authorId, 'play', openedAt);
		if (write) saveAnswer(sql, id, write);
		recordEvent(sql, { kind: 'pool_open', userId: authorId, poolId: id, at: openedAt });
		recordEvent(sql, { kind: 'join', userId: authorId, poolId: id, at: openedAt });
		return id;
	});
	await postCard(room, poolId, request.commandId);
}

/**
 * Commits a Граю or Пас with its event, dated `at`. In the same commit, the first time the squad
 * fills, its flag is set, so the announcement goes out once whatever happens after.
 */
export function applyAnswer(
	room: RoomAccess,
	poolId: number,
	userId: number,
	choice: Choice,
	at: number,
): AnswerResult {
	return room.tx((sql): AnswerResult => {
		const pool = poolById(sql, poolId);
		if (!pool) return { kind: 'missing' };
		if (pool.status === 'closed') return { kind: 'closed' };
		const decision = answer(pool, answersOf(sql, poolId), userId, choice, at);
		if (decision.write) {
			saveAnswer(sql, poolId, decision.write);
			recordEvent(sql, { kind: choice === 'play' ? 'join' : 'pass', userId, poolId, at });
		}
		if (decision.squadCompleted) markSquadAnnounced(sql, poolId);
		return { kind: 'answered', decision };
	});
}

/** An answer, shown: the card first, then the complete squad's message, then each move-up. */
export async function showAnswer(
	room: RoomAccess,
	poolId: number,
	decision: AnswerDecision,
): Promise<void> {
	await refreshCard(room, poolId);
	const state = room.read((sql) => cardState(sql, poolId));
	if (!state) return;
	const { pool, lineup } = state;
	if (decision.squadCompleted) {
		const mentions = mentionsIn(state, lineup.players);
		const text = squadCompleteText(pool.game, mentions, pool.startsAt, room.clock());
		await postUnderCard(room, poolId, pool.messageId, text);
	}
	for (const userId of decision.movedUp) {
		const [mention = ''] = mentionsIn(state, [userId]);
		await postUnderCard(room, poolId, pool.messageId, movedUpText(mention, pool.game));
	}
}
