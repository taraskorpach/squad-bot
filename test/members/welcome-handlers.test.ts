import { describe, expect, it } from 'vitest';
import { welcoming } from '../../src/members/welcome-handlers';
import { HI_CALLBACK } from '../../src/telegram';
import { welcomeMessage } from '../../src/welcome';
import { roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { botAdded, botChange, CHAT_ID, tap, users } from '../helpers/updates';

describe('the welcome', () => {
	it('is posted when the bot is added as an admin, without asking for rights', async () => {
		const stub = await roomWith([welcoming]);

		await stub.handleUpdate(botAdded());

		const welcome = welcomeMessage({ isAdmin: true });
		expect(telegram.callsTo('sendMessage')).toEqual([
			{ chat_id: CHAT_ID, text: welcome.text, ...welcome.options },
		]);
	});

	it('asks to be made an admin when the bot is added as a plain member', async () => {
		const stub = await roomWith([welcoming]);

		await stub.handleUpdate(botChange({ from: 'left', to: 'member' }));

		expect(telegram.callsTo('sendMessage').map((payload) => payload.text)).toEqual([
			welcomeMessage({ isAdmin: false }).text,
		]);
	});

	it.each([
		['promoted to an admin', 'member', 'administrator'],
		['demoted to a member', 'administrator', 'member'],
		['removed', 'administrator', 'left'],
	] as const)(
		'is not posted when the bot, already in or leaving, is %s',
		async (_case, from, to) => {
			const stub = await roomWith([welcoming]);

			await stub.handleUpdate(botChange({ from, to }));

			expect(telegram.callsTo('sendMessage')).toEqual([]);
		},
	);
});

describe('👋', () => {
	it('thanks whoever taps it, and they are known from then on', async () => {
		const stub = await roomWith([welcoming]);
		const hi = tap(HI_CALLBACK, { from: users.oleg });

		await stub.handleUpdate(hi);

		expect(telegram.callsTo('answerCallbackQuery')).toEqual([
			{ callback_query_id: hi.callback_query?.id, text: "Запам'ятав 👌" },
		]);
		expect(await rows(stub, 'SELECT user_id, in_chat FROM members')).toEqual([
			{ user_id: users.oleg.id, in_chat: 1 },
		]);
	});
});
