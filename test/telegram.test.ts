import type { Chat, ChatMember, Update } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import {
	ALLOWED_UPDATES,
	type AllowedUpdate,
	chatOf,
	isAdmin,
	isGroup,
	isInChat,
	personSending,
	sentAt,
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
const group: Chat.GroupChat = { id: -4001, type: 'group', title: 'Стара група' };
const supergroup: Chat.SupergroupChat = { id: -1004001, type: 'supergroup', title: 'Squad' };

// A Record, so adding a type to ALLOWED_UPDATES without an example fails to compile.
const EXAMPLES: Record<AllowedUpdate, Update> = {
	message: command('/all', { chatId: CHAT }),
	callback_query: tap('p:1:in', { chatId: CHAT }),
	chat_member: memberChange(users.oleg, { from: 'left', to: 'member' }, { chatId: CHAT }),
	my_chat_member: botAdded({ chatId: CHAT }),
};

describe('chatOf', () => {
	it.each(ALLOWED_UPDATES)('finds the chat of a %s update', (type) => {
		expect(chatOf(EXAMPLES[type])?.id).toBe(CHAT);
	});

	it.each<[string, Update, Chat]>([
		[
			'an edited message',
			{
				update_id: 1,
				edited_message: {
					message_id: 1,
					date: 0,
					edit_date: 1,
					chat: group,
					from: users.taras,
					text: 'x',
				},
			},
			group,
		],
		[
			'a join request',
			{
				update_id: 1,
				chat_join_request: {
					chat: supergroup,
					from: users.oleg,
					user_chat_id: users.oleg.id,
					date: 0,
				},
			},
			supergroup,
		],
		[
			'a reaction',
			{
				update_id: 1,
				message_reaction: {
					chat: group,
					message_id: 1,
					date: 0,
					old_reaction: [],
					new_reaction: [],
				},
			},
			group,
		],
	])('finds the chat of %s, which the webhook does not ask for', (_case, update, chat) => {
		expect(chatOf(update)).toEqual(chat);
	});

	it('finds none in an update that has no chat', () => {
		const update: Update = {
			update_id: 1,
			inline_query: { id: '1', from: users.taras, query: '', offset: '' },
		};

		expect(chatOf(update)).toBeUndefined();
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

		expect(chatOf(update)).toBeUndefined();
	});
});

describe('isGroup', () => {
	it.each<[string, Chat, boolean]>([
		['a group', group, true],
		['a supergroup', supergroup, true],
		['a private chat', { id: users.oleg.id, type: 'private', first_name: 'Олег' }, false],
		['a channel', CHANNEL, false],
	])('counts %s as a group: %s', (_case, chat, expected) => {
		expect(isGroup(chat)).toBe(expected);
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

describe('isAdmin', () => {
	it.each<[ChatMember['status'], boolean]>([
		['creator', true],
		['administrator', true],
		['member', false],
		['restricted', false],
		['left', false],
		['kicked', false],
	])('counts a %s as an admin: %s', (status, expected) => {
		expect(isAdmin(chatMember(users.oleg, status))).toBe(expected);
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

describe('sentAt', () => {
	it('is when Telegram says the message was sent, in epoch milliseconds', () => {
		expect(sentAt({ date: 1_794_860_000 })).toBe(1_794_860_000_000);
	});
});
