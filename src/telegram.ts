// Telegram shapes shared with the setup script: keep this module free of runtime imports.
import type { ChatMember, Update, User } from 'grammy/types';

export const WEBHOOK_PATH = '/webhook';

/** The update types the webhook asks for. Each must carry a chat id that `chatIdOf` finds. */
export const ALLOWED_UPDATES = [
	'message',
	'callback_query',
	'chat_member',
	'my_chat_member',
] as const;

export type AllowedUpdate = (typeof ALLOWED_UPDATES)[number];

/** The welcome's 👋 button. Pool buttons carry `p:{pool}:{action}`. */
export const HI_CALLBACK = 'hi';

/** grammY's default of 500 s would let one hung call hold the chat's queue for minutes. */
export const API_TIMEOUT_SECONDS = 10;

/** How the bot sends every message: HTML, which mentions need, and no link previews. */
export const MESSAGE_FORMAT = {
	parse_mode: 'HTML',
	link_preview_options: { is_disabled: true },
} as const;

export function chatIdOf(update: Update): number | undefined {
	return (
		update.message?.chat.id ??
		update.callback_query?.message?.chat.id ??
		update.chat_member?.chat.id ??
		update.my_chat_member?.chat.id
	);
}

/**
 * The person behind a message or a tap. Nobody for a bot, nor for a message sent on behalf of a
 * chat (anonymous admins, channels): its `from` is a stand-in, and for a linked channel's
 * forwards that stand-in is Telegram's own account, which isn't marked as a bot.
 */
export function personSending(update: Update): User | undefined {
	const { message, callback_query: tap } = update;
	if (message?.sender_chat) return undefined;
	const sender = message?.from ?? tap?.from;
	return sender?.is_bot ? undefined : sender;
}

/** When a message was sent, in epoch milliseconds: Telegram dates messages in whole seconds. */
export function sentAt(message: { date: number }): number {
	return message.date * 1000;
}

/** "Added" means false before and true after; the Worker and the welcome use the same test. */
export function isInChat(member: ChatMember): boolean {
	switch (member.status) {
		case 'creator':
		case 'administrator':
		case 'member':
			return true;
		case 'restricted':
			return member.is_member;
		case 'left':
		case 'kicked':
			return false;
	}
}
