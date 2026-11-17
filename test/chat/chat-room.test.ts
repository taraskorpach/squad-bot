import { runInDurableObject } from 'cloudflare:test';
import type { Middleware } from 'grammy';
import { describe, expect, it } from 'vitest';
import type { ChatRoom } from '../../src/chat/chat-room';
import type { RoomAccess } from '../../src/chat/room';
import type { BotContext } from '../../src/context';
import { failureOf, freshRoom, noting, roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, textMessage } from '../helpers/updates';

const HOUR = 60 * 60 * 1000;

describe('ChatRoom.handleUpdate', () => {
	it('hands each update to the features', async () => {
		const seen: number[] = [];
		const stub = await roomWith([
			(ctx) => {
				seen.push(ctx.update.update_id);
			},
		]);
		const update = textMessage('привіт');

		await stub.handleUpdate(update);

		expect(seen).toEqual([update.update_id]);
	});

	it('ignores a redelivered update: it changes nothing the second time', async () => {
		let runs = 0;
		const stub = await roomWith([
			(_ctx, next) => {
				runs++;
				return next();
			},
			noting,
		]);
		const update = textMessage('привіт');

		await stub.handleUpdate(update);
		await stub.handleUpdate(update);

		expect(runs).toBe(1);
		expect(await rows(stub, 'SELECT update_id FROM notes')).toEqual([
			{ update_id: update.update_id },
		]);
	});

	it('records an update that committed nothing once it has been processed', async () => {
		let runs = 0;
		const stub = await roomWith([
			() => {
				runs++;
			},
		]);
		const update = textMessage('привіт');

		await stub.handleUpdate(update);
		await stub.handleUpdate(update);

		expect(runs).toBe(1);
	});

	it("commits the update's id with its first change and returns the decision", async () => {
		const seen: unknown[] = [];
		const stub = await roomWith([
			(ctx) => {
				const decision = ctx.room.commit((sql) => {
					sql.exec('INSERT INTO notes (update_id, text) VALUES (?, ?)', ctx.update.update_id, 'x');
					return 'decided';
				});
				const recorded = ctx.room.write((sql) =>
					sql
						.exec(
							'SELECT update_id FROM processed_updates WHERE update_id = ?',
							ctx.update.update_id,
						)
						.toArray(),
				);
				seen.push(decision, recorded.length, ctx.room.committed);
			},
		]);

		await stub.handleUpdate(textMessage('привіт'));

		expect(seen).toEqual(['decided', 1, true]);
	});

	it('rolls back a commit that throws, update record included', async () => {
		const stub = await roomWith([
			(ctx) => {
				ctx.room.commit((sql) => {
					sql.exec('INSERT INTO notes (update_id, text) VALUES (?, ?)', ctx.update.update_id, 'x');
					throw new Error('the decision failed');
				});
			},
		]);

		expect(await failureOf(stub.handleUpdate(textMessage('привіт')))).toContain(
			'the decision failed',
		);

		expect(await rows(stub, 'SELECT * FROM notes')).toEqual([]);
		expect(await rows(stub, 'SELECT * FROM processed_updates')).toEqual([]);
	});

	it('runs one update to the end, Telegram calls included, before the next starts', async () => {
		const log: string[] = [];
		const stub = await roomWith([
			async (ctx) => {
				log.push(`start ${ctx.update.update_id}`);
				await ctx.api.sendMessage(CHAT_ID, 'відповідь');
				log.push(`end ${ctx.update.update_id}`);
			},
		]);
		const first = textMessage('один');
		const second = textMessage('два');

		await Promise.all([stub.handleUpdate(first), stub.handleUpdate(second)]);

		expect(log).toEqual([
			`start ${first.update_id}`,
			`end ${first.update_id}`,
			`start ${second.update_id}`,
			`end ${second.update_id}`,
		]);
		expect(telegram.callsTo('sendMessage')).toHaveLength(2);
	});

	it("doesn't let one update's failure stop the next", async () => {
		const failing = textMessage('зламане');
		const stub = await roomWith([
			(ctx, next) => {
				if (ctx.update.update_id === failing.update_id) throw new Error('boom');
				return next();
			},
			noting,
		]);
		const next = textMessage('наступне');

		const results = await Promise.allSettled([stub.handleUpdate(failing), stub.handleUpdate(next)]);

		expect(results.map((result) => result.status)).toEqual(['rejected', 'fulfilled']);
		expect(await rows(stub, 'SELECT update_id FROM notes')).toEqual([
			{ update_id: next.update_id },
		]);
	});

	it('forgets processed and failed updates after 48 hours', async () => {
		const now = Date.now();
		const stub = await roomWith([]);
		await runInDurableObject(stub, (room: ChatRoom, state) => {
			room.clock = () => now;
			state.storage.sql.exec(
				'INSERT INTO processed_updates (update_id, processed_at) VALUES (1, ?), (2, ?)',
				now - 49 * HOUR,
				now - 47 * HOUR,
			);
			state.storage.sql.exec(
				'INSERT INTO failed_updates (update_id, attempts, first_failed_at) VALUES (3, 1, ?), (4, 1, ?)',
				now - 49 * HOUR,
				now - 47 * HOUR,
			);
		});
		const update = textMessage('привіт');

		await stub.handleUpdate(update);

		expect(await rows(stub, 'SELECT update_id FROM processed_updates ORDER BY update_id')).toEqual([
			{ update_id: 2 },
			{ update_id: update.update_id },
		]);
		expect(await rows(stub, 'SELECT update_id FROM failed_updates')).toEqual([{ update_id: 4 }]);
	});
});

describe("the room's memory", () => {
	it('gives features the mention chunk the settings name', async () => {
		const seen: number[] = [];
		const stub = await roomWith([
			(ctx) => {
				seen.push(ctx.room.mentionChunk);
			},
		]);

		await stub.handleUpdate(textMessage('привіт'));

		expect(seen).toEqual([5]);
	});

	it('keeps one throttle per object, from one update to the next', async () => {
		const claims: boolean[] = [];
		const claiming: Middleware<BotContext> = (ctx) => {
			claims.push(ctx.room.throttle.claim('all', 0, 30_000));
		};
		const first = await roomWith([claiming]);
		const second = await roomWith([claiming]);

		await first.handleUpdate(textMessage('один'));
		await first.handleUpdate(textMessage('два'));
		await second.handleUpdate(textMessage('три'));

		expect(claims).toEqual([true, false, true]);
	});
});

describe("the update's room as an action's room", () => {
	/** An action, as the pools write them: against the room, never a grammY context. */
	function noteChange(room: RoomAccess): number {
		return room.tx((sql) => {
			sql.exec('INSERT INTO notes (update_id, text) VALUES (0, ?)', 'from an action');
			return room.chatId;
		});
	}

	it("records the update with the action's change, so a redelivery can't repeat it", async () => {
		const seen: unknown[] = [];
		const stub = await roomWith([
			(ctx) => {
				const chatId = noteChange(ctx.room);
				const recorded = ctx.room.write((sql) =>
					sql
						.exec(
							'SELECT update_id FROM processed_updates WHERE update_id = ?',
							ctx.update.update_id,
						)
						.toArray(),
				);
				seen.push(chatId, recorded.length, ctx.room.committed);
			},
		]);

		await stub.handleUpdate(textMessage('привіт'));

		expect(seen).toEqual([CHAT_ID, 1, true]);
	});
});

describe('ChatRoom seams', () => {
	it('draws randomness from [0, 1) by default', async () => {
		const draws = await runInDurableObject(freshRoom(), (room: ChatRoom) =>
			Array.from({ length: 100 }, () => room.random()),
		);

		expect(draws.every((draw) => draw >= 0 && draw < 1)).toBe(true);
		expect(new Set(draws).size).toBeGreaterThan(90);
	});
});
