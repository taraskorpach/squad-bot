import { Composer } from 'grammy';
import { attempt } from '../chat/attempt';
import type { BotContext } from '../context';
import { knownMembers } from '../members/member-store';
import { displayNames } from '../members/mentions';
import { firstEventAbout, recordEvent, type StatEvent } from '../stats/event-store';
import { replyingTo, sentAt } from '../telegram';
import { bayanText } from './share-format';
import { postRefs } from './share-links';

/** What the chat had seen of a message's posts before it, read in the commit that records them. */
interface Seen {
	/** The first share of each post the chat had seen before this message. */
	firstShares: StatEvent[];
	/** Who is who, for naming those first senders. */
	names: ReadonlyMap<number, string>;
	/** Whether the message has a post the chat hadn't seen. */
	anyNew: boolean;
}

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
	const seen = ctx.room.commit((sql) => recordShares(sql, refs, share));
	if (ctx.room.stale) return;
	if (seen.anyNew) await attempt('shares: the 👀', () => ctx.react('👀'));
	if (seen.firstShares.length === 0) return;
	const text = bayanText(seen.firstShares, seen.names, ctx.room.chatId, share.at);
	await attempt('shares: the баян', () => ctx.reply(text, replyingTo(ctx.msg.message_id)));
});

/**
 * Records one share per post, and tells what the chat had seen of them: each post's first share
 * is read before the inserts, so a message is never its own баян.
 */
function recordShares(
	sql: SqlStorage,
	refs: readonly string[],
	share: Pick<StatEvent, 'userId' | 'messageId' | 'at'>,
): Seen {
	const firstShares = refs.flatMap((ref) => firstEventAbout(sql, 'share', ref) ?? []);
	for (const ref of refs) recordEvent(sql, { kind: 'share', ref, ...share });
	const names = firstShares.length > 0 ? displayNames(knownMembers(sql)) : new Map();
	return { firstShares, names, anyNew: firstShares.length < refs.length };
}

/** A message's links: what its `url` entities show, and where its `text_link` entities lead. */
function linksOf(ctx: BotContext): string[] {
	return ctx
		.entities(['url', 'text_link'])
		.map((entity) => (entity.type === 'text_link' ? entity.url : entity.text));
}
