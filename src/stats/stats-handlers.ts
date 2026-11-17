import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { monthName, monthWindow } from '../kyiv-time';
import { replyingTo } from '../telegram';
import { statsText } from './stats-format';
import { readStats } from './stats-queries';

/** `/stats`: the boards for this Kyiv month and all time. It counts nothing itself. */
export const showStats = new Composer<BotContext>();

showStats.command('stats', async (ctx) => {
	if (ctx.room.stale) return;
	const now = ctx.room.clock();
	const stats = ctx.room.read((sql) => readStats(sql, monthWindow(now)));
	// Nothing has committed, so a failed reply is the failure policy's to judge.
	await ctx.reply(statsText(stats, monthName(now)), replyingTo(ctx.msg.message_id));
});
