import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import type { User } from 'grammy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatRoom } from '../../src/chat/chat-room';
import { poolTaps } from '../../src/pools/pool-callbacks';
import { pooling } from '../../src/pools/pool-handlers';
import { type RoomStub, roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, command, tap, textMessage, users } from '../helpers/updates';

// Kyiv is two hours ahead of UTC in winter. In the future: workerd runs an alarm set in the past
// at once, so a test clock behind the real one would fire the timers before the test does.
const kyiv = (day: number, hour: number, minute = 0) => Date.UTC(2030, 10, day, hour - 2, minute);
const MINUTE = 60 * 1000;
const { taras, oleg, andriy } = users;

let now: number;

beforeEach(() => {
	const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
	return () => quiet.mockRestore();
});

/** A room on a clock the test moves, where Тарас opens `/pool …` at `openedAt` in Kyiv. */
async function opened(text: string, openedAt: number, people: User[] = [taras, oleg, andriy]) {
	now = openedAt;
	const stub = await roomWith([pooling, poolTaps], { clock: () => now });
	for (const person of people) await stub.handleUpdate(textMessage('привіт', { from: person }));
	await stub.handleUpdate(command(text, { from: taras, date: openedAt / 1000 }));
	return stub;
}

function alarmOf(stub: RoomStub): Promise<number | null> {
	return runInDurableObject(stub, (_room, state) => state.storage.getAlarm());
}

async function cardOf(stub: RoomStub) {
	const [pool] = await rows(stub, 'SELECT id, message_id FROM pools');
	return { poolId: Number(pool?.id), cardId: Number(pool?.message_id) };
}

function link(user: User): string {
	return `<a href="tg://user?id=${user.id}">${user.first_name}</a>`;
}

describe('arming', () => {
	it('points the alarm at the start once a pool with a time opens', async () => {
		const stub = await opened('/pool cs2 21:00', kyiv(16, 18));

		expect(await alarmOf(stub)).toBe(kyiv(16, 21));
	});

	it('points it at the close for a pool now, three hours on', async () => {
		const stub = await opened('/pool CS2', kyiv(16, 18));

		expect(await alarmOf(stub)).toBe(kyiv(16, 21));
	});

	it('points it at the midnight that turns завтра into сьогодні', async () => {
		const stub = await opened('/pool cs2 01:00', kyiv(16, 23));

		expect(await alarmOf(stub)).toBe(kyiv(17, 0));
	});

	it('brings a lost alarm back with the next update', async () => {
		const stub = await opened('/pool CS2', kyiv(16, 18));
		await runInDurableObject(stub, (_room, state) => state.storage.deleteAlarm());

		await stub.handleUpdate(textMessage('привіт', { from: oleg }));

		expect(await alarmOf(stub)).toBe(kyiv(16, 21));
	});
});

describe('the start ping', () => {
	it('tags the players at the start, not the bench, and only once', async () => {
		const stub = await opened('/pool cs2 2 21:00', kyiv(16, 18));
		const card = await cardOf(stub);
		await stub.handleUpdate(tap(`p:${card.poolId}:in`, { from: oleg, messageId: card.cardId }));
		await stub.handleUpdate(tap(`p:${card.poolId}:in`, { from: andriy, messageId: card.cardId }));
		telegram.reset();
		now = kyiv(16, 21, 1);

		await runDurableObjectAlarm(stub);
		await runDurableObjectAlarm(stub);

		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: `⏰ cs2 — час! ${link(oleg)}, ${link(taras)}`,
				parse_mode: 'HTML',
				link_preview_options: { is_disabled: true },
				reply_parameters: { message_id: card.cardId, allow_sending_without_reply: true },
			},
		]);
		expect(await rows(stub, 'SELECT start_pinged FROM pools')).toEqual([{ start_pinged: 1 }]);
	});

	it('adds the fill while the squad is short', async () => {
		const stub = await opened('/pool cs2 21:00', kyiv(16, 18));
		telegram.reset();
		now = kyiv(16, 21);

		await runDurableObjectAlarm(stub);

		expect(telegram.callsTo('sendMessage').map((payload) => payload.text)).toEqual([
			`⏰ cs2 — час! ${link(taras)} (1/5)`,
		]);
	});

	it('is skipped, and marked done, more than 15 minutes late', async () => {
		const stub = await opened('/pool cs2 21:00', kyiv(16, 18));
		telegram.reset();
		now = kyiv(16, 21, 16);

		await runDurableObjectAlarm(stub);

		expect(telegram.callsTo('sendMessage')).toEqual([]);
		expect(await rows(stub, 'SELECT start_pinged FROM pools')).toEqual([{ start_pinged: 1 }]);
	});
});

describe('the auto-close', () => {
	it('closes a pool three hours after its start, in silence, and the card turns final', async () => {
		const stub = await opened('/pool cs2 21:00', kyiv(16, 18));
		telegram.reset();
		now = kyiv(17, 0, 1);

		await runDurableObjectAlarm(stub);

		expect(await rows(stub, 'SELECT status, closed_by FROM pools')).toEqual([
			{ status: 'closed', closed_by: 'auto' },
		]);
		const [edit] = telegram.callsTo('editMessageText');
		expect(String(edit?.text).split('\n').slice(0, 2)).toEqual([
			'🎮 cs2 · 5 місць · 16.11 о 21:00',
			'Автор: Тарас · 🔒 закрито',
		]);
		expect(telegram.callsTo('sendMessage')).toEqual([]);
		expect(await alarmOf(stub)).toBeNull();
	});
});

describe('a card that never got out', () => {
	it('is posted by the alarm, with its tag message under it', async () => {
		now = kyiv(16, 18);
		const stub = await roomWith([pooling, poolTaps], { clock: () => now });
		await stub.handleUpdate(textMessage('привіт', { from: oleg }));
		telegram.fail('sendMessage', { status: 400, description: 'chat not found' });
		await stub.handleUpdate(command('/pool CS2', { from: taras, date: now / 1000 }));
		telegram.reset();

		await runDurableObjectAlarm(stub);

		const sent = telegram.callsTo('sendMessage').map((payload) => String(payload.text));
		expect(sent).toHaveLength(2);
		expect(sent[0]?.split('\n')[0]).toBe('🎮 CS2 · 5 місць · зараз');
		expect(sent[1]).toBe(`📢 Тарас збирає CS2 зараз — хто грає? ${link(oleg)}`);
		expect((await cardOf(stub)).cardId).toBeGreaterThan(0);
	});

	it('is tried again after 1, 2 and 4 minutes, then given up, and the alarm moves on', async () => {
		now = kyiv(16, 18);
		const stub = await roomWith([pooling, poolTaps], { clock: () => now });
		telegram.fail('sendMessage', { status: 400, description: 'chat not found' }, 5);
		await stub.handleUpdate(command('/pool CS2', { from: taras, date: now / 1000 }));
		const retries: unknown[] = [];

		for (const wait of [0, 1, 2, 4]) {
			now += wait * MINUTE;
			await runDurableObjectAlarm(stub);
			retries.push(...(await rows(stub, 'SELECT timer_attempts, timer_retry_at FROM pools')));
		}

		expect(retries).toEqual([
			{ timer_attempts: 1, timer_retry_at: kyiv(16, 18, 1) },
			{ timer_attempts: 2, timer_retry_at: kyiv(16, 18, 3) },
			{ timer_attempts: 3, timer_retry_at: kyiv(16, 18, 7) },
			{ timer_attempts: 4, timer_retry_at: null },
		]);
		expect(await alarmOf(stub)).toBe(kyiv(16, 21));
	});
});

describe('midnight', () => {
	it('re-renders an open card whose day label it changes', async () => {
		const stub = await opened('/pool cs2 01:00', kyiv(16, 23));
		telegram.reset();
		now = kyiv(17, 0);

		await runDurableObjectAlarm(stub);

		const [edit] = telegram.callsTo('editMessageText');
		expect(String(edit?.text).split('\n')[0]).toBe('🎮 cs2 · 5 місць · сьогодні о 01:00');
	});
});

describe('an unexpected error in the alarm', () => {
	it('sets the alarm a minute ahead instead of stopping or looping', async () => {
		const stub = await opened('/pool CS2', kyiv(16, 18));
		await runInDurableObject(stub, (room: ChatRoom) => {
			room.timers = {
				...room.timers,
				run: async () => {
					throw new Error('the pools table is gone');
				},
			};
		});
		now = kyiv(16, 21);

		await runDurableObjectAlarm(stub);

		expect(await alarmOf(stub)).toBe(kyiv(16, 21, 1));
	});
});
