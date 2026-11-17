import { Composer } from 'grammy';
import { attempt } from '../chat/attempt';
import type { BotContext } from '../context';
import { replyingTo, sentAt } from '../telegram';
import { texts } from '../texts';
import { answersOf } from './answer-store';
import { applyAnswer, openPool, showAnswer } from './pool-actions';
import { parsePoolArgs, startOf } from './pool-args';
import { argsErrorText, openPoolsText } from './pool-messages';
import { joinTarget, lineupOf } from './pool-rules';
import { newestOpenPool, openPools, poolOfMessage } from './pool-store';

/**
 * `/pool [гра] [розмір] [час]` opens a pool; `/join` answers Граю without a tap; `/pools` lists
 * the open ones.
 */
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

pooling.command('join', async (ctx) => {
	const joiner = ctx.from;
	if (!joiner || ctx.room.stale) return;
	const replyId = ctx.msg.reply_to_message?.message_id;
	const target = ctx.room.read((sql) =>
		joinTarget(
			replyId === undefined ? undefined : poolOfMessage(sql, replyId),
			newestOpenPool(sql),
		),
	);
	if (target.kind !== 'pool') {
		const { closedPool, noOpenPool } = texts.pool.replies;
		const reply = target.kind === 'closed' ? closedPool : noOpenPool;
		await ctx.reply(reply, replyingTo(ctx.msg.message_id));
		return;
	}
	const result = applyAnswer(ctx.room, target.poolId, joiner.id, 'play', sentAt(ctx.msg));
	if (result.kind !== 'answered') return;
	// The card shows the result; a reaction answers without another message.
	await attempt('pools: the 👌 for /join', () => ctx.react('👌'));
	await showAnswer(ctx.room, target.poolId, result.decision);
});

pooling.command('pools', async (ctx) => {
	if (ctx.room.stale) return;
	const listed = ctx.room.read((sql) =>
		openPools(sql).map((pool) => {
			const { players, bench } = lineupOf(pool.size, answersOf(sql, pool.id), []);
			return { pool, players: players.length, bench: bench.length };
		}),
	);
	const text = openPoolsText(listed, ctx.room.chatId, ctx.room.clock());
	await ctx.reply(text, replyingTo(ctx.msg.message_id));
});
