import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { replyingTo, sentAt } from '../telegram';
import { openPool } from './pool-actions';
import { parsePoolArgs, startOf } from './pool-args';
import { argsErrorText } from './pool-messages';

/** `/pool [гра] [розмір] [час]` opens a pool. */
export const pooling = new Composer<BotContext>();

pooling.command('pool', async (ctx) => {
	const author = ctx.from;
	if (!author || ctx.room.stale) return;
	const parsed = parsePoolArgs(ctx.match);
	if (!parsed.ok) {
		// Nothing has committed yet, so a failed reply is the failure policy's to judge.
		await ctx.reply(argsErrorText(parsed.error), replyingTo(ctx.msg.message_id));
		return;
	}
	const { game, size, time } = parsed.args;
	const openedAt = sentAt(ctx.msg);
	await openPool(ctx.room, {
		game,
		size,
		authorId: author.id,
		openedAt,
		startsAt: time && startOf(time, openedAt),
		commandId: ctx.msg.message_id,
	});
});
