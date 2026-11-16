import type { Update, User } from 'grammy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tagAll } from '../../src/members/all-handlers';
import { failureOf, type RoomSeams, type RoomStub, roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, command, memberChange, textMessage, users } from '../helpers/updates';

const MINUTE = 60 * 1000;
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

/** A room where each of these people has written, so the bot knows them. */
async function roomKnowing(people: User[], seams: RoomSeams = {}): Promise<RoomStub> {
	const stub = await roomWith([tagAll], seams);
	for (const person of people) await stub.handleUpdate(textMessage('привіт', { from: person }));
	return stub;
}

function link(user: User): string {
	return `<a href="tg://user?id=${user.id}">${user.first_name}</a>`;
}

function replyTo(call: Update) {
	return {
		parse_mode: 'HTML',
		link_preview_options: { is_disabled: true },
		reply_parameters: { message_id: call.message?.message_id, allow_sending_without_reply: true },
	};
}

function sentTexts(): unknown[] {
	return telegram.callsTo('sendMessage').map((payload) => payload.text);
}

function countedCalls(stub: RoomStub) {
	return rows(stub, "SELECT user_id, at FROM events WHERE kind = 'all' ORDER BY id");
}

describe('/all', () => {
	it('tags everyone in the chat but the caller, five mentions to a reply', async () => {
		const stub = await roomKnowing(EVERYONE);
		const call = command('/all', { from: users.taras });

		await stub.handleUpdate(call);

		const { andriy, dima, ihor, maks, oleg, sasha } = users;
		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: `📢 ${[andriy, dima, ihor, maks, oleg].map(link).join(', ')}`,
				...replyTo(call),
			},
			{ chat_id: CHAT_ID, text: `📢 ${link(sasha)}`, ...replyTo(call) },
		]);
	});

	it('says so when nobody else is known yet', async () => {
		const stub = await roomKnowing([]);
		const call = command('/all', { from: users.taras });

		await stub.handleUpdate(call);

		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: 'Поки нікого тегати — хай усі напишуть щось у чат.',
				...replyTo(call),
			},
		]);
	});

	it('leaves out the people who left', async () => {
		const stub = await roomKnowing([users.taras, users.oleg, users.andriy]);
		await stub.handleUpdate(memberChange(users.oleg, { from: 'member', to: 'left' }));

		await stub.handleUpdate(command('/all', { from: users.taras }));

		expect(sentTexts()).toEqual([`📢 ${link(users.andriy)}`]);
	});

	it('counts every call, and inside 30 s answers a repeat with 👌 instead of tagging', async () => {
		let now = Date.now();
		const stub = await roomKnowing(EVERYONE, { clock: () => now });
		await stub.handleUpdate(command('/all', { from: users.taras }));
		now += 29_000;
		const repeat = command('/all', { from: users.oleg });

		await stub.handleUpdate(repeat);

		expect(telegram.callsTo('sendMessage')).toHaveLength(2);
		expect(telegram.callsTo('setMessageReaction')).toEqual([
			{
				chat_id: CHAT_ID,
				message_id: repeat.message?.message_id,
				reaction: [{ type: 'emoji', emoji: '👌' }],
			},
		]);
		expect((await countedCalls(stub)).map((row) => row.user_id)).toEqual([
			users.taras.id,
			users.oleg.id,
		]);
	});

	it('tags again once 30 s have passed since it last did', async () => {
		let now = Date.now();
		const stub = await roomKnowing(EVERYONE, { clock: () => now });
		await stub.handleUpdate(command('/all', { from: users.taras }));
		now += 30_000;

		await stub.handleUpdate(command('/all', { from: users.oleg }));

		expect(telegram.callsTo('sendMessage')).toHaveLength(4);
		expect(telegram.callsTo('setMessageReaction')).toEqual([]);
	});

	it('only counts a call that reached it over 10 minutes late, at the time it was made', async () => {
		const now = Date.now();
		const stub = await roomKnowing(EVERYONE, { clock: () => now });
		const late = command('/all', {
			from: users.taras,
			date: Math.floor((now - 11 * MINUTE) / 1000),
		});

		await stub.handleUpdate(late);

		expect(telegram.calls()).toEqual([]);
		expect(await countedCalls(stub)).toEqual([
			{ user_id: users.taras.id, at: (late.message?.date ?? 0) * 1000 },
		]);
	});

	it('counts and tags a redelivered call once', async () => {
		const stub = await roomKnowing(EVERYONE);
		const call = command('/all', { from: users.taras });

		await stub.handleUpdate(call);
		await stub.handleUpdate(call);

		expect(await countedCalls(stub)).toHaveLength(1);
		expect(telegram.callsTo('sendMessage')).toHaveLength(2);
	});

	it('still sends the next reply when Telegram refuses one, and the call is acknowledged', async () => {
		const stub = await roomKnowing(EVERYONE);
		telegram.fail('sendMessage', { status: 400, description: 'message is too long' });

		expect(
			await failureOf(stub.handleUpdate(command('/all', { from: users.taras }))),
		).toBeUndefined();

		expect(telegram.callsTo('sendMessage')).toHaveLength(2);
		expect(await countedCalls(stub)).toHaveLength(1);
	});
});
