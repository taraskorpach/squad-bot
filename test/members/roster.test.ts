import type { Update, User } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import { type Member, presencesOf, tagTargets } from '../../src/members/roster';
import {
	botAdded,
	CHANNEL,
	joinMessage,
	leaveMessage,
	memberChange,
	serviceMessage,
	TELEGRAM,
	tap,
	textMessage,
	users,
} from '../helpers/updates';

function member(user: User): Member {
	return {
		id: user.id,
		firstName: user.first_name,
		lastName: user.last_name,
		username: user.username,
	};
}

describe('presencesOf', () => {
	it('marks the sender of an ordinary message in, with the names they have now', () => {
		const renamed = { ...users.andriy, first_name: 'Андрюха', username: 'andriy' };

		expect(presencesOf(textMessage('привіт', { from: renamed }))).toEqual([
			{
				member: {
					id: users.andriy.id,
					firstName: 'Андрюха',
					lastName: 'Коваль',
					username: 'andriy',
				},
				inChat: true,
			},
		]);
	});

	it('marks whoever taps a button in', () => {
		expect(presencesOf(tap('hi', { from: users.oleg }))).toEqual([
			{ member: member(users.oleg), inChat: true },
		]);
	});

	it.each<[string, Update]>([
		['a message from a bot', textMessage('x', { from: users.otherBot })],
		['a tap by a bot', tap('hi', { from: users.otherBot })],
		['a message sent on behalf of a chat', textMessage('x', { senderChat: CHANNEL })],
		["a linked channel's forward", textMessage('x', { from: TELEGRAM, senderChat: CHANNEL })],
		['a service message from someone in the chat', serviceMessage({ new_chat_title: 'Сквад' })],
		['the bot being added', botAdded()],
	])('sees nobody in %s', (_case, update) => {
		expect(presencesOf(update)).toEqual([]);
	});

	it('marks the people a join names in, but not who added them, and no bots', () => {
		const added = joinMessage([users.oleg, users.otherBot, users.ihor], { from: users.taras });

		expect(presencesOf(added)).toEqual([
			{ member: member(users.oleg), inChat: true },
			{ member: member(users.ihor), inChat: true },
		]);
	});

	it("marks a leaver out: their own 'left' message, sent by them, is no sighting", () => {
		expect(presencesOf(leaveMessage(users.oleg))).toEqual([
			{ member: member(users.oleg), inChat: false },
		]);
	});

	it('marks someone an admin removed out, and the admin who sent it is no sighting', () => {
		expect(presencesOf(leaveMessage(users.oleg, { from: users.taras }))).toEqual([
			{ member: member(users.oleg), inChat: false },
		]);
	});

	it.each([
		['joins', 'left', 'member', true],
		['leaves', 'member', 'left', false],
		['is banned', 'member', 'kicked', false],
		['is made an admin', 'member', 'administrator', true],
	] as const)('follows chat_member: someone who %s is in: %s', (_case, from, to, inChat) => {
		expect(presencesOf(memberChange(users.oleg, { from, to }))).toEqual([
			{ member: member(users.oleg), inChat },
		]);
	});

	it('ignores a chat_member change of a bot', () => {
		expect(presencesOf(memberChange(users.otherBot, { from: 'left', to: 'member' }))).toEqual([]);
	});
});

describe('tagTargets', () => {
	const inChat = [member(users.taras), member(users.oleg), member(users.andriy)];

	it('is everyone in the chat but the caller', () => {
		expect(tagTargets(inChat, users.taras.id)).toEqual([member(users.oleg), member(users.andriy)]);
	});

	it('is nobody when the caller is the only one known', () => {
		expect(tagTargets([member(users.taras)], users.taras.id)).toEqual([]);
	});
});
