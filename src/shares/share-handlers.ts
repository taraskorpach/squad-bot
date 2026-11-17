import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { recordEvent } from '../stats/event-store';
import { sentAt } from '../telegram';
import { postRefs } from './share-links';

/**
 * Posts sent to the chat from Instagram, Threads, TikTok and YouTube, each recorded for whoever
 * sent it. A command can carry a post too, so the command runs first and the posts are recorded
 * after it: a command that fails leaves none of them written, and its redelivery counts them once.
 */
export const trackShares = new Composer<BotContext>();

trackShares.on(['::url', '::text_link'], async (ctx, next) => {
	const refs = postRefs(linksOf(ctx));
	await next();
	const sender = ctx.from;
	if (!sender || refs.length === 0) return;
	const share = { userId: sender.id, messageId: ctx.msg.message_id, at: sentAt(ctx.msg) };
	ctx.room.commit((sql) => {
		for (const ref of refs) recordEvent(sql, { kind: 'share', ref, ...share });
	});
});

/** A message's links: what its `url` entities show, and where its `text_link` entities lead. */
function linksOf(ctx: BotContext): string[] {
	return ctx
		.entities(['url', 'text_link'])
		.map((entity) => (entity.type === 'text_link' ? entity.url : entity.text));
}
