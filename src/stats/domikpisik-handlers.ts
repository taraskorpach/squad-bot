import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { sentAt } from '../telegram';
import { hasEventNear, recordEvent } from './event-store';

/** A repeat from the same person within this long of a counted one isn't counted (Taras). */
const COOLDOWN_MS = 60 * 1000;

/**
 * `/domikpisik`: a running joke, counted for the stats and never answered. Each person counts at
 * most once a minute, judged by when they sent it, so a burst can't inflate the board.
 */
export const countDomikpisik = new Composer<BotContext>();

countDomikpisik.command('domikpisik', (ctx) => {
	const caller = ctx.from;
	if (!caller) return;
	const at = sentAt(ctx.msg);
	ctx.room.commit((sql) => {
		if (hasEventNear(sql, { kind: 'domikpisik', userId: caller.id, at }, COOLDOWN_MS)) return;
		recordEvent(sql, { kind: 'domikpisik', userId: caller.id, at });
	});
});
