import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { replyingTo } from '../telegram';
import { statsText } from './stats-format';
import { readStats } from './stats-queries';

/** `/stats`: the all-time boards. It counts nothing itself. */
export const showStats = new Composer<BotContext>();

showStats.command('stats', async (ctx) => {
	if (ctx.room.stale) return;
	const stats = ctx.room.read((sql) => readStats(sql));
	// Nothing has committed, so a failed reply is the failure policy's to judge.
	await ctx.reply(statsText(stats), replyingTo(ctx.msg.message_id));
});
