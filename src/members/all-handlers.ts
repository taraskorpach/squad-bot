import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { recordEvent } from '../stats/event-store';
import { MESSAGE_FORMAT, sentAt } from '../telegram';
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
		await attempt('the 👌 for a repeat', () => ctx.react('👌'));
		return;
	}
	const mentions = mentionsOf(tagTargets(inChat, caller.id), inChat);
	const replies =
		mentions.length > 0
			? chunk(mentions, ctx.room.mentionChunk).map(texts.tags)
			: [texts.all.nobodyToTag];
	for (const text of replies) {
		await attempt('a reply', () => ctx.reply(text, replyingTo(ctx.msg.message_id)));
	}
});

function replyingTo(messageId: number) {
	return {
		...MESSAGE_FORMAT,
		reply_parameters: { message_id: messageId, allow_sending_without_reply: true },
	};
}

/** After the commit nothing is redelivered: a failed call is logged, and the next one still goes. */
async function attempt(what: string, call: () => Promise<unknown>): Promise<void> {
	try {
		await call();
	} catch (error) {
		console.error(`/all: ${what} failed`, error);
	}
}
