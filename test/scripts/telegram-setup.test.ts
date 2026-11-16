import type { Chat, Update } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import { COMMAND_MENU, groupsIn } from '../../scripts/telegram-setup';
import { HI_CALLBACK } from '../../src/telegram';
import {
	botAdded,
	CHANNEL,
	memberChange,
	migrationMessage,
	tap,
	textMessage,
	users,
} from '../helpers/updates';

const basicGroup: Chat.GroupChat = { id: -4001, type: 'group', title: 'Тест' };
const supergroup: Chat.SupergroupChat = { id: -1004001, type: 'supergroup', title: 'Тест' };
const otherGroup: Chat.SupergroupChat = { id: -1004002, type: 'supergroup', title: 'Інша' };

describe('COMMAND_MENU', () => {
	it('lists the commands for group chats, in order, without /domikpisik', () => {
		expect(COMMAND_MENU).toEqual({
			commands: [
				{ command: 'all', description: 'Тегнути всіх' },
				{ command: 'pool', description: 'Відкрити пул: /pool [гра] [розмір] [час]' },
				{ command: 'join', description: 'Приєднатися до пулу' },
				{ command: 'pools', description: 'Відкриті пули' },
				{ command: 'stats', description: 'Статистика' },
			],
			scope: { type: 'all_group_chats' },
		});
	});

	it('keeps to the names and lengths Telegram accepts', () => {
		for (const { command, description } of COMMAND_MENU.commands) {
			expect(command).toMatch(/^[a-z0-9_]{1,32}$/);
			expect(description.length).toBeGreaterThanOrEqual(1);
			expect(description.length).toBeLessThanOrEqual(256);
		}
	});
});

describe('groupsIn', () => {
	it('lists each group once, whatever the update type that showed it', () => {
		const updates = [
			botAdded({ chat: supergroup }),
			textMessage('привіт', { chat: supergroup }),
			memberChange(users.oleg, { from: 'left', to: 'member' }, { chat: otherGroup }),
			tap(HI_CALLBACK, { chatId: otherGroup.id }),
		];

		expect(groupsIn(updates)).toEqual([
			{ id: supergroup.id, title: 'Тест', type: 'supergroup' },
			{ id: otherGroup.id, title: 'Squad', type: 'supergroup' },
		]);
	});

	it('leaves out private chats and channels', () => {
		const channelPost: Update = {
			update_id: 1,
			channel_post: { message_id: 1, date: 0, chat: CHANNEL, text: 'x' },
		};
		const privateMessage = textMessage('/start', {
			chat: { id: users.oleg.id, type: 'private', first_name: 'Олег' },
		});

		expect(groupsIn([channelPost, privateMessage])).toEqual([]);
	});

	it('follows a basic group upgraded to a supergroup, before the supergroup has written', () => {
		const updates = [
			botAdded({ chat: basicGroup }),
			migrationMessage(supergroup.id, { chat: basicGroup }),
		];

		expect(groupsIn(updates)).toEqual([
			{ id: basicGroup.id, title: 'Тест', type: 'group', upgradedTo: supergroup.id },
			{ id: supergroup.id, title: 'Тест', type: 'supergroup' },
		]);
	});

	it("takes the supergroup's own title once it writes", () => {
		const renamed = { ...supergroup, title: 'Тест 2' };
		const updates = [
			migrationMessage(supergroup.id, { chat: basicGroup }),
			textMessage('привіт', { chat: renamed }),
		];

		expect(groupsIn(updates)).toContainEqual({
			id: supergroup.id,
			title: 'Тест 2',
			type: 'supergroup',
		});
	});
});
