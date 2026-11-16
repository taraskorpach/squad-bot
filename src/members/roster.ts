import type { ChatMemberUpdated, Message, Update, User } from 'grammy/types';
import { isInChat, personSending } from '../telegram';

/** A person the bot knows of. Bots never are. */
export interface Member {
	id: number;
	firstName: string;
	lastName?: string;
	username?: string;
}

/** What an update says about one member: in the chat now, or not. */
export interface Presence {
	member: Member;
	inChat: boolean;
}

/**
 * What a person can post, after grammY's message types built on `CommonMessage`. A message with
 * none of it is a service message. Listing content rather than service kinds means a kind
 * Telegram adds later can only delay learning someone, never bring a non-member in.
 */
const CONTENT_KINDS = [
	'text',
	'rich_message',
	'animation',
	'audio',
	'document',
	'live_photo',
	'paid_media',
	'photo',
	'sticker',
	'story',
	'video',
	'video_note',
	'voice',
	'contact',
	'dice',
	'game',
	'poll',
	'venue',
	'location',
	'checklist',
] as const satisfies readonly (keyof Message)[];

/**
 * Who an update shows in or out of the chat. A member's `chat_member` update and their service
 * message arrive on different queues, so the two say the same thing whichever comes first, and
 * a service message is never a sighting of its sender: a leaver sends their own "left" message.
 */
export function presencesOf(update: Update): Presence[] {
	if (update.chat_member) return statusChange(update.chat_member);
	const { message } = update;
	if (message?.new_chat_members) return presences(message.new_chat_members, true);
	if (message?.left_chat_member) return presences([message.left_chat_member], false);
	if (message && !isOrdinary(message)) return [];
	const sender = personSending(update);
	return sender ? presences([sender], true) : [];
}

/** Whom `/all` tags: everyone in the chat but the caller. */
export function tagTargets(inChat: readonly Member[], callerId: number): Member[] {
	return inChat.filter((member) => member.id !== callerId);
}

function statusChange({ new_chat_member: status }: ChatMemberUpdated): Presence[] {
	return presences([status.user], isInChat(status));
}

function presences(people: readonly User[], inChat: boolean): Presence[] {
	return people.filter((user) => !user.is_bot).map((user) => ({ member: memberOf(user), inChat }));
}

function memberOf(user: User): Member {
	return {
		id: user.id,
		firstName: user.first_name,
		lastName: user.last_name,
		username: user.username,
	};
}

function isOrdinary(message: Message): boolean {
	return CONTENT_KINDS.some((kind) => message[kind] !== undefined);
}
