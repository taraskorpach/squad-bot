import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { sentAt } from '../telegram';
import { recordEvent } from './event-store';

/** `/domikpisik`: a running joke, counted for the stats and never answered. */
export const countDomikpisik = new Composer<BotContext>();

countDomikpisik.command('domikpisik', (ctx) => {
	const caller = ctx.from;
	if (!caller) return;
	ctx.room.commit((sql) => {
		recordEvent(sql, { kind: 'domikpisik', userId: caller.id, at: sentAt(ctx.msg) });
	});
});
