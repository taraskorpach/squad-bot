import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
	parseAllowedChatId,
	parseBotInfo,
	parseMentionChunk,
	readRoomSettings,
} from '../src/settings';

describe('parseAllowedChatId', () => {
	it('reads a supergroup id', () => {
		expect(parseAllowedChatId('-1001234567890')).toBe(-1001234567890);
	});

	it.each(['', ' ', 'chat', '-100.5', '1e9', '-100123 ', '0x10'])(
		'refuses %j, naming the setting but not its value',
		(raw) => {
			expect(() => parseAllowedChatId(raw)).toThrow(
				new Error('ALLOWED_CHAT_ID must be an integer chat id'),
			);
		},
	);
});

describe('parseBotInfo', () => {
	const BOT = { id: 42, is_bot: true, first_name: 'Squad', username: 'squad_bot' };

	it('reads the JSON of getMe', () => {
		expect(parseBotInfo(JSON.stringify(BOT))).toEqual(BOT);
	});

	it.each([
		['text that is not JSON', 'squad_bot'],
		['a user that is not a bot', JSON.stringify({ ...BOT, is_bot: false })],
		['a bot without a username', JSON.stringify({ ...BOT, username: undefined })],
		['a bot without an id', JSON.stringify({ ...BOT, id: '42' })],
	])('refuses %s', (_case, raw) => {
		expect(() => parseBotInfo(raw)).toThrow(new Error('BOT_INFO must be the JSON of getMe'));
	});
});

describe('parseMentionChunk', () => {
	it('reads how many mentions go in one message', () => {
		expect(parseMentionChunk('5')).toBe(5);
		expect(parseMentionChunk('1')).toBe(1);
	});

	it.each(['', '0', '-1', '2.5', ' 5', 'five', '1e1'])('refuses %j', (raw) => {
		expect(() => parseMentionChunk(raw)).toThrow(
			new Error('MENTION_CHUNK must be an integer of at least 1'),
		);
	});
});

describe('readRoomSettings', () => {
	it('reads the chat id, the bot and the mention chunk from the environment', () => {
		expect(readRoomSettings(env)).toEqual({
			allowedChatId: Number(env.ALLOWED_CHAT_ID),
			botInfo: JSON.parse(env.BOT_INFO),
			mentionChunk: 5,
		});
	});
});
