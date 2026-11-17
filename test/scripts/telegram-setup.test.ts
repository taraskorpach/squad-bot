import type { Chat, Update, WebhookInfo } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import {
	COMMAND_MENU,
	deliveryError,
	groupsIn,
	probeProblem,
	probeRequest,
	webhookSettings,
} from '../../scripts/telegram-setup';
import { ALLOWED_UPDATES, HI_CALLBACK } from '../../src/telegram';
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
				{ command: 'artemisalwaysright', description: 'Нагадати, що Артем завжди правий' },
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

const WORKER = 'https://squad-bot.example.workers.dev';
const SECRET = 'Zx9_-abcdefghijklmnopqrstuvwxyz01';

describe('webhookSettings', () => {
	it("points Telegram at the Worker's webhook with the secret, the update types and a clean start", () => {
		expect(webhookSettings(WORKER, SECRET)).toEqual({
			url: `${WORKER}/webhook`,
			secret_token: SECRET,
			allowed_updates: ALLOWED_UPDATES,
			drop_pending_updates: true,
		});
	});

	it.each([`${WORKER}/`, `${WORKER}/some/path?x=1`])(
		'keeps only the origin of %s, since the Worker answers at /webhook alone',
		(workerUrl) => {
			expect(webhookSettings(workerUrl, SECRET).url).toBe(`${WORKER}/webhook`);
		},
	);

	it.each([
		['http://squad-bot.example.workers.dev', "The Worker's URL must start with https://"],
		['squad-bot.example.workers.dev', 'Not a URL: squad-bot.example.workers.dev'],
	])('refuses %s', (workerUrl, error) => {
		expect(() => webhookSettings(workerUrl, SECRET)).toThrow(error);
	});

	it.each([
		['shorter than 32 characters', 'a'.repeat(31)],
		['longer than 256', 'a'.repeat(257)],
		['with a character Telegram refuses', `${'a'.repeat(32)}!`],
	])('refuses a secret %s, without printing it', (_case, secret) => {
		expect(() => webhookSettings(WORKER, secret)).toThrow(
			'WEBHOOK_SECRET must be 32 to 256 characters of A-Z, a-z, 0-9, _ and -',
		);
	});
});

describe('deliveryError', () => {
	const info: WebhookInfo = {
		url: `${WORKER}/webhook`,
		has_custom_certificate: false,
		pending_update_count: 0,
	};

	it('is none while Telegram has no failed delivery to report', () => {
		expect(deliveryError(info)).toBeUndefined();
	});

	it('says when and how the last delivery failed', () => {
		const failed = {
			...info,
			last_error_date: 1_794_860_000,
			last_error_message: 'Wrong response from the webhook: 401 Unauthorized',
		};

		expect(deliveryError(failed)).toBe(
			"Telegram's last delivery failed at 2026-11-16T20:13:20.000Z: Wrong response from the webhook: 401 Unauthorized",
		);
	});
});

describe('probeRequest', () => {
	it('is the POST Telegram will send, with the secret and an update that has no chat', () => {
		expect(probeRequest(SECRET)).toEqual({
			method: 'POST',
			headers: { 'X-Telegram-Bot-Api-Secret-Token': SECRET, 'Content-Type': 'application/json' },
			body: '{"update_id":0}',
		});
	});
});

describe('probeProblem', () => {
	it('is none when the Worker takes the update', () => {
		expect(probeProblem(200)).toBeUndefined();
	});

	it.each([
		[401, 'The Worker refused the secret: its WEBHOOK_SECRET is a different one'],
		[404, 'Nothing answers at this URL: check it, and that the Worker is deployed'],
		[500, 'The Worker answered 500, not 200'],
	])('explains a %i', (status, problem) => {
		expect(probeProblem(status)).toBe(problem);
	});
});
