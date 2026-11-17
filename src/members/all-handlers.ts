import { Composer } from 'grammy';
import { attempt } from '../chat/attempt';
import type { BotContext } from '../context';
import { recordEvent } from '../stats/event-store';
import { replyingTo, sentAt } from '../telegram';
import { texts } from '../texts';
import { membersInChat } from './member-store';
import { chunk, mentionsOf } from './mentions';
import { tagTargets } from './roster';

/**
 * Telegram lets a bot send 20 messages a minute to a group, and the /all leaderboard invites
 * spamming it: /all tags at most once per window, so the pools' messages still get through.
 */
const TAG_WINDOW_MS = 30 * 1000;

/** `/all`: every call counts; it tags everyone in the chat but the caller. */
export const tagAll = new Composer<BotContext>();

tagAll.command('all', async (ctx) => {
	const caller = ctx.from;
	if (!caller) return;
	const inChat = ctx.room.commit((sql) => {
		recordEvent(sql, { kind: 'all', userId: caller.id, at: sentAt(ctx.msg) });
		return membersInChat(sql);
	});
	if (ctx.room.stale) return;
	if (!ctx.room.throttle.claim('all', ctx.room.clock(), TAG_WINDOW_MS)) {
		await attempt('/all: the 👌 for a repeat', () => ctx.react('👌'));
		return;
	}
	const mentions = mentionsOf(tagTargets(inChat, caller.id), inChat);
	const replies =
		mentions.length > 0
			? chunk(mentions, ctx.room.mentionChunk).map(texts.tags)
			: [texts.all.nobodyToTag];
	for (const text of replies) {
		await attempt('/all: a reply', () => ctx.reply(text, replyingTo(ctx.msg.message_id)));
	}
});
