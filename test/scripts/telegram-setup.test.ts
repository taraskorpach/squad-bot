import { describe, expect, it } from 'vitest';
import { COMMAND_MENU } from '../../scripts/telegram-setup';

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
