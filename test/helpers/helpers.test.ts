import { env } from 'cloudflare:workers';
import { Api, Bot, GrammyError, HttpError } from 'grammy';
import { describe, expect, it } from 'vitest';
import { telegram } from './telegram';
import { BOT, botAdded, CHAT_ID, command, memberChange, tap, textMessage, users } from './updates';

describe('the Telegram fake', () => {
	it('records each call with its method and payload', async () => {
		const api = new Api(env.BOT_TOKEN);

		await api.sendMessage(CHAT_ID, 'привіт');

		expect(telegram.calls()).toEqual([
			{ method: 'sendMessage', payload: { chat_id: CHAT_ID, text: 'привіт' } },
		]);
	});

	it('answers sendMessage with increasing message ids', async () => {
		const api = new Api(env.BOT_TOKEN);

		const first = await api.sendMessage(CHAT_ID, 'один');
		const second = await api.sendMessage(CHAT_ID, 'два');

		expect(second.message_id).toBeGreaterThan(first.message_id);
		expect(first).toMatchObject({ chat: { id: CHAT_ID }, from: { id: BOT.id }, text: 'один' });
	});

	it('answers other methods with true', async () => {
		await expect(new Api(env.BOT_TOKEN).leaveChat(-100500)).resolves.toBe(true);
	});

	it.each([
		{ failure: { status: 429, retryAfter: 7 }, code: 429, retryAfter: 7 },
		{ failure: { status: 500 }, code: 500, retryAfter: undefined },
		{ failure: { status: 400 }, code: 400, retryAfter: undefined },
	] as const)('fails a call with $code when asked', async ({ failure, code, retryAfter }) => {
		telegram.fail('sendMessage', failure);

		const error = await new Api(env.BOT_TOKEN).sendMessage(CHAT_ID, 'x').catch((e: unknown) => e);

		expect(error).toBeInstanceOf(GrammyError);
		expect((error as GrammyError).error_code).toBe(code);
		expect((error as GrammyError).parameters.retry_after).toBe(retryAfter);
	});

	it('drops the connection when asked, as a network failure would', async () => {
		telegram.fail('sendMessage', { status: 'network' });

		await expect(new Api(env.BOT_TOKEN).sendMessage(CHAT_ID, 'x')).rejects.toThrow(HttpError);
		expect(telegram.callsTo('sendMessage')).toHaveLength(1);
	});

	it('fails only as many calls as asked, and records the failed ones', async () => {
		const api = new Api(env.BOT_TOKEN);
		telegram.fail('sendMessage', { status: 500 }, 2);

		await expect(api.sendMessage(CHAT_ID, '1')).rejects.toThrow(GrammyError);
		await expect(api.sendMessage(CHAT_ID, '2')).rejects.toThrow(GrammyError);
		await expect(api.sendMessage(CHAT_ID, '3')).resolves.toMatchObject({ text: '3' });

		expect(telegram.callsTo('sendMessage')).toHaveLength(3);
	});

	it('starts every test with no calls recorded', () => {
		expect(telegram.calls()).toEqual([]);
	});

	it('refuses a request nobody faked', async () => {
		await expect(fetch('https://example.com/')).rejects.toThrow(/Cannot bypass a request/);
	});
});

describe('the update builders', () => {
	it('give every update and message its own increasing id', () => {
		const first = textMessage('a');
		const second = textMessage('b');

		expect(second.update_id).toBeGreaterThan(first.update_id);
		expect(second.message?.message_id).toBeGreaterThan(first.message?.message_id ?? 0);
	});

	it('mark a command with its bot_command entity', () => {
		expect(command('/ping@squad_test_bot now').message?.entities).toEqual([
			{ type: 'bot_command', offset: 0, length: '/ping@squad_test_bot'.length },
		]);
	});

	it('build updates grammY routes like the real ones', async () => {
		const bot = new Bot(env.BOT_TOKEN, { botInfo: BOT });
		const seen: string[] = [];
		bot.command('ping', (ctx) => {
			seen.push(`command from ${ctx.from?.first_name} in ${ctx.chatId}`);
		});
		bot.callbackQuery('hi', (ctx) => {
			seen.push(`tap by ${ctx.from.first_name} on ${ctx.msg?.message_id}`);
		});
		bot.on('my_chat_member', (ctx) => {
			seen.push(`bot is ${ctx.myChatMember.new_chat_member.status} in ${ctx.chatId}`);
		});
		bot.on('chat_member', (ctx) => {
			seen.push(
				`${ctx.chatMember.new_chat_member.user.first_name} is ${ctx.chatMember.new_chat_member.status}`,
			);
		});

		await bot.handleUpdate(command('/ping', { from: users.oleg }));
		await bot.handleUpdate(tap('hi', { from: users.taras, messageId: 42 }));
		await bot.handleUpdate(botAdded({ chatId: -100777 }));
		await bot.handleUpdate(memberChange(users.oleg, { from: 'left', to: 'member' }));

		expect(seen).toEqual([
			`command from Олег in ${CHAT_ID}`,
			'tap by Тарас on 42',
			'bot is administrator in -100777',
			'Олег is member',
		]);
	});
});
