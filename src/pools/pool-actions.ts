// What happens to a pool, for handlers and the alarm alike: written against a room, never a
// grammY context. Each action decides and writes first, then calls Telegram, each call on its own.
import type { RoomAccess } from '../chat/room';
import { recordEvent } from '../stats/event-store';
import { answersOf, saveAnswer, saveDraw } from './answer-store';
import { cardState, mentionsIn, postCard, postUnderCard, refreshCard } from './pool-card';
import { closedByAuthorText, drawText, movedUpText, squadCompleteText } from './pool-messages';
import {
	type AnswerDecision,
	answer,
	type Choice,
	closingTime,
	type DrawRefusal,
	draw,
	drawRefusal,
	lineupOf,
} from './pool-rules';
import { closeOpenPool, insertPool, markSquadAnnounced, poolById } from './pool-store';

export interface PoolRequest {
	game: string;
	/** None for a pool without a seat limit. */
	size?: number;
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

export type DrawOutcome =
	| { kind: 'drawn'; squad: number[]; bench: number[] }
	| { kind: 'refused'; refusal: DrawRefusal }
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
	// The card is still to be posted, so the alarm is due at once: if the send dies, it posts it.
	room.arm();
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

/** 🎲: picks the squad once and renumbers the line, in one commit, checked as stored. */
export function commitDraw(room: RoomAccess, poolId: number, userId: number): DrawOutcome {
	return room.tx((sql): DrawOutcome => {
		const pool = poolById(sql, poolId);
		if (!pool) return { kind: 'missing' };
		if (pool.status === 'closed') return { kind: 'closed' };
		const answers = answersOf(sql, poolId);
		const refusal = drawRefusal(pool.drawn, lineupOf(pool.size, answers, []), userId);
		if (refusal) return { kind: 'refused', refusal };
		const result = draw(pool.size, answers, () => room.random());
		saveDraw(sql, poolId, result.answers);
		return { kind: 'drawn', squad: result.squad, bench: result.bench };
	});
}

/** The draw, shown: the card notes it, then the whole squad and bench are tagged under it. */
export async function showDraw(
	room: RoomAccess,
	poolId: number,
	squad: readonly number[],
	bench: readonly number[],
): Promise<void> {
	await refreshCard(room, poolId);
	const state = room.read((sql) => cardState(sql, poolId));
	if (!state) return;
	const text = drawText(mentionsIn(state, squad), mentionsIn(state, bench));
	await postUnderCard(room, poolId, state.pool.messageId, text);
}

/** Closes a pool that is still open; false when it already was. */
export function commitClose(room: RoomAccess, poolId: number, by: 'auto' | 'author'): boolean {
	const closed = room.tx((sql) => closeOpenPool(sql, poolId, by));
	if (closed) room.arm();
	return closed;
}

/** The close, shown: the card turns final; the author's close tags the others who said Граю. */
export async function showClose(room: RoomAccess, poolId: number): Promise<void> {
	await refreshCard(room, poolId);
	const state = room.read((sql) => cardState(sql, poolId));
	if (state?.pool.closedBy !== 'author') return;
	const { pool, lineup } = state;
	const others = [...lineup.players, ...lineup.bench].filter((id) => id !== pool.authorId);
	if (others.length === 0) return;
	const text = closedByAuthorText(pool.game, pool.startsAt, mentionsIn(state, others));
	await postUnderCard(room, poolId, pool.messageId, text);
}

/** The one way a pool closes: the author's ✖️ now, and its three hours from phase 8's alarm. */
export async function closePool(
	room: RoomAccess,
	poolId: number,
	by: 'auto' | 'author',
): Promise<boolean> {
	if (!commitClose(room, poolId, by)) return false;
	await showClose(room, poolId);
	return true;
}
