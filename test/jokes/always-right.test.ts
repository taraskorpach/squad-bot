import { describe, expect, it } from 'vitest';
import { artemIsAlwaysRight } from '../../src/jokes/always-right';
import { roomWith } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, command, users } from '../helpers/updates';

const MINUTE = 60 * 1000;
const REMINDER = 'Нагадую, Артем Поліченко завжди правий і це не обговорюється.';

describe('/artemisalwaysright', () => {
	it('reminds the chat, then deletes the command', async () => {
		const stub = await roomWith([artemIsAlwaysRight]);
		const call = command('/artemisalwaysright', { from: users.oleg });

		await stub.handleUpdate(call);

		expect(telegram.calls().map(({ method }) => method)).toEqual(['sendMessage', 'deleteMessage']);
		expect(telegram.callsTo('sendMessage')).toEqual([
			expect.objectContaining({ chat_id: CHAT_ID, text: REMINDER }),
		]);
		expect(telegram.callsTo('sendMessage')[0]).not.toHaveProperty('reply_parameters');
		expect(telegram.callsTo('deleteMessage')).toEqual([
			{ chat_id: CHAT_ID, message_id: call.message?.message_id },
		]);
	});

	it('still reminds the chat when the command can’t be deleted', async () => {
		const stub = await roomWith([artemIsAlwaysRight]);
		telegram.fail('deleteMessage', {
			status: 400,
			description: "Bad Request: message can't be deleted",
		});

		await stub.handleUpdate(command('/artemisalwaysright', { from: users.oleg }));

		expect(telegram.callsTo('sendMessage')).toEqual([expect.objectContaining({ text: REMINDER })]);
	});

	it('stays quiet when it reaches the bot over 10 minutes late', async () => {
		const now = Date.now();
		const stub = await roomWith([artemIsAlwaysRight], { clock: () => now });
		const sentAt = Math.floor((now - 11 * MINUTE) / 1000);

		await stub.handleUpdate(command('/artemisalwaysright', { from: users.oleg, date: sentAt }));

		expect(telegram.calls()).toEqual([]);
	});
});
