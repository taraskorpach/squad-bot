import { reset, runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import type { Update } from 'grammy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ChatRoom, ROOM_NAME } from '../src/chat/chat-room';
import { WEBHOOK_PATH } from '../src/telegram';
import { telegram } from './helpers/telegram';
import { botAdded, botChange, migrationMessage, textMessage, users } from './helpers/updates';

const SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

interface Delivery {
	secret?: string | null;
	path?: string;
	method?: string;
}

function deliver(body: unknown, delivery: Delivery = {}): Promise<Response> {
	const { secret = env.WEBHOOK_SECRET, path = WEBHOOK_PATH, method = 'POST' } = delivery;
	return exports.default.fetch(
		new Request(`https://squad-bot.example.workers.dev${path}`, {
			method,
			headers: secret === null ? {} : { [SECRET_HEADER]: secret },
			body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
		}),
	);
}

/** The Worker always addresses this one object, so each test resets it first. */
function theRoom() {
	return env.CHAT_ROOM.getByName(ROOM_NAME);
}

function processedIds(): Promise<number[]> {
	return runInDurableObject(theRoom(), (_room, state) =>
		state.storage.sql
			.exec<{ update_id: number }>('SELECT update_id FROM processed_updates')
			.toArray()
			.map((row) => row.update_id),
	);
}

beforeEach(async () => {
	await reset();
});

describe('POST /webhook', () => {
	it('answers 404 for another path or method', async () => {
		expect((await deliver(textMessage('x'), { path: '/other' })).status).toBe(404);
		expect((await deliver(undefined, { method: 'GET' })).status).toBe(404);
	});

	it.each([
		['a missing secret', null],
		['a wrong secret of the same length', 'x'.repeat(env.WEBHOOK_SECRET.length)],
		['a wrong secret of another length', 'short'],
	])('answers 401 for %s', async (_case, secret) => {
		expect((await deliver(textMessage('x'), { secret })).status).toBe(401);
	});

	it.each([
		['text that is not JSON', 'not json'],
		['JSON that is not an update', 'null'],
		['an update without an id', '{"message":{}}'],
	])('answers 400 for %s', async (_case, body) => {
		expect((await deliver(body)).status).toBe(400);
	});

	it('answers 200 to an update without a chat, and the room never sees it', async () => {
		const update: Update = {
			update_id: 1,
			inline_query: { id: '1', from: users.taras, query: '', offset: '' },
		};

		expect((await deliver(update)).status).toBe(200);
		expect(await processedIds()).toEqual([]);
	});

	it('answers 200 to another chat, and the room never sees it', async () => {
		expect((await deliver(textMessage('привіт', { chatId: -100777 }))).status).toBe(200);

		expect(await processedIds()).toEqual([]);
		expect(telegram.calls()).toEqual([]);
	});

	it('routes the allowed chat to the one ChatRoom', async () => {
		const update = textMessage('привіт');

		expect((await deliver(update)).status).toBe(200);

		expect(await processedIds()).toEqual([update.update_id]);
	});

	it('answers 500 exactly when the room rejects the update, so Telegram redelivers it', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await runInDurableObject(theRoom(), (room: ChatRoom) => {
			room.features = [
				() => {
					throw new Error('not yet');
				},
			];
		});

		expect((await deliver(textMessage('привіт'))).status).toBe(500);
	});

	it('logs at error level that the allowed chat moved, and still routes it', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const update = migrationMessage(-1009876543210);

		expect((await deliver(update)).status).toBe(200);

		expect(logged).toHaveBeenCalledWith(expect.stringContaining('ALLOWED_CHAT_ID'));
		expect(await processedIds()).toEqual([update.update_id]);
	});
});

describe('a group that adds the bot', () => {
	it.each([
		['a supergroup', { id: -100777, type: 'supergroup', title: 'Чужі' }],
		['a basic group', { id: -777, type: 'group', title: 'Чужі' }],
	] as const)('is left when it is %s', async (_case, chat) => {
		expect((await deliver(botAdded({ chat }))).status).toBe(200);

		expect(telegram.callsTo('leaveChat')).toEqual([{ chat_id: chat.id }]);
	});

	it('is not left on a change that keeps the bot in the chat', async () => {
		const promoted = botChange({ from: 'member', to: 'administrator' }, { chatId: -100777 });

		expect((await deliver(promoted)).status).toBe(200);

		expect(telegram.callsTo('leaveChat')).toEqual([]);
	});

	it('is not the private chat of someone who started the bot', async () => {
		const chat = { id: users.taras.id, type: 'private', first_name: 'Тарас' } as const;

		expect((await deliver(botChange({ from: 'left', to: 'member' }, { chat }))).status).toBe(200);

		expect(telegram.callsTo('leaveChat')).toEqual([]);
	});

	it('still gets 200 when leaving fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		telegram.fail('leaveChat', { status: 400, description: 'chat not found' });

		expect((await deliver(botAdded({ chatId: -100777 }))).status).toBe(200);
	});

	it('is the allowed chat: the bot stays', async () => {
		expect((await deliver(botAdded())).status).toBe(200);

		expect(telegram.callsTo('leaveChat')).toEqual([]);
	});
});
