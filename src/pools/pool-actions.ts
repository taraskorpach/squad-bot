// What happens to a pool, for handlers and the alarm alike: written against a room, never a
// grammY context. Each action decides and writes first, then calls Telegram, each call on its own.
import { attempt } from '../chat/attempt';
import type { RoomAccess } from '../chat/room';
import { membersById, membersInChat } from '../members/member-store';
import { displayNames, mentionsOf } from '../members/mentions';
import type { Member } from '../members/roster';
import { recordEvent } from '../stats/event-store';
import { MESSAGE_FORMAT, replyingTo } from '../telegram';
import { renderCard } from './pool-format';
import { openingMessages, openingWhen } from './pool-messages';
import { answer, closingTime, type Lineup, lineupOf } from './pool-rules';
import {
	answersOf,
	insertPool,
	type Pool,
	poolById,
	saveAnswer,
	saveCard,
	savePoolMessage,
} from './pool-store';

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

/** What a card shows: the pool, its lineup, and the names of everyone on it. */
export interface CardState {
	pool: Pool;
	lineup: Lineup;
	names: Map<number, string>;
	inChat: Member[];
}

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
 * Posts the card, then the opening tag messages under it, and records them all as the pool's.
 * A card that doesn't go out leaves the pool without one: edits skip it, and the alarm posts it.
 */
export async function postCard(room: RoomAccess, poolId: number, replyTo?: number): Promise<void> {
	const state = room.read((sql) => cardState(sql, poolId));
	if (!state) return;
	const card = renderCard(state.pool, state.lineup, state.names, room.clock());
	const format = replyTo === undefined ? MESSAGE_FORMAT : replyingTo(replyTo);
	const sent = await attempt('pools: the card', () =>
		room.api.sendMessage(room.chatId, card.text, { ...format, reply_markup: card.keyboard }),
	);
	if (!sent) return;
	room.write((sql) => saveCard(sql, poolId, sent.message_id, JSON.stringify(card)));
	await postOpening(room, state, sent.message_id);
}

export function cardState(sql: SqlStorage, poolId: number): CardState | undefined {
	const pool = poolById(sql, poolId);
	if (!pool) return undefined;
	const answers = answersOf(sql, poolId);
	const inChat = membersInChat(sql);
	const inChatIds = inChat.map((member) => member.id);
	const leavers = membersById(
		sql,
		answers.map((given) => given.userId).filter((id) => !inChatIds.includes(id)),
	);
	return {
		pool,
		lineup: lineupOf(pool.size, answers, inChatIds),
		names: displayNames([...inChat, ...leavers]),
		inChat,
	};
}

async function postOpening(room: RoomAccess, state: CardState, cardId: number): Promise<void> {
	const { pool, names, inChat } = state;
	const others = inChat.filter((member) => member.id !== pool.authorId);
	const messages = openingMessages(
		names.get(pool.authorId) ?? '',
		pool.game,
		openingWhen(pool.startsAt, pool.openedAt),
		mentionsOf(others, inChat),
		room.mentionChunk,
	);
	for (const text of messages) {
		const sent = await attempt('pools: a tag message', () =>
			room.api.sendMessage(room.chatId, text, replyingTo(cardId)),
		);
		if (sent) room.write((sql) => savePoolMessage(sql, pool.id, sent.message_id));
	}
}
