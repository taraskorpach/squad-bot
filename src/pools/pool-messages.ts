// What the bot writes about a pool besides its card: replies, the messages under the card, toasts.
import { clockTime, dayAndMonth, daysFrom } from '../kyiv-time';
import { chunk, escapeHtml } from '../members/mentions';
import { texts } from '../texts';
import type { PoolArgsError } from './pool-args';
import { startLabel } from './pool-format';
import type { DrawRefusal, Placement } from './pool-rules';
import type { Pool } from './pool-store';

/** A pool as `/pools` lists it: how many play and how many wait on the bench. */
export interface ListedPool {
	pool: Pool;
	players: number;
	bench: number;
}

/** The toast that answers a ✅ or ❌ tap. */
export function toastOf(placement: Placement): string {
	const { toasts } = texts.pool;
	switch (placement.outcome) {
		case 'squad':
			return toasts.inSquad;
		case 'bench':
			return toasts.onBench(placement.benchPlace);
		case 'passed':
			return toasts.passed;
		case 'already-in':
			return toasts.alreadyIn;
		case 'already-passed':
			return toasts.alreadyPassed;
	}
}

/** Posted once, when the squad first fills: who plays, and the start while it is still ahead. */
export function squadCompleteText(
	game: string,
	mentions: readonly string[],
	startsAt: number | undefined,
	now: number,
): string {
	const { messages } = texts.pool;
	const start =
		startsAt !== undefined && startsAt > now ? messages.startsAt(clockTime(startsAt)) : '';
	return messages.squadComplete(escapeHtml(game), mentions.join(', ')) + start;
}

export function movedUpText(mention: string, game: string): string {
	return texts.pool.messages.movedUp(mention, escapeHtml(game));
}

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
	const opening = texts.pool.messages.opening(escapeHtml(author), escapeHtml(game), when);
	return inChunks(
		mentions,
		chunkSize,
		(first) => (first.length > 0 ? `${opening} ${first.join(', ')}` : opening),
		texts.tags,
	);
}

/** 🔔: who hasn't answered, with the first chunk of mentions, then the rest in chunks. */
export function pingMessages(mentions: readonly string[], chunkSize: number): string[] {
	const { messages } = texts.pool;
	return inChunks(
		mentions,
		chunkSize,
		(first) => messages.ping(first.join(', ')),
		(more) => messages.pingMore(more.join(', ')),
	);
}

/**
 * At the start time: the players, not the bench, with the fill while the squad is short. A pool
 * without a seat limit is never short.
 */
export function startPingText(
	game: string,
	mentions: readonly string[],
	players: number,
	size: number | undefined,
): string {
	const { messages } = texts.pool;
	const fill = size !== undefined && players < size ? messages.startFill(players, size) : '';
	return messages.startPing(escapeHtml(game), mentions.join(', ')) + fill;
}

/** After 🎲: the whole squad and the whole bench, so the message is never empty. */
export function drawText(squad: readonly string[], bench: readonly string[]): string {
	return texts.pool.messages.drawn(squad.join(', '), bench.join(', '));
}

/** The author's ✖️, for everyone else who said Граю: the pool named by its start, if it had one. */
export function closedByAuthorText(
	game: string,
	startsAt: number | undefined,
	mentions: readonly string[],
): string {
	const { messages } = texts.pool;
	const joined = mentions.join(', ');
	if (startsAt === undefined) return messages.closedByAuthor(escapeHtml(game), joined);
	return messages.closedByAuthorAt(escapeHtml(game), clockTime(startsAt), joined);
}

export function drawRefusalToast(refusal: DrawRefusal): string {
	const { toasts } = texts.pool;
	switch (refusal) {
		case 'used':
			return toasts.drawUsed;
		case 'not-playing':
			return toasts.drawNotPlaying;
		case 'bench-empty':
			return toasts.benchEmpty;
	}
}

/** `/pools`: each open pool with its start, its fill, its bench and a link to its card. */
export function openPoolsText(listed: readonly ListedPool[], chatId: number, now: number): string {
	const { replies } = texts.pool;
	if (listed.length === 0) return replies.noOpenPool;
	return [replies.openPools, ...listed.map((entry) => listedLine(entry, chatId, now))].join('\n');
}

/** A link to a supergroup's message: t.me/c takes the chat id without its -100. */
export function cardLink(chatId: number, messageId: number): string {
	return `https://t.me/c/${String(chatId).replace(/^-100/, '')}/${messageId}`;
}

function listedLine({ pool, players, bench }: ListedPool, chatId: number, now: number): string {
	const { replies } = texts.pool;
	const fill = replies.fill(players, pool.size) + (bench > 0 ? replies.onBench(bench) : '');
	const link =
		pool.messageId === undefined ? '' : replies.cardLink(cardLink(chatId, pool.messageId));
	return replies.openPool(escapeHtml(pool.game), startLabel(pool.startsAt, now), fill) + link;
}

/** Mentions in chunks: the first chunk in its own wording, each further chunk in another. */
function inChunks(
	mentions: readonly string[],
	size: number,
	first: (chunk: readonly string[]) => string,
	more: (chunk: readonly string[]) => string,
): string[] {
	const [head = [], ...rest] = chunk(mentions, size);
	return [first(head), ...rest.map(more)];
}
