import type { Middleware } from 'grammy';
import type { BotContext } from '../context';
import { savePresences } from './member-store';
import { presencesOf } from './roster';

/**
 * Learns who is in the chat from every update, before the gate and the features see it. The
 * write is idempotent, so it never keeps a failed update from being redelivered.
 */
export const learningMembers: Middleware<BotContext> = (ctx, next) => {
	const presences = presencesOf(ctx.update);
	if (presences.length > 0) {
		ctx.room.write((sql) => savePresences(sql, presences, ctx.room.clock()));
	}
	return next();
};
