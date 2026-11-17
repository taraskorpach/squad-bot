import type { User } from 'grammy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { poolTaps } from '../../src/pools/pool-callbacks';
import { pooling } from '../../src/pools/pool-handlers';
import { poolMenu } from '../../src/pools/pool-menu-taps';
import { roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, command, tap, textMessage, users } from '../helpers/updates';

// 16.11.2030 in Kyiv, two hours ahead of UTC. In the future, so no pool's alarm fires mid-test.
const kyiv = (hour: number, minute = 0) => Date.UTC(2030, 10, 16, hour - 2, minute);
const NOW = kyiv(18, 40);
const MENU_ID = 9001;
const NOT_YOURS = 'Це меню не твоє — відкрий своє: /pool';
const { taras, oleg } = users;

beforeEach(() => {
	const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
	return () => quiet.mockRestore();
});

/** A room that knows Тарас and Олег, where Тарас has just sent /pool with nothing after it. */
async function menuOpened(clock = NOW) {
	const stub = await roomWith([pooling, poolMenu, poolTaps], { clock: () => clock });
	for (const person of [taras, oleg]) {
		await stub.handleUpdate(textMessage('привіт', { from: person }));
	}
	const call = command('/pool', { from: taras, date: Math.floor(clock / 1000) });
	await stub.handleUpdate(call);
	return { stub, commandId: Number(call.message?.message_id) };
}

function menuTap(data: string, commandId: number, from: User = taras) {
	return tap(data, { from, messageId: MENU_ID, replyTo: commandId });
}

function toasts(): unknown[] {
	return telegram.callsTo('answerCallbackQuery').map((payload) => payload.text);
}

function edits(): unknown[] {
	return telegram.callsTo('editMessageText').map((payload) => payload.text);
}

describe('/pool with nothing after it', () => {
	it('replies with the menu and opens nothing yet', async () => {
		const { stub, commandId } = await menuOpened();

		expect(telegram.callsTo('sendMessage').at(-1)).toMatchObject({
			chat_id: CHAT_ID,
			text: '🎮 Новий пул — у що граємо?\nІншу гру відкривай командою: /pool назва 5 21:00',
			reply_parameters: { message_id: commandId },
			reply_markup: {
				inline_keyboard: [[{ text: 'CS2' }, { text: 'Мафія' }], [{ text: '✖️ Скасувати' }]],
			},
		});
		expect(await rows(stub, 'SELECT id FROM pools')).toEqual([]);
	});
});

describe('the menu’s taps', () => {
	it('walk the author through the steps, all in the menu’s message', async () => {
		const { stub, commandId } = await menuOpened();
		const author = taras.id;

		await stub.handleUpdate(menuTap(`m:${author}:1:-:-`, commandId));
		await stub.handleUpdate(menuTap(`m:${author}:1:8:-`, commandId));
		await stub.handleUpdate(menuTap(`m:${author}:1:8:o`, commandId));
		await stub.handleUpdate(menuTap(`m:${author}:1:8:o21`, commandId));

		expect(edits()).toEqual([
			'🎮 Мафія — скільки місць?',
			'🎮 Мафія · 8 місць — коли?',
			'🎮 Мафія · 8 місць — о котрій?',
			'🎮 Мафія · 8 місць — о 21:__?',
		]);
		expect(telegram.callsTo('editMessageText')).toEqual(
			Array(4).fill(expect.objectContaining({ chat_id: CHAT_ID, message_id: MENU_ID })),
		);
		expect(toasts()).toEqual([undefined, undefined, undefined, undefined]);
		expect(await rows(stub, 'SELECT id FROM pools')).toEqual([]);
	});

	it('open the pool on the time: the card replies to /pool, then the menu goes', async () => {
		const { stub, commandId } = await menuOpened();
		telegram.reset();

		await stub.handleUpdate(menuTap(`m:${taras.id}:1:8:2130`, commandId));

		expect(await rows(stub, 'SELECT game, size, author_id, starts_at FROM pools')).toEqual([
			{ game: 'Мафія', size: 8, author_id: taras.id, starts_at: kyiv(21, 30) },
		]);
		expect(telegram.callsTo('sendMessage')[0]).toMatchObject({
			text: expect.stringContaining('🎮 Мафія · 8 місць · сьогодні о 21:30'),
			reply_parameters: { message_id: commandId },
		});
		expect(telegram.callsTo('deleteMessage')).toEqual([{ chat_id: CHAT_ID, message_id: MENU_ID }]);
		expect(toasts()).toEqual([undefined]);
	});

	it('open a pool without a limit for now', async () => {
		const { stub, commandId } = await menuOpened();

		await stub.handleUpdate(menuTap(`m:${taras.id}:0:0:n`, commandId));

		expect(await rows(stub, 'SELECT game, size, starts_at FROM pools')).toEqual([
			{ game: 'CS2', size: 0, starts_at: null },
		]);
	});

	it('open a pool at a full hour from the time step, today', async () => {
		const { stub, commandId } = await menuOpened();

		await stub.handleUpdate(menuTap(`m:${taras.id}:0:5:t21`, commandId));

		expect(await rows(stub, 'SELECT starts_at FROM pools')).toEqual([{ starts_at: kyiv(21) }]);
	});

	it('show fresh hours when the hour tapped has passed, and open nothing', async () => {
		const { stub, commandId } = await menuOpened(kyiv(20, 10));
		telegram.reset();

		await stub.handleUpdate(menuTap(`m:${taras.id}:0:5:t19`, commandId));

		expect(toasts()).toEqual(['Ця година вже минула — обери іншу']);
		expect(edits()).toEqual(['🎮 CS2 · 5 місць — коли?']);
		expect(await rows(stub, 'SELECT id FROM pools')).toEqual([]);
	});

	it('open nothing more on a second tap', async () => {
		const { stub, commandId } = await menuOpened();

		await stub.handleUpdate(menuTap(`m:${taras.id}:1:8:n`, commandId));
		await stub.handleUpdate(menuTap(`m:${taras.id}:1:8:n`, commandId));

		expect(await rows(stub, 'SELECT id FROM pools')).toHaveLength(1);
	});

	it('answer anyone but the author with a toast, and change nothing', async () => {
		const { stub, commandId } = await menuOpened();
		telegram.reset();

		await stub.handleUpdate(menuTap(`m:${taras.id}:1:-:-`, commandId, oleg));
		await stub.handleUpdate(menuTap(`m:${taras.id}:x`, commandId, oleg));

		expect(toasts()).toEqual([NOT_YOURS, NOT_YOURS]);
		expect(telegram.callsTo('editMessageText')).toEqual([]);
		expect(telegram.callsTo('deleteMessage')).toEqual([]);
	});

	it('cancel: the menu goes', async () => {
		const { stub, commandId } = await menuOpened();
		telegram.reset();

		await stub.handleUpdate(menuTap(`m:${taras.id}:x`, commandId));

		expect(toasts()).toEqual(['Скасовано']);
		expect(telegram.callsTo('deleteMessage')).toEqual([{ chat_id: CHAT_ID, message_id: MENU_ID }]);
	});

	it('close the menu in place when Telegram won’t delete it', async () => {
		const { stub, commandId } = await menuOpened();
		telegram.reset();
		telegram.fail('deleteMessage', {
			status: 400,
			description: "Bad Request: message can't be deleted",
		});

		await stub.handleUpdate(menuTap(`m:${taras.id}:1:8:n`, commandId));

		const [closing] = telegram.callsTo('editMessageText');
		expect(closing).toMatchObject({ message_id: MENU_ID, text: '✅ Пул відкрито' });
		expect(closing).not.toHaveProperty('reply_markup');
	});
});
