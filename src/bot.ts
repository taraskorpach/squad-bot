import { autoRetry } from '@grammyjs/auto-retry';
import { Bot, type Middleware, type Transformer } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { Timers } from './chat/room';
import type { BotContext, UpdateRoom } from './context';
import { artemIsAlwaysRight } from './jokes/always-right';
import { tagAll } from './members/all-handlers';
import { learningMembers } from './members/member-handlers';
import { welcoming } from './members/welcome-handlers';
import { runDueTimers } from './pools/pool-alarm';
import { poolTaps } from './pools/pool-callbacks';
import { pooling } from './pools/pool-handlers';
import { poolMenu } from './pools/pool-menu-taps';
import { openPools } from './pools/pool-store';
import { nextDue } from './pools/pool-timers';
import { trackShares } from './shares/share-handlers';
import { countDomikpisik } from './stats/domikpisik-handlers';
import { showStats } from './stats/stats-handlers';
import { API_TIMEOUT_SECONDS, personSending, sentAt } from './telegram';

/** Every feature, in the order an update meets them. Shares come first: a command can carry a post. */
export const FEATURES: readonly Middleware<BotContext>[] = [
	trackShares,
	welcoming,
	tagAll,
	countDomikpisik,
	artemIsAlwaysRight,
	showStats,
	pooling,
	poolMenu,
	poolTaps,
];

/** The object's alarm. The open pools are its whole schedule, so chat/ imports no feature. */
export const TIMERS: Timers = {
	nextDue: (sql, now) => nextDue(openPools(sql), now),
	run: runDueTimers,
};

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
	bot.use(
		attachingRoom(options.currentRoom),
		learningMembers,
		ignoringBotsAndChannels,
		flaggingStale,
	);
	bot.use(...options.features);
	// Last, for a tap no feature answered: without an answer its button keeps spinning.
	bot.on('callback_query', (ctx) => ctx.answerCallbackQuery());
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
	const isMessageOrTap = ctx.message !== undefined || ctx.callbackQuery !== undefined;
	if (isMessageOrTap && !personSending(ctx.update)) return;
	return next();
};

/** Features count a stale message where they count, and do nothing else with it. */
const flaggingStale: Middleware<BotContext> = (ctx, next) => {
	if (ctx.message && ctx.room.clock() - sentAt(ctx.message) > STALE_AFTER_MS) {
		ctx.room.markStale();
	}
	return next();
};
