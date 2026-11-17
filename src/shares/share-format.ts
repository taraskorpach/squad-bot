// What the bot says to a post the chat has already seen: the баян, a line for each such post.
import { clockTime, dayAndMonth, daysFrom, fullDate, sameYear } from '../kyiv-time';
import { escapeHtml } from '../members/mentions';
import type { StatEvent } from '../stats/event-store';
import { messageLink } from '../telegram';
import { texts } from '../texts';

/** The reply to a баян: for each post's first share, who sent it, when, and a link to it. */
export function bayanText(
	firstShares: readonly StatEvent[],
	names: ReadonlyMap<number, string>,
	chatId: number,
	now: number,
): string {
	return firstShares.map((first) => bayanLine(first, names, chatId, now)).join('\n');
}

/** When a first share was sent, seen from `now` on the Kyiv calendar. */
export function sentWhen(at: number, now: number): string {
	const { shares } = texts;
	const days = daysFrom(now, at);
	if (days >= 0) return shares.today(clockTime(at));
	if (days === -1) return shares.yesterday(clockTime(at));
	return sameYear(at, now) ? dayAndMonth(at) : fullDate(at);
}

/** Named as the chat knows them; the id stands in for someone the bot never learned. */
function bayanLine(
	first: StatEvent,
	names: ReadonlyMap<number, string>,
	chatId: number,
	now: number,
): string {
	const { shares } = texts;
	const name = escapeHtml(names.get(first.userId) ?? String(first.userId));
	const original =
		first.messageId === undefined ? '' : shares.original(messageLink(chatId, first.messageId));
	return shares.bayan(name, sentWhen(first.at, now), original);
}
