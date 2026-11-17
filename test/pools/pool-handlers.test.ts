import type { User } from 'grammy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pooling } from '../../src/pools/pool-handlers';
import { type RoomSeams, type RoomStub, roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, command, textMessage, users } from '../helpers/updates';

// 16.11 at 18:00 in Kyiv, two hours ahead of UTC in winter.
const OPENED_AT = Date.UTC(2026, 10, 16, 16);
const HOUR = 60 * 60 * 1000;
const EVERYONE = [
	users.taras,
	users.oleg,
	users.andriy,
	users.ihor,
	users.maks,
	users.dima,
	users.sasha,
];

beforeEach(() => {
	const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
	return () => quiet.mockRestore();
});

/** A room where each of these people has written, so the bot knows them, a second after /pool. */
async function roomKnowing(people: User[], seams: RoomSeams = {}): Promise<RoomStub> {
	const stub = await roomWith([pooling], { clock: () => OPENED_AT + 1000, ...seams });
	for (const person of people) await stub.handleUpdate(textMessage('привіт', { from: person }));
	return stub;
}

function poolCommand(text: string, from: User = users.taras) {
	return command(text, { from, date: OPENED_AT / 1000 });
}

function link(user: User): string {
	return `<a href="tg://user?id=${user.id}">${user.first_name}</a>`;
}

const html = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };

function replyTo(messageId: unknown) {
	return {
		...html,
		reply_parameters: { message_id: messageId, allow_sending_without_reply: true },
	};
}

describe('/pool', () => {
	it('posts the card in reply, with the author playing, then tags everyone else under it', async () => {
		const stub = await roomKnowing(EVERYONE);
		const call = poolCommand('/pool cs2 21:00');

		await stub.handleUpdate(call);

		const [pool] = await rows(stub, 'SELECT id, message_id FROM pools');
		const { andriy, dima, ihor, maks, oleg, sasha } = users;
		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: [
					'🎮 cs2 · 5 місць · сьогодні о 21:00',
					'Автор: Тарас',
					'',
					'✅ Грають (1/5): Тарас',
					'⏳ Ще не відповіли: Андрій, Діма, Ігор, Макс, Олег, Саша',
				].join('\n'),
				...replyTo(call.message?.message_id),
				reply_markup: {
					inline_keyboard: [
						[
							{ text: '✅ Граю', callback_data: `p:${pool?.id}:in`, style: 'success' },
							{ text: '❌ Пас', callback_data: `p:${pool?.id}:out`, style: 'danger' },
						],
					],
				},
			},
			{
				chat_id: CHAT_ID,
				text: `📢 Тарас збирає cs2 на 21:00 — хто грає? ${[andriy, dima, ihor, maks, oleg].map(link).join(', ')}`,
				...replyTo(pool?.message_id),
			},
			{ chat_id: CHAT_ID, text: `📢 ${link(sasha)}`, ...replyTo(pool?.message_id) },
		]);
	});

	it('commits the pool, its author playing first and both events, all dated by the message', async () => {
		const stub = await roomKnowing([users.taras]);

		await stub.handleUpdate(poolCommand('/pool dota 4 21:00'));

		expect(
			await rows(stub, 'SELECT game, size, author_id, opened_at, starts_at, closes_at FROM pools'),
		).toEqual([
			{
				game: 'dota',
				size: 4,
				author_id: users.taras.id,
				opened_at: OPENED_AT,
				starts_at: OPENED_AT + 3 * HOUR,
				closes_at: OPENED_AT + 6 * HOUR,
			},
		]);
		expect(await rows(stub, 'SELECT user_id, choice, rank, answered_at FROM answers')).toEqual([
			{ user_id: users.taras.id, choice: 'play', rank: 1, answered_at: OPENED_AT },
		]);
		expect(await rows(stub, 'SELECT kind, user_id, pool_id, at FROM events ORDER BY id')).toEqual([
			{ kind: 'pool_open', user_id: users.taras.id, pool_id: 1, at: OPENED_AT },
			{ kind: 'join', user_id: users.taras.id, pool_id: 1, at: OPENED_AT },
		]);
	});

	it('records the card and every message under it as the pool’s', async () => {
		const stub = await roomKnowing(EVERYONE);

		await stub.handleUpdate(poolCommand('/pool'));

		const [pool] = await rows(stub, 'SELECT message_id FROM pools');
		const recorded = await rows(stub, 'SELECT message_id FROM pool_messages ORDER BY message_id');
		expect(recorded).toHaveLength(3);
		expect(recorded[0]).toEqual({ message_id: pool?.message_id });
	});

	it('opens a pool for now that closes three hours after it opened', async () => {
		const stub = await roomKnowing([users.taras]);

		await stub.handleUpdate(poolCommand('/pool'));

		expect(await rows(stub, 'SELECT game, size, starts_at, closes_at FROM pools')).toEqual([
			{ game: 'CS2', size: 5, starts_at: null, closes_at: OPENED_AT + 3 * HOUR },
		]);
		expect(telegram.callsTo('sendMessage').map((payload) => payload.text)).toEqual([
			['🎮 CS2 · 5 місць · зараз', 'Автор: Тарас', '', '✅ Грають (1/5): Тарас'].join('\n'),
			'📢 Тарас збирає CS2 зараз — хто грає?',
		]);
	});

	it('answers arguments it cannot read with the format, and opens nothing', async () => {
		const stub = await roomKnowing([users.taras]);
		const call = poolCommand('/pool cs2 25:00');

		await stub.handleUpdate(call);

		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: 'Не зрозумів «25:00». Час пиши як 21:00 або 21.00.',
				...replyTo(call.message?.message_id),
			},
		]);
		expect(await rows(stub, 'SELECT id FROM pools')).toEqual([]);
	});

	it('does nothing for a /pool that arrives more than 10 minutes late', async () => {
		const stub = await roomKnowing([users.taras], { clock: () => OPENED_AT + 11 * 60 * 1000 });

		await stub.handleUpdate(poolCommand('/pool'));

		expect(await rows(stub, 'SELECT id FROM pools')).toEqual([]);
		expect(telegram.callsTo('sendMessage')).toEqual([]);
	});

	it('keeps the pool open without a card when the card fails to send, and tags nobody', async () => {
		const stub = await roomKnowing(EVERYONE);
		telegram.fail('sendMessage', { status: 400, description: 'chat not found' });

		await stub.handleUpdate(poolCommand('/pool'));

		expect(await rows(stub, "SELECT message_id FROM pools WHERE status = 'open'")).toEqual([
			{ message_id: null },
		]);
		expect(telegram.callsTo('sendMessage')).toHaveLength(1);
		expect(await rows(stub, 'SELECT message_id FROM pool_messages')).toEqual([]);
	});
});
