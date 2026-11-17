import type { User } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import { failureOf, type RoomStub, roomWith, rows } from '../helpers/rooms';
import {
	joinMessage,
	leaveMessage,
	memberChange,
	tap,
	textMessage,
	users,
} from '../helpers/updates';

function members(stub: RoomStub) {
	return rows(
		stub,
		'SELECT user_id, first_name, last_name, username, in_chat FROM members ORDER BY user_id',
	);
}

async function isInChat(stub: RoomStub, user: User): Promise<boolean> {
	const [row] = await rows(stub, `SELECT in_chat FROM members WHERE user_id = ${user.id}`);
	return row?.in_chat === 1;
}

describe('member learning', () => {
	it('saves everyone who writes or taps, with the names they have now', async () => {
		const stub = await roomWith([]);

		await stub.handleUpdate(textMessage('привіт', { from: users.andriy }));
		await stub.handleUpdate(tap('hi', { from: users.oleg }));
		await stub.handleUpdate(
			textMessage('тепер я Андрюха', { from: { ...users.andriy, first_name: 'Андрюха' } }),
		);

		expect(await members(stub)).toEqual([
			{ user_id: users.oleg.id, first_name: 'Олег', last_name: null, username: null, in_chat: 1 },
			{
				user_id: users.andriy.id,
				first_name: 'Андрюха',
				last_name: 'Коваль',
				username: null,
				in_chat: 1,
			},
		]);
	});

	it('remembers when it last heard of each member', async () => {
		const now = Date.now();
		const stub = await roomWith([], { clock: () => now });

		await stub.handleUpdate(textMessage('привіт', { from: users.oleg }));

		expect(await rows(stub, 'SELECT seen_at FROM members')).toEqual([{ seen_at: now }]);
	});

	it.each([
		['the chat_member update first', ['change', 'message']],
		['the service message first', ['message', 'change']],
	] as const)('marks a leaver out whichever arrives first: %s', async (_case, order) => {
		const stub = await roomWith([]);
		await stub.handleUpdate(textMessage('бувайте', { from: users.oleg }));
		const leaving = {
			change: memberChange(users.oleg, { from: 'member', to: 'left' }),
			message: leaveMessage(users.oleg),
		};

		for (const arrival of order) await stub.handleUpdate(leaving[arrival]);

		expect(await isInChat(stub, users.oleg)).toBe(false);
	});

	it.each([
		['the chat_member update first', ['change', 'message']],
		['the service message first', ['message', 'change']],
	] as const)(
		'marks someone who comes back in whichever arrives first: %s',
		async (_case, order) => {
			const stub = await roomWith([]);
			await stub.handleUpdate(memberChange(users.oleg, { from: 'member', to: 'left' }));
			const returning = {
				change: memberChange(users.oleg, { from: 'left', to: 'member' }),
				message: joinMessage([users.oleg]),
			};

			for (const arrival of order) await stub.handleUpdate(returning[arrival]);

			expect(await isInChat(stub, users.oleg)).toBe(true);
		},
	);

	it('is no commit: an update that fails after it is still redelivered', async () => {
		const stub = await roomWith([
			() => {
				throw new Error('a feature failed');
			},
		]);

		const failure = await failureOf(stub.handleUpdate(textMessage('привіт', { from: users.oleg })));

		expect(failure).toContain('a feature failed');
		expect(await isInChat(stub, users.oleg)).toBe(true);
	});
});
