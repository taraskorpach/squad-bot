import { env } from 'cloudflare:workers';
import { Composer, HttpError, type Middleware } from 'grammy';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBot } from '../src/bot';
import type { BotContext } from '../src/context';
import { roomWith } from './helpers/rooms';
import { network, telegram } from './helpers/telegram';
import { BOT, CHANNEL, CHAT_ID, command, tap, textMessage, users } from './helpers/updates';

const MINUTE = 60 * 1000;

beforeEach(() => {
	const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
	return () => quiet.mockRestore();
});

const sending: Middleware<BotContext> = async (ctx, next) => {
	await ctx.api.sendMessage(CHAT_ID, 'відповідь');
	await next();
};

describe('the bot inside the object', () => {
	it('knows itself from BOT_INFO, without asking Telegram', async () => {
		const stub = await roomWith([sending]);

		await stub.handleUpdate(command('/ping'));

		expect(telegram.callsTo('getMe')).toEqual([]);
	});

	it('retries a rate-limited call at most twice', async () => {
		telegram.fail('sendMessage', { status: 429, retryAfter: 0 }, 3);
		const stub = await roomWith([sending]);

		await expect(stub.handleUpdate(textMessage('x'))).rejects.toThrow();

		expect(telegram.callsTo('sendMessage')).toHaveLength(3);
	});

	it('counts a call that succeeded on a retry as delivered', async () => {
		telegram.fail('sendMessage', { status: 429, retryAfter: 0 });
		const stub = await roomWith([
			sending,
			() => {
				throw new Error('after the send');
			},
		]);

		await expect(stub.handleUpdate(textMessage('x'))).resolves.toBeUndefined();

		expect(telegram.callsTo('sendMessage')).toHaveLength(2);
	});

	it.each([
		['a retry_after above 5 s', { status: 429, retryAfter: 6 }],
		['a Telegram server error', { status: 500 }],
		['a network error', { status: 'network' }],
	] as const)('does not retry %s', async (_case, failure) => {
		telegram.fail('sendMessage', failure);
		const stub = await roomWith([sending]);

		await expect(stub.handleUpdate(textMessage('x'))).rejects.toThrow();

		expect(telegram.callsTo('sendMessage')).toHaveLength(1);
	});
});

describe('the gate before the features', () => {
	function seeing(seen: number[]): Middleware<BotContext> {
		return (ctx) => {
			seen.push(ctx.update.update_id);
		};
	}

	it('ignores messages from bots, anonymous admins and channel identities', async () => {
		const seen: number[] = [];
		const stub = await roomWith([seeing(seen)]);
		const fromPerson = textMessage('я людина');

		await stub.handleUpdate(textMessage('я бот', { from: users.otherBot }));
		await stub.handleUpdate(textMessage('я канал', { senderChat: CHANNEL }));
		await stub.handleUpdate(fromPerson);

		expect(seen).toEqual([fromPerson.update_id]);
	});

	it('ignores taps by bots', async () => {
		const seen: number[] = [];
		const stub = await roomWith([seeing(seen)]);

		await stub.handleUpdate(tap('p:1:in', { from: users.otherBot }));

		expect(seen).toEqual([]);
	});

	it('flags a message that arrived over 10 minutes late as stale', async () => {
		const now = Date.now();
		const stale: boolean[] = [];
		const stub = await roomWith(
			[
				(ctx) => {
					stale.push(ctx.room.stale);
				},
			],
			{ clock: () => now },
		);
		const sentAt = (msAgo: number) => Math.floor((now - msAgo) / 1000);

		await stub.handleUpdate(textMessage('свіже', { date: sentAt(9 * MINUTE) }));
		await stub.handleUpdate(textMessage('застаріле', { date: sentAt(11 * MINUTE) }));

		expect(stale).toEqual([false, true]);
	});

	it('answers /cmd and /cmd@ourbot, and leaves /cmd@otherbot to that bot', async () => {
		const answered: string[] = [];
		// The feature is the composer itself: `.command()` returns the branch behind the filter.
		const pinging = new Composer<BotContext>();
		pinging.command('ping', (ctx) => {
			answered.push(ctx.message?.text ?? '');
		});
		const stub = await roomWith([pinging]);

		await stub.handleUpdate(command('/ping'));
		await stub.handleUpdate(command(`/ping@${BOT.username}`));
		await stub.handleUpdate(command('/ping@other_bot'));

		expect(answered).toEqual(['/ping', `/ping@${BOT.username}`]);
	});
});

describe('the Telegram client', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('gives up on a call Telegram never answers after 10 seconds', async () => {
		network.use(
			http.post('https://api.telegram.org/bot:token/sendMessage', () => new Promise(() => {})),
		);
		vi.useFakeTimers();
		const bot = createBot({
			token: env.BOT_TOKEN,
			botInfo: BOT,
			features: [],
			currentRoom: () => {
				throw new Error('no update in this test');
			},
			onDelivered: () => {},
		});

		const outcome = bot.api.sendMessage(CHAT_ID, 'x').then(
			() => 'answered',
			(error: unknown) => error,
		);
		const settled = () => Promise.race([outcome, Promise.resolve('still waiting')]);

		await vi.advanceTimersByTimeAsync(9_999);
		expect(await settled()).toBe('still waiting');

		await vi.advanceTimersByTimeAsync(1);
		const error = await settled();
		expect(error).toBeInstanceOf(HttpError);
		expect(String((error as HttpError).error)).toContain('timed out after 10 seconds');
	});
});
