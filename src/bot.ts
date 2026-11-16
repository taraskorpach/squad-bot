import { Bot, type Middleware, type Transformer } from 'grammy';
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
	/** Called after every successful Telegram call, by `ctx.api` and the room's `api` alike. */
	onDelivered: () => void;
}

export function createBot(options: BotOptions): Bot<BotContext> {
	const bot = new Bot<BotContext>(options.token, { botInfo: options.botInfo });
	// Installed last, so it is the outermost transformer and sees each call's final result.
	bot.api.config.use(markingDelivered(options.onDelivered));
	bot.use((ctx, next) => {
		ctx.room = options.currentRoom();
		return next();
	});
	bot.use(...options.features);
	return bot;
}

function markingDelivered(onDelivered: () => void): Transformer {
	return async (prev, method, payload, signal) => {
		const result = await prev(method, payload, signal);
		if (result.ok) onDelivered();
		return result;
	};
}
