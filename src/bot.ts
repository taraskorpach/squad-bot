import { autoRetry } from '@grammyjs/auto-retry';
import { Bot, type Middleware, type Transformer } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { BotContext, UpdateRoom } from './context';
import { API_TIMEOUT_SECONDS } from './telegram';

/** Every feature, in the order an update meets them. */
export const FEATURES: readonly Middleware<BotContext>[] = [];

/**
 * Capped: unbounded defaults would hold the chat's queue and sleep past the webhook.
 * Without `rethrowHttpErrors`, network errors back off for up to an hour, uncounted.
 */
const RETRY_LIMITS = {
	maxRetryAttempts: 2,
	maxDelaySeconds: 5,
	rethrowInternalServerErrors: true,
	rethrowHttpErrors: true,
};

/** After an outage Telegram replays queued messages; acting on them late would wake people. */
const STALE_AFTER_MS = 10 * 60 * 1000;

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
	const bot = new Bot<BotContext>(options.token, {
		botInfo: options.botInfo,
		client: { timeoutSeconds: API_TIMEOUT_SECONDS },
	});
	bot.api.config.use(autoRetry(RETRY_LIMITS));
	// Installed last, so it is the outermost transformer and sees each call's final result.
	bot.api.config.use(markingDelivered(options.onDelivered));
	bot.use(attachingRoom(options.currentRoom), ignoringBotsAndChannels, flaggingStale);
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

function attachingRoom(currentRoom: () => UpdateRoom): Middleware<BotContext> {
	return (ctx, next) => {
		ctx.room = currentRoom();
		return next();
	};
}

/** Messages and taps from bots, anonymous admins and channel identities stop here. */
const ignoringBotsAndChannels: Middleware<BotContext> = (ctx, next) => {
	const sender = ctx.message?.from ?? ctx.callbackQuery?.from;
	if (sender?.is_bot || ctx.message?.sender_chat) return;
	return next();
};

/** Features count a stale message where they count, and do nothing else with it. */
const flaggingStale: Middleware<BotContext> = (ctx, next) => {
	const sentAt = ctx.message?.date;
	if (sentAt !== undefined && ctx.room.clock() - sentAt * 1000 > STALE_AFTER_MS) {
		ctx.room.markStale();
	}
	return next();
};
