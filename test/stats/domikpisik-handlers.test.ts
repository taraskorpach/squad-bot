import { describe, expect, it } from 'vitest';
import { countDomikpisik } from '../../src/stats/domikpisik-handlers';
import { type RoomStub, roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { command, users } from '../helpers/updates';

const MINUTE = 60 * 1000;

function counted(stub: RoomStub) {
	return rows(stub, "SELECT user_id, at FROM events WHERE kind = 'domikpisik' ORDER BY id");
}

describe('/domikpisik', () => {
	it('is counted for whoever sent it, at the time it was sent, and never answered', async () => {
		const stub = await roomWith([countDomikpisik]);
		const call = command('/domikpisik', { from: users.andriy });

		await stub.handleUpdate(call);

		expect(await counted(stub)).toEqual([
			{ user_id: users.andriy.id, at: (call.message?.date ?? 0) * 1000 },
		]);
		expect(telegram.calls()).toEqual([]);
	});

	it('is counted once per update, even when Telegram delivers one twice', async () => {
		const stub = await roomWith([countDomikpisik]);
		const call = command('/domikpisik', { from: users.andriy });

		await stub.handleUpdate(call);
		await stub.handleUpdate(call);
		await stub.handleUpdate(command('/domikpisik', { from: users.andriy }));

		expect(await counted(stub)).toHaveLength(2);
	});

	it('is still counted when it reaches the bot over 10 minutes late', async () => {
		const now = Date.now();
		const stub = await roomWith([countDomikpisik], { clock: () => now });
		const sentAt = Math.floor((now - 11 * MINUTE) / 1000);

		await stub.handleUpdate(command('/domikpisik', { from: users.andriy, date: sentAt }));

		expect(await counted(stub)).toEqual([{ user_id: users.andriy.id, at: sentAt * 1000 }]);
	});
});
