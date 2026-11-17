import { runInDurableObject } from 'cloudflare:test';
import type { User } from 'grammy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { poolTaps } from '../../src/pools/pool-callbacks';
import { pooling } from '../../src/pools/pool-handlers';
import type { PoolAction } from '../../src/pools/pool-keyboards';
import { type RoomSeams, type RoomStub, roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, command, tap, textMessage, users } from '../helpers/updates';

// 16.11 at 18:00 in Kyiv, two hours ahead of UTC in winter. In the future: workerd runs an alarm
// set in the past at once, which would fire pools' timers in the middle of these tests.
const OPENED_AT = Date.UTC(2030, 10, 16, 16);
const TAPPED_AT = OPENED_AT + 60 * 1000;
const { taras, oleg, andriy, ihor } = users;

beforeEach(() => {
	const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
	return () => quiet.mockRestore();
});

/** A room that knows these people, where Тарас has just opened `/pool cs2 {size}`. */
async function poolOf(
	size: number,
	people: User[] = [taras, oleg, andriy, ihor],
	seams: RoomSeams = {},
) {
	const stub = await roomWith([pooling, poolTaps], { clock: () => TAPPED_AT, ...seams });
	for (const person of people) await stub.handleUpdate(textMessage('привіт', { from: person }));
	await stub.handleUpdate(command(`/pool cs2 ${size}`, { from: taras, date: OPENED_AT / 1000 }));
	const [pool] = await rows(stub, 'SELECT id, message_id FROM pools');
	telegram.reset();
	return { stub, poolId: Number(pool?.id), cardId: Number(pool?.message_id) };
}

function tapOn(card: { poolId: number; cardId: number }, action: PoolAction, from: User) {
	return tap(`p:${card.poolId}:${action}`, { from, messageId: card.cardId });
}

function replyToCard(card: { cardId: number }) {
	return {
		parse_mode: 'HTML',
		link_preview_options: { is_disabled: true },
		reply_parameters: { message_id: card.cardId, allow_sending_without_reply: true },
	};
}

function link(user: User): string {
	return `<a href="tg://user?id=${user.id}">${user.first_name}</a>`;
}

function toasts(): unknown[] {
	return telegram.callsTo('answerCallbackQuery').map((payload) => payload.text);
}

function answersIn(stub: RoomStub) {
	return rows(stub, 'SELECT user_id, choice, rank FROM answers ORDER BY rank');
}

describe('✅ and ❌', () => {
	it('seats the one who taps ✅, answers the tap and edits the card', async () => {
		const card = await poolOf(5);

		await card.stub.handleUpdate(tapOn(card, 'in', oleg));

		expect(toasts()).toEqual(['Ти в грі ✅']);
		const [edit] = telegram.callsTo('editMessageText');
		expect(edit).toMatchObject({ chat_id: CHAT_ID, message_id: card.cardId });
		expect(String(edit?.text).split('\n')[3]).toBe('✅ Грають (2/5): Тарас, Олег');
		expect(await answersIn(card.stub)).toEqual([
			{ user_id: taras.id, choice: 'play', rank: 1 },
			{ user_id: oleg.id, choice: 'play', rank: 2 },
		]);
		expect(await rows(card.stub, "SELECT user_id, at FROM events WHERE kind = 'join'")).toEqual([
			{ user_id: taras.id, at: OPENED_AT },
			{ user_id: oleg.id, at: TAPPED_AT },
		]);
	});

	it('records ❌ as a pass, counted as one', async () => {
		const card = await poolOf(5);

		await card.stub.handleUpdate(tapOn(card, 'out', oleg));

		expect(toasts()).toEqual(['Пас ❌']);
		expect(await rows(card.stub, "SELECT user_id FROM events WHERE kind = 'pass'")).toEqual([
			{ user_id: oleg.id },
		]);
	});

	it('changes nothing for the same answer twice, and leaves the card alone', async () => {
		const card = await poolOf(5);

		await card.stub.handleUpdate(tapOn(card, 'in', oleg));
		await card.stub.handleUpdate(tapOn(card, 'in', oleg));

		expect(toasts()).toEqual(['Ти в грі ✅', 'Ти вже в пулі']);
		expect(telegram.callsTo('editMessageText')).toHaveLength(1);
	});

	it('gives the last seat to one of two taps that arrive together, and benches the other', async () => {
		const card = await poolOf(2);

		await Promise.all([
			card.stub.handleUpdate(tapOn(card, 'in', oleg)),
			card.stub.handleUpdate(tapOn(card, 'in', andriy)),
		]);

		expect(toasts()).toEqual(['Ти в грі ✅', 'Місць немає — ти на лаві, №1 🪑']);
		expect(await answersIn(card.stub)).toEqual([
			{ user_id: taras.id, choice: 'play', rank: 1 },
			{ user_id: oleg.id, choice: 'play', rank: 2 },
			{ user_id: andriy.id, choice: 'play', rank: 3 },
		]);
	});

	it('announces the squad once, under the card, the first time it fills', async () => {
		const card = await poolOf(2);

		await card.stub.handleUpdate(tapOn(card, 'in', oleg));
		await card.stub.handleUpdate(tapOn(card, 'out', oleg));
		await card.stub.handleUpdate(tapOn(card, 'in', andriy));

		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: `🎮 Склад на cs2 зібрано: ${link(oleg)}, ${link(taras)}.`,
				parse_mode: 'HTML',
				link_preview_options: { is_disabled: true },
				reply_parameters: { message_id: card.cardId, allow_sending_without_reply: true },
			},
		]);
	});

	it('moves the bench head up when a player passes, and pings them; a bench pass moves nobody', async () => {
		const card = await poolOf(2);
		await card.stub.handleUpdate(tapOn(card, 'in', oleg));
		await card.stub.handleUpdate(tapOn(card, 'in', andriy));
		await card.stub.handleUpdate(tapOn(card, 'in', ihor));
		telegram.reset();

		await card.stub.handleUpdate(tapOn(card, 'out', oleg));
		await card.stub.handleUpdate(tapOn(card, 'out', ihor));

		expect(telegram.callsTo('sendMessage').map((payload) => payload.text)).toEqual([
			`${link(andriy)}, звільнилось місце — ти граєш у cs2.`,
		]);
	});

	it('adopts the tapped message as the card when the card was posted but its id never stored', async () => {
		const stub = await roomWith([pooling, poolTaps], { clock: () => TAPPED_AT });
		await stub.handleUpdate(textMessage('привіт', { from: taras }));
		telegram.fail('sendMessage', { status: 400, description: 'chat not found' });
		await stub.handleUpdate(command('/pool', { from: taras, date: OPENED_AT / 1000 }));

		await stub.handleUpdate(tap('p:1:in', { from: oleg, messageId: 555 }));

		expect(await rows(stub, 'SELECT message_id FROM pools')).toEqual([{ message_id: 555 }]);
		expect(await rows(stub, 'SELECT message_id FROM pool_messages')).toEqual([{ message_id: 555 }]);
		expect(telegram.callsTo('editMessageText')).toMatchObject([{ message_id: 555 }]);
	});

	it('says a closed pool is closed, and shows its card closed', async () => {
		const card = await poolOf(5);
		await runInDurableObject(card.stub, (_room, state) => {
			state.storage.sql.exec("UPDATE pools SET status = 'closed', closed_by = 'auto'");
		});

		await card.stub.handleUpdate(tapOn(card, 'in', oleg));

		expect(toasts()).toEqual(['Цей пул уже закрито']);
		const [edit] = telegram.callsTo('editMessageText');
		expect(String(edit?.text).split('\n')[1]).toBe('Автор: Тарас · 🔒 закрито');
		expect(edit?.reply_markup).toBeUndefined();
		expect(await answersIn(card.stub)).toHaveLength(1);
	});

	it('answers a tap on a pool that does not exist, and changes nothing', async () => {
		const card = await poolOf(5);

		await card.stub.handleUpdate(tap('p:99:in', { from: oleg, messageId: 777 }));

		expect(telegram.callsTo('answerCallbackQuery')).toHaveLength(1);
		expect(await answersIn(card.stub)).toHaveLength(1);
	});
});

describe('🔔', () => {
	it('tags whoever has yet to answer, under the card, and says how many', async () => {
		const card = await poolOf(5);

		await card.stub.handleUpdate(tapOn(card, 'ping', oleg));

		expect(toasts()).toEqual(['Нагадав: 3']);
		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: `🔔 Чекаємо на відповідь: ${[andriy, ihor, oleg].map(link).join(', ')}`,
				...replyToCard(card),
			},
		]);
	});

	it('tags at most once per 30 s per pool, and says so to a repeat', async () => {
		let now = TAPPED_AT;
		const card = await poolOf(5, undefined, { clock: () => now });

		await card.stub.handleUpdate(tapOn(card, 'ping', oleg));
		now += 29 * 1000;
		await card.stub.handleUpdate(tapOn(card, 'ping', andriy));
		now += 2 * 1000;
		await card.stub.handleUpdate(tapOn(card, 'ping', andriy));

		expect(toasts()).toEqual(['Нагадав: 3', 'Щойно нагадав — спробуй трохи згодом', 'Нагадав: 3']);
		expect(telegram.callsTo('sendMessage')).toHaveLength(2);
	});

	it('says everyone has answered when nobody is left to tag', async () => {
		const card = await poolOf(5, [taras, oleg]);
		await card.stub.handleUpdate(tapOn(card, 'out', oleg));
		telegram.reset();

		await card.stub.handleUpdate(tapOn(card, 'ping', taras));

		expect(toasts()).toEqual(['Усі вже відповіли']);
		expect(telegram.callsTo('sendMessage')).toEqual([]);
	});
});

describe('🎲', () => {
	/** Тарас, Олег and Андрій play for two seats; the draw always picks the last left in line. */
	async function overfull() {
		const card = await poolOf(2, undefined, { random: () => 0.99 });
		await card.stub.handleUpdate(tapOn(card, 'in', oleg));
		await card.stub.handleUpdate(tapOn(card, 'in', andriy));
		telegram.reset();
		return card;
	}

	it('draws the squad from everyone playing, renumbers the line, and tags squad and bench', async () => {
		const card = await overfull();

		await card.stub.handleUpdate(tapOn(card, 'draw', oleg));

		expect(toasts()).toEqual(['Жереб кинуто 🎲']);
		expect(await answersIn(card.stub)).toEqual([
			{ user_id: oleg.id, choice: 'play', rank: 1 },
			{ user_id: andriy.id, choice: 'play', rank: 2 },
			{ user_id: taras.id, choice: 'play', rank: 3 },
		]);
		const [edit] = telegram.callsTo('editMessageText');
		expect(String(edit?.text).split('\n').slice(1, 6)).toEqual([
			'Автор: Тарас',
			'🎲 Склад визначено жеребом',
			'',
			'✅ Грають (2/2): Олег, Андрій',
			'🪑 Лава: Тарас',
		]);
		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: `🎲 Жереб кинуто. У склад: ${link(andriy)}, ${link(oleg)}. На лаву: ${link(taras)}.`,
				...replyToCard(card),
			},
		]);
	});

	it('is drawn once, by a player only', async () => {
		const card = await overfull();

		await card.stub.handleUpdate(tapOn(card, 'draw', ihor));
		await card.stub.handleUpdate(tapOn(card, 'draw', oleg));
		await card.stub.handleUpdate(tapOn(card, 'draw', oleg));

		expect(toasts()).toEqual([
			'Жереб кидають ті, хто в пулі',
			'Жереб кинуто 🎲',
			'Жереб уже кинули',
		]);
	});

	it('is not needed while nobody sits on the bench', async () => {
		const card = await poolOf(5);

		await card.stub.handleUpdate(tapOn(card, 'draw', taras));

		expect(toasts()).toEqual(['Лава порожня — жереб не потрібен']);
		expect(await rows(card.stub, 'SELECT drawn FROM pools')).toEqual([{ drawn: 0 }]);
	});
});

describe('✖️', () => {
	it("closes the author's pool: the card turns final, and the others who said Граю are tagged", async () => {
		const card = await poolOf(5);
		await card.stub.handleUpdate(tapOn(card, 'in', oleg));
		await card.stub.handleUpdate(tapOn(card, 'in', andriy));
		await card.stub.handleUpdate(tapOn(card, 'out', ihor));
		telegram.reset();

		await card.stub.handleUpdate(tapOn(card, 'close', taras));

		expect(toasts()).toEqual(['Пул закрито']);
		const [edit] = telegram.callsTo('editMessageText');
		expect(String(edit?.text).split('\n')[1]).toBe('Автор: Тарас · 🔒 закрито автором');
		expect(edit?.reply_markup).toBeUndefined();
		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: `✖️ Пул на cs2 закрито автором. ${link(andriy)}, ${link(oleg)}`,
				...replyToCard(card),
			},
		]);
		expect(await rows(card.stub, 'SELECT status, closed_by FROM pools')).toEqual([
			{ status: 'closed', closed_by: 'author' },
		]);
	});

	it('stays open when anyone but the author presses it', async () => {
		const card = await poolOf(5);

		await card.stub.handleUpdate(tapOn(card, 'close', oleg));

		expect(toasts()).toEqual(['Закрити може лише автор']);
		expect(await rows(card.stub, 'SELECT status FROM pools')).toEqual([{ status: 'open' }]);
	});

	it('closes without a message when nobody else said Граю', async () => {
		const card = await poolOf(5);

		await card.stub.handleUpdate(tapOn(card, 'close', taras));

		expect(toasts()).toEqual(['Пул закрито']);
		expect(telegram.callsTo('sendMessage')).toEqual([]);
	});
});
