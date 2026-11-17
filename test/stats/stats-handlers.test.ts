import { runInDurableObject } from 'cloudflare:test';
import type { User } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import { recordEvent, type StatEvent } from '../../src/stats/event-store';
import { showStats } from '../../src/stats/stats-handlers';
import { freshRoom, type RoomStub, roomWith } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, command, memberChange, textMessage, users } from '../helpers/updates';

// 17.11.2026 at 12:00 in Kyiv, two hours ahead of UTC in winter.
const NOW = Date.UTC(2026, 10, 17, 10);
const MINUTE = 60 * 1000;

const { taras, oleg, andriy } = users;

/** A room that knows these people from a message each, and holds these events. */
async function roomWithRecord(people: User[], events: StatEvent[]): Promise<RoomStub> {
	const stub = await roomWith([showStats], { clock: () => NOW });
	for (const person of people) await stub.handleUpdate(textMessage('привіт', { from: person }));
	await runInDurableObject(stub, (_room, state) => {
		for (const event of events) recordEvent(state.storage.sql, event);
	});
	return stub;
}

function statsCommand(sentAt = NOW) {
	return command('/stats', { from: oleg, date: sentAt / 1000 });
}

describe('/stats', () => {
	it('answers with the all-time boards, a leaver still named', async () => {
		const stub = await roomWithRecord(
			[taras, oleg, andriy],
			[
				{ kind: 'all', userId: taras.id, at: Date.UTC(2026, 9, 20, 10) },
				{ kind: 'all', userId: taras.id, at: Date.UTC(2026, 10, 2, 10) },
				{ kind: 'all', userId: taras.id, at: Date.UTC(2026, 10, 16, 18) },
				{ kind: 'all', userId: oleg.id, at: Date.UTC(2026, 10, 10, 10) },
				{ kind: 'domikpisik', userId: andriy.id, at: Date.UTC(2026, 9, 31, 21, 30) },
				{ kind: 'domikpisik', userId: andriy.id, at: Date.UTC(2026, 9, 31, 22, 30) },
				{ kind: 'pool_open', userId: taras.id, poolId: 1, at: Date.UTC(2026, 10, 16, 16) },
				{ kind: 'join', userId: taras.id, poolId: 1, at: Date.UTC(2026, 10, 16, 16) },
				{ kind: 'join', userId: oleg.id, poolId: 1, at: Date.UTC(2026, 10, 16, 17) },
				{ kind: 'pass', userId: oleg.id, poolId: 1, at: Date.UTC(2026, 10, 16, 18) },
				{ kind: 'join', userId: oleg.id, poolId: 1, at: Date.UTC(2026, 10, 16, 19) },
			],
		);
		await stub.handleUpdate(memberChange(andriy, { from: 'member', to: 'left' }));
		const call = statsCommand();

		await stub.handleUpdate(call);

		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: [
					'📊 Статистика за весь час',
					'',
					'📢 /all',
					'1. Тарас — 3',
					'2. Олег — 1',
					'',
					'🏠 /domikpisik',
					'1. Андрій — 2',
					'',
					'✅ Граю · разом 2',
					'1. Олег — 1',
					'1. Тарас — 1',
					'',
					'🎮 Відкриває пули',
					'1. Тарас — 1',
					'',
					'❌ Пас',
					'1. Олег — 1',
				].join('\n'),
				parse_mode: 'HTML',
				link_preview_options: { is_disabled: true },
				reply_parameters: {
					message_id: call.message?.message_id,
					allow_sending_without_reply: true,
				},
			},
		]);
	});

	it('tells people apart from a namesake who left, though the namesake has no count', async () => {
		const otherAndriy = { id: 1011, is_bot: false, first_name: 'Андрій', last_name: 'Мельник' };
		const stub = await roomWithRecord(
			[andriy, otherAndriy],
			[{ kind: 'all', userId: andriy.id, at: Date.UTC(2026, 10, 16, 10) }],
		);
		await stub.handleUpdate(memberChange(otherAndriy, { from: 'member', to: 'left' }));

		await stub.handleUpdate(statsCommand());

		const [reply] = telegram.callsTo('sendMessage');
		expect(String(reply?.text)).toContain('📢 /all\n1. Андрій К. — 1\n');
	});

	it('stays quiet when it reaches the bot over 10 minutes late', async () => {
		const stub = await roomWithRecord([oleg], []);

		await stub.handleUpdate(statsCommand(NOW - 11 * MINUTE));

		expect(telegram.callsTo('sendMessage')).toEqual([]);
	});

	it("is one of the bot's features", async () => {
		await freshRoom().handleUpdate(command('/stats', { from: oleg }));

		const [reply] = telegram.callsTo('sendMessage');
		expect(String(reply?.text)).toMatch(/^📊 Статистика за весь час\n/);
	});
});
