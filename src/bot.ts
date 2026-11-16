import { Bot, type Middleware } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { BotContext, UpdateRoom } from './context';

/** Every feature, in the order an update meets them. */
export const FEATURES: readonly Middleware<BotContext>[] = [];

export interface BotOptions {
	token: string;
	botInfo: UserFromGetMe;
	features: readonly Middleware<BotContext>[];
	/** The room of the update being processed: the object's serial queue keeps it to one. */
	currentRoom: () => UpdateRoom;
}

export function createBot(options: BotOptions): Bot<BotContext> {
	const bot = new Bot<BotContext>(options.token, { botInfo: options.botInfo });
	bot.use((ctx, next) => {
		ctx.room = options.currentRoom();
		return next();
	});
	bot.use(...options.features);
	return bot;
}
