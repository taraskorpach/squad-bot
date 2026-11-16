// Telegram shapes shared with the setup script: keep this module free of runtime imports.
import type { ChatMember, Update } from 'grammy/types';

export const WEBHOOK_PATH = '/webhook';

/** The update types the webhook asks for. Each must carry a chat id that `chatIdOf` finds. */
export const ALLOWED_UPDATES = [
	'message',
	'callback_query',
	'chat_member',
	'my_chat_member',
] as const;

export type AllowedUpdate = (typeof ALLOWED_UPDATES)[number];

/** grammY's default of 500 s would let one hung call hold the chat's queue for minutes. */
export const API_TIMEOUT_SECONDS = 10;

export function chatIdOf(update: Update): number | undefined {
	return (
		update.message?.chat.id ??
		update.callback_query?.message?.chat.id ??
		update.chat_member?.chat.id ??
		update.my_chat_member?.chat.id
	);
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
