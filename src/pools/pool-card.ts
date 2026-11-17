// A pool's card and the messages under it: posting, editing and recording them. Written against
// a room, so the alarm can post a card too.
import { GrammyError } from 'grammy';
import { attempt } from '../chat/attempt';
import type { RoomAccess } from '../chat/room';
import { membersById, membersInChat } from '../members/member-store';
import { displayNames, mentionsOf } from '../members/mentions';
import type { Member } from '../members/roster';
import { MESSAGE_FORMAT, replyingTo } from '../telegram';
import { answersOf } from './answer-store';
import { type Card, renderCard } from './pool-format';
import { openingMessages, openingWhen } from './pool-messages';
import { type Lineup, lineupOf } from './pool-rules';
import { type Pool, poolById, saveCard, saveCardRender, savePoolMessage } from './pool-store';

/** What a card shows: the pool, its lineup, and everyone on it, leavers included. */
export interface CardState {
	pool: Pool;
	lineup: Lineup;
	people: Map<number, Member>;
	names: Map<number, string>;
	inChat: Member[];
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
	const everyone = [...inChat, ...leavers];
	return {
		pool,
		lineup: lineupOf(pool.size, answers, inChatIds),
		people: new Map(everyone.map((member) => [member.id, member])),
		names: displayNames(everyone),
		inChat,
	};
}

/** Mentions of these people, in name order, named as the chat tells them apart. */
export function mentionsIn(state: CardState, ids: readonly number[]): string[] {
	const targets = ids.flatMap((id) => state.people.get(id) ?? []);
	return mentionsOf(targets, state.inChat);
}

/**
 * Posts the card, then the opening tag messages under it, and records them all as the pool's.
 * A card that doesn't go out leaves the pool without one: edits skip it, and the alarm posts it.
 * True once the card went out.
 */
export async function postCard(
	room: RoomAccess,
	poolId: number,
	replyTo?: number,
): Promise<boolean> {
	const state = room.read((sql) => cardState(sql, poolId));
	if (!state) return true;
	const card = renderCard(state.pool, state.lineup, state.names, room.clock());
	const format = replyTo === undefined ? MESSAGE_FORMAT : replyingTo(replyTo);
	const sent = await attempt('pools: the card', () =>
		room.api.sendMessage(room.chatId, card.text, { ...format, reply_markup: card.keyboard }),
	);
	if (!sent) return false;
	room.write((sql) => saveCard(sql, poolId, sent.message_id, JSON.stringify(card)));
	const { pool, names, inChat } = state;
	const others = inChat.filter((member) => member.id !== pool.authorId).map(({ id }) => id);
	const opening = openingMessages(
		names.get(pool.authorId) ?? '',
		pool.game,
		openingWhen(pool.startsAt, pool.openedAt),
		mentionsIn(state, others),
		room.mentionChunk,
	);
	for (const text of opening) await postUnderCard(room, poolId, sent.message_id, text);
	return true;
}

/**
 * Edits the card when its render changed. `card_render` is written only once Telegram accepts,
 * so a failed edit is tried again by the next render; "message is not modified" counts.
 */
export async function refreshCard(room: RoomAccess, poolId: number): Promise<void> {
	const state = room.read((sql) => cardState(sql, poolId));
	const messageId = state?.pool.messageId;
	if (!state || messageId === undefined) return;
	const card = renderCard(state.pool, state.lineup, state.names, room.clock());
	const render = JSON.stringify(card);
	if (render === state.pool.cardRender) return;
	const accepted = await attempt('pools: the card edit', () => editCard(room, messageId, card));
	if (accepted) room.write((sql) => saveCardRender(sql, poolId, render));
}

/** A message under the card, replying to it once there is one, recorded as the pool's. */
export async function postUnderCard(
	room: RoomAccess,
	poolId: number,
	cardId: number | undefined,
	text: string,
): Promise<boolean> {
	const format = cardId === undefined ? MESSAGE_FORMAT : replyingTo(cardId);
	const sent = await attempt('pools: a message under the card', () =>
		room.api.sendMessage(room.chatId, text, format),
	);
	if (sent) room.write((sql) => savePoolMessage(sql, poolId, sent.message_id));
	return sent !== undefined;
}

async function editCard(room: RoomAccess, messageId: number, card: Card): Promise<true> {
	try {
		await room.api.editMessageText(room.chatId, messageId, card.text, {
			...MESSAGE_FORMAT,
			reply_markup: card.keyboard,
		});
	} catch (error) {
		if (!(error instanceof GrammyError && error.description.includes('message is not modified'))) {
			throw error;
		}
	}
	return true;
}
