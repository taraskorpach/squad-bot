import type { Middleware } from 'grammy';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import type { BotContext } from '../../src/context';
import { failureOf, noting, roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, textMessage } from '../helpers/updates';

const MINUTE = 60 * 1000;

let logged: MockInstance;

beforeEach(() => {
	logged = vi.spyOn(console, 'error').mockImplementation(() => {});
	return () => logged.mockRestore();
});

/** Sends one message, then passes the update on. */
const sending: Middleware<BotContext> = async (ctx, next) => {
	await ctx.api.sendMessage(CHAT_ID, 'відповідь');
	await next();
};

describe('a failed update', () => {
	it('is redelivered when nothing was committed or sent', async () => {
		const stub = await roomWith([
			() => {
				throw new Error('boom');
			},
		]);

		expect(await failureOf(stub.handleUpdate(textMessage('x')))).toContain('boom');
	});

	it('is acknowledged after a commit: the change stays, the error is logged', async () => {
		let runs = 0;
		const stub = await roomWith([
			(_ctx, next) => {
				runs++;
				return next();
			},
			noting,
			() => {
				throw new Error('after the commit');
			},
		]);
		const update = textMessage('x');

		expect(await failureOf(stub.handleUpdate(update))).toBeUndefined();
		await stub.handleUpdate(update);

		expect(runs).toBe(1);
		expect(await rows(stub, 'SELECT update_id FROM notes')).toEqual([
			{ update_id: update.update_id },
		]);
		expect(logged).toHaveBeenCalledWith(
			expect.stringContaining(`Update ${update.update_id}`),
			expect.objectContaining({ message: 'after the commit' }),
		);
	});

	it('is acknowledged after a message reached Telegram, so it is never sent twice', async () => {
		const stub = await roomWith([
			sending,
			() => {
				throw new Error('after the send');
			},
		]);
		const update = textMessage('x');

		expect(await failureOf(stub.handleUpdate(update))).toBeUndefined();
		await stub.handleUpdate(update);

		expect(telegram.callsTo('sendMessage')).toHaveLength(1);
	});

	it('is acknowledged at once after a permanent Telegram error', async () => {
		telegram.fail('sendMessage', { status: 400 });
		const stub = await roomWith([sending]);

		expect(await failureOf(stub.handleUpdate(textMessage('x')))).toBeUndefined();
	});

	it('is redelivered after a Telegram server error, when nothing was sent before it', async () => {
		telegram.fail('sendMessage', { status: 500 });
		const stub = await roomWith([sending]);

		expect(await failureOf(stub.handleUpdate(textMessage('x')))).toBeDefined();
	});

	it('is counted in its own transaction, after its commit rolled back', async () => {
		const stub = await roomWith([
			(ctx) => {
				ctx.room.commit((sql) => {
					sql.exec('INSERT INTO notes (update_id, text) VALUES (?, ?)', ctx.update.update_id, 'x');
					throw new Error('mid-commit');
				});
			},
		]);
		const update = textMessage('x');

		expect(await failureOf(stub.handleUpdate(update))).toContain('mid-commit');

		expect(await rows(stub, 'SELECT * FROM notes')).toEqual([]);
		expect(await rows(stub, 'SELECT update_id, attempts FROM failed_updates')).toEqual([
			{ update_id: update.update_id, attempts: 1 },
		]);
	});

	it('stops being redelivered once it has failed 3 times over 5 minutes', async () => {
		let now = Date.now();
		const stuck = textMessage('зламане');
		const stub = await roomWith(
			[
				(ctx, next) => {
					if (ctx.update.update_id === stuck.update_id) throw new Error('always fails');
					return next();
				},
				noting,
			],
			{ clock: () => now },
		);

		expect(await failureOf(stub.handleUpdate(stuck))).toBeDefined();
		now += MINUTE;
		expect(await failureOf(stub.handleUpdate(stuck))).toBeDefined();
		now += MINUTE;
		expect(await failureOf(stub.handleUpdate(stuck))).toBeDefined();
		now += 3 * MINUTE;
		expect(await failureOf(stub.handleUpdate(stuck))).toBeUndefined();

		const next = textMessage('наступне');
		await stub.handleUpdate(next);

		expect(await rows(stub, 'SELECT update_id FROM notes')).toEqual([
			{ update_id: next.update_id },
		]);
	});
});
