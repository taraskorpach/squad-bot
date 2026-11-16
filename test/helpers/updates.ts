import { env } from 'cloudflare:workers';
import type { Chat, ChatMember, Message, Update, User, UserFromGetMe } from 'grammy/types';

export const BOT: UserFromGetMe = JSON.parse(env.BOT_INFO);
export const CHAT_ID = Number(env.ALLOWED_CHAT_ID);

const BOT_USER: User = {
	id: BOT.id,
	is_bot: true,
	first_name: BOT.first_name,
	username: BOT.username,
};

/** The seven people of the chat, and a bot that isn't ours. */
export const users = {
	taras: { id: 1001, is_bot: false, first_name: 'Тарас', username: 'taras' },
	oleg: { id: 1002, is_bot: false, first_name: 'Олег' },
	andriy: { id: 1003, is_bot: false, first_name: 'Андрій', last_name: 'Коваль' },
	ihor: { id: 1004, is_bot: false, first_name: 'Ігор' },
	maks: { id: 1005, is_bot: false, first_name: 'Макс', username: 'maks' },
	dima: { id: 1006, is_bot: false, first_name: 'Діма' },
	sasha: { id: 1007, is_bot: false, first_name: 'Саша' },
	otherBot: { id: 9001, is_bot: true, first_name: 'Other', username: 'other_bot' },
} satisfies Record<string, User>;

/** A channel posting into the group through its identity, as anonymous admins and channels do. */
export const CHANNEL: Chat.ChannelChat = { id: -1009999999999, type: 'channel', title: 'Канал' };

/** Telegram's own account: the `from` of a linked channel's automatic forwards, and not a bot. */
export const TELEGRAM: User = { id: 777000, is_bot: false, first_name: 'Telegram' };

let lastId = 0;
const nextId = (): number => ++lastId;
const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export interface MessageOptions {
	chatId?: number;
	from?: User;
	/** Unix seconds, as Telegram sends it; defaults to now. */
	date?: number;
	/**
	 * Sent on behalf of this chat. `from` stays a person, as on a linked channel's forwards (sent by
	 * Telegram's non-bot account), so a test sees the `sender_chat` check, not the bot check.
	 */
	senderChat?: Chat;
}

type GroupMessage = Message & Update.NonChannel;

function groupMessage(fields: Partial<GroupMessage>, options: MessageOptions): GroupMessage {
	return {
		message_id: nextId(),
		date: options.date ?? nowSeconds(),
		chat: supergroup(options.chatId ?? CHAT_ID),
		from: options.from ?? users.taras,
		...(options.senderChat && { sender_chat: options.senderChat }),
		...fields,
	};
}

function supergroup(id: number): Chat.SupergroupChat {
	return { id, type: 'supergroup', title: 'Squad' };
}

export function textMessage(text: string, options: MessageOptions = {}): Update {
	return { update_id: nextId(), message: groupMessage({ text }, options) };
}

/** `/cmd`, `/cmd@bot` or `/cmd args`, with the `bot_command` entity Telegram adds. */
export function command(text: string, options: MessageOptions = {}): Update {
	const length = text.split(/\s/, 1)[0]?.length ?? text.length;
	const entities = [{ type: 'bot_command' as const, offset: 0, length }];
	return { update_id: nextId(), message: groupMessage({ text, entities }, options) };
}

export function migrationMessage(toChatId: number, options: MessageOptions = {}): Update {
	return serviceMessage({ migrate_to_chat_id: toChatId }, options);
}

/** A message that reports something instead of saying it: a new title, a pin, a join. */
export function serviceMessage(
	fields: Partial<GroupMessage>,
	options: MessageOptions = {},
): Update {
	return { update_id: nextId(), message: groupMessage(fields, options) };
}

/** "X joined": sent by the one who joined, or by whoever added them. */
export function joinMessage(joined: User[], options: MessageOptions = {}): Update {
	const from = options.from ?? joined[0];
	return serviceMessage({ new_chat_members: joined }, { ...options, from });
}

/** "X left": sent by the one who left, or by the admin who removed them. */
export function leaveMessage(left: User, options: MessageOptions = {}): Update {
	return serviceMessage({ left_chat_member: left }, { ...options, from: options.from ?? left });
}

export interface TapOptions {
	from?: User;
	chatId?: number;
	/** The id of the bot's message that carries the button. */
	messageId?: number;
}

export function tap(data: string, options: TapOptions = {}): Update {
	return {
		update_id: nextId(),
		callback_query: {
			id: String(nextId()),
			from: options.from ?? users.taras,
			chat_instance: 'test-chat-instance',
			data,
			message: {
				message_id: options.messageId ?? nextId(),
				date: nowSeconds(),
				chat: supergroup(options.chatId ?? CHAT_ID),
				from: BOT_USER,
				text: 'card',
			},
		},
	};
}

type MemberStatus = ChatMember['status'];
type StatusChange = { from: MemberStatus; to: MemberStatus };

export interface ChangeOptions {
	chatId?: number;
	chat?: Chat;
	by?: User;
}

/** A `chat_member` update: someone's status changed from one to the other. */
export function memberChange(
	user: User,
	change: StatusChange,
	options: ChangeOptions = {},
): Update {
	return { update_id: nextId(), chat_member: memberUpdated(user, change, options) };
}

/** A `my_chat_member` update: the bot's own status changed. */
export function botChange(change: StatusChange, options: ChangeOptions = {}): Update {
	return { update_id: nextId(), my_chat_member: memberUpdated(BOT_USER, change, options) };
}

/** The bot added to a group as a pin-only admin. */
export function botAdded(options: ChangeOptions = {}): Update {
	return botChange({ from: 'left', to: 'administrator' }, options);
}

function memberUpdated(user: User, change: StatusChange, options: ChangeOptions) {
	return {
		chat: options.chat ?? supergroup(options.chatId ?? CHAT_ID),
		from: options.by ?? users.taras,
		date: nowSeconds(),
		old_chat_member: chatMember(user, change.from),
		new_chat_member: chatMember(user, change.to),
	};
}

export function chatMember(
	user: User,
	status: MemberStatus,
	options: { isMember?: boolean } = {},
): ChatMember {
	switch (status) {
		case 'creator':
			return { status, user, is_anonymous: false };
		case 'administrator':
			return { status, user, ...PIN_ONLY_ADMIN };
		case 'member':
			return { status, user };
		case 'restricted':
			return { status, user, is_member: options.isMember ?? true, ...NO_RIGHTS, until_date: 0 };
		case 'left':
			return { status, user };
		case 'kicked':
			return { status, user, until_date: 0 };
	}
}

const PIN_ONLY_ADMIN = {
	can_be_edited: false,
	is_anonymous: false,
	can_manage_chat: true,
	can_delete_messages: false,
	can_manage_video_chats: false,
	can_restrict_members: false,
	can_promote_members: false,
	can_change_info: false,
	can_invite_users: false,
	can_post_stories: false,
	can_edit_stories: false,
	can_delete_stories: false,
	can_send_welcome_messages: false,
	can_pin_messages: true,
};

const NO_RIGHTS = {
	can_send_messages: false,
	can_send_audios: false,
	can_send_documents: false,
	can_send_photos: false,
	can_send_videos: false,
	can_send_video_notes: false,
	can_send_voice_notes: false,
	can_send_polls: false,
	can_send_other_messages: false,
	can_add_web_page_previews: false,
	can_react_to_messages: false,
	can_change_info: false,
	can_invite_users: false,
	can_edit_tag: false,
	can_pin_messages: false,
	can_manage_topics: false,
};
