import type { UserFromGetMe } from 'grammy/types';

// The values are secrets: errors name the setting, never its value.

export interface RoomSettings {
	allowedChatId: number;
	botInfo: UserFromGetMe;
	/** How many mentions go in one message. */
	mentionChunk: number;
}

export function readRoomSettings(
	env: Pick<Env, 'ALLOWED_CHAT_ID' | 'BOT_INFO' | 'MENTION_CHUNK'>,
): RoomSettings {
	return {
		allowedChatId: parseAllowedChatId(env.ALLOWED_CHAT_ID),
		botInfo: parseBotInfo(env.BOT_INFO),
		mentionChunk: parseMentionChunk(env.MENTION_CHUNK),
	};
}

export function parseAllowedChatId(raw: string): number {
	const chatId = Number(raw);
	if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(chatId)) {
		throw new Error('ALLOWED_CHAT_ID must be an integer chat id');
	}
	return chatId;
}

export function parseMentionChunk(raw: string): number {
	const size = Number(raw);
	if (!/^\d+$/.test(raw) || !Number.isSafeInteger(size) || size < 1) {
		throw new Error('MENTION_CHUNK must be an integer of at least 1');
	}
	return size;
}

export function parseBotInfo(raw: string): UserFromGetMe {
	const botInfo = parseJson(raw);
	if (!isBotInfo(botInfo)) throw new Error('BOT_INFO must be the JSON of getMe');
	return botInfo;
}

function parseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

function isBotInfo(value: unknown): value is UserFromGetMe {
	if (typeof value !== 'object' || value === null) return false;
	const { id, is_bot, username } = value as Record<string, unknown>;
	return typeof id === 'number' && is_bot === true && typeof username === 'string';
}
