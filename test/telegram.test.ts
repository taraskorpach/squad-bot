import type { ChatMember, Update } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import {
	ALLOWED_UPDATES,
	type AllowedUpdate,
	chatIdOf,
	isInChat,
	personSending,
} from '../src/telegram';
import {
	botAdded,
	CHANNEL,
	chatMember,
	command,
	memberChange,
	TELEGRAM,
	tap,
	textMessage,
	users,
} from './helpers/updates';

const CHAT = -100111;

// A Record, so adding a type to ALLOWED_UPDATES without an example fails to compile.
const EXAMPLES: Record<AllowedUpdate, Update> = {
	message: command('/all', { chatId: CHAT }),
	callback_query: tap('p:1:in', { chatId: CHAT }),
	chat_member: memberChange(users.oleg, { from: 'left', to: 'member' }, { chatId: CHAT }),
	my_chat_member: botAdded({ chatId: CHAT }),
};

describe('chatIdOf', () => {
	it.each(ALLOWED_UPDATES)('finds the chat of a %s update', (type) => {
		expect(chatIdOf(EXAMPLES[type])).toBe(CHAT);
	});

	it('finds none in an update type the webhook does not ask for', () => {
		const update: Update = {
			update_id: 1,
			inline_query: { id: '1', from: users.taras, query: '', offset: '' },
		};

		expect(chatIdOf(update)).toBeUndefined();
	});

	it('finds none in a tap on an inline message, which has no chat', () => {
		const update: Update = {
			update_id: 1,
			callback_query: {
				id: '1',
				from: users.taras,
				chat_instance: 'x',
				inline_message_id: 'inline',
				data: 'x',
			},
		};

		expect(chatIdOf(update)).toBeUndefined();
	});
});

describe('isInChat', () => {
	it.each<[ChatMember['status'], boolean]>([
		['creator', true],
		['administrator', true],
		['member', true],
		['left', false],
		['kicked', false],
	])('counts a %s as in the chat: %s', (status, expected) => {
		expect(isInChat(chatMember(users.oleg, status))).toBe(expected);
	});

	it('counts a restricted member only while they are still a member', () => {
		expect(isInChat(chatMember(users.oleg, 'restricted', { isMember: true }))).toBe(true);
		expect(isInChat(chatMember(users.oleg, 'restricted', { isMember: false }))).toBe(false);
	});
});

describe('personSending', () => {
	it('is the person who sent a message', () => {
		expect(personSending(textMessage('привіт', { from: users.oleg }))).toEqual(users.oleg);
	});

	it('is the person who tapped a button', () => {
		expect(personSending(tap('hi', { from: users.oleg }))).toEqual(users.oleg);
	});

	it.each<[string, Update]>([
		['a message from a bot', textMessage('x', { from: users.otherBot })],
		['a tap by a bot', tap('hi', { from: users.otherBot })],
		['a message sent on behalf of a chat', textMessage('x', { senderChat: CHANNEL })],
		[
			"a linked channel's forward, whose sender isn't a bot",
			textMessage('x', { from: TELEGRAM, senderChat: CHANNEL }),
		],
		['an update that is neither', memberChange(users.oleg, { from: 'left', to: 'member' })],
	])('is nobody for %s', (_case, update) => {
		expect(personSending(update)).toBeUndefined();
	});
});
