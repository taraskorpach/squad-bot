// What the bot writes about a pool besides its card: replies, the messages under the card, toasts.
import { clockTime, dayAndMonth, daysFrom } from '../kyiv-time';
import { chunk, escapeHtml } from '../members/mentions';
import { texts } from '../texts';
import type { PoolArgsError } from './pool-args';

export function argsErrorText(error: PoolArgsError): string {
	const { replies } = texts.pool;
	switch (error.kind) {
		case 'size':
			return replies.badSize;
		case 'time':
			return replies.badTime(escapeHtml(error.token));
		case 'token':
			return replies.badToken(escapeHtml(error.token));
	}
}

/** When a new pool starts, as its opening message says it: against when it opened. */
export function openingWhen(startsAt: number | undefined, openedAt: number): string {
	const { messages } = texts.pool;
	if (startsAt === undefined) return messages.openingNow;
	const time = clockTime(startsAt);
	const days = daysFrom(openedAt, startsAt);
	if (days === 0) return messages.openingToday(time);
	if (days === 1) return messages.openingTomorrow(time);
	return messages.openingOnDate(dayAndMonth(startsAt), time);
}

/**
 * The messages a new pool posts under its card: who gathers what and when, with the first chunk
 * of mentions, then the rest in chunks. The author's name is plain text, so they aren't pinged.
 */
export function openingMessages(
	author: string,
	game: string,
	when: string,
	mentions: readonly string[],
	chunkSize: number,
): string[] {
	const [first = [], ...rest] = chunk(mentions, chunkSize);
	const opening = texts.pool.messages.opening(escapeHtml(author), escapeHtml(game), when);
	const tagged = first.length > 0 ? `${opening} ${first.join(', ')}` : opening;
	return [tagged, ...rest.map(texts.tags)];
}
