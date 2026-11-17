import { Composer, type Filter } from 'grammy';
import { attempt } from '../chat/attempt';
import type { BotContext } from '../context';
import { TAG_WINDOW_MS } from '../telegram';
import { texts } from '../texts';
import {
	applyAnswer,
	commitClose,
	commitDraw,
	showAnswer,
	showClose,
	showDraw,
} from './pool-actions';
import { cardState, mentionsIn, postUnderCard, refreshCard } from './pool-card';
import { decodePoolAction, type PoolAction } from './pool-keyboards';
import { drawRefusalToast, pingMessages, toastOf } from './pool-messages';
import type { Choice } from './pool-rules';
import { adoptCard, poolById } from './pool-store';

type TapContext = Filter<BotContext, 'callback_query:data'>;

// A Record, so a new button can't be added without saying what its tap does.
const ON_TAP: Record<PoolAction, (ctx: TapContext, poolId: number) => Promise<void>> = {
	in: (ctx, poolId) => answerTap(ctx, poolId, 'play'),
	out: (ctx, poolId) => answerTap(ctx, poolId, 'pass'),
	ping: pingTap,
	draw: drawTap,
	close: closeTap,
};

/**
 * A card's buttons. Every tap taken here is answered, or its button keeps spinning; a tap that
 * isn't a pool action goes on to the catch-all.
 */
export const poolTaps = new Composer<BotContext>();

poolTaps.on('callback_query:data', async (ctx, next) => {
	const tapped = decodePoolAction(ctx.callbackQuery.data);
	if (!tapped) return next();
	const tappedId = ctx.callbackQuery.message?.message_id;
	// The card went out but its id was never stored: the message carrying its buttons is the card.
	if (tappedId !== undefined) ctx.room.write((sql) => adoptCard(sql, tapped.poolId, tappedId));
	await ON_TAP[tapped.action](ctx, tapped.poolId);
});

async function answerTap(ctx: TapContext, poolId: number, choice: Choice): Promise<void> {
	const result = applyAnswer(ctx.room, poolId, ctx.callbackQuery.from.id, choice, ctx.room.clock());
	switch (result.kind) {
		case 'answered':
			await toast(ctx, toastOf(result.decision));
			return showAnswer(ctx.room, poolId, result.decision);
		case 'closed':
			return closedTap(ctx, poolId);
		case 'missing':
			return toast(ctx);
	}
}

/** 🔔: tags whoever hasn't answered, at most once per window per pool. */
async function pingTap(ctx: TapContext, poolId: number): Promise<void> {
	const state = ctx.room.read((sql) => cardState(sql, poolId));
	if (!state) return toast(ctx);
	const { pool, lineup } = state;
	if (pool.status === 'closed') return closedTap(ctx, poolId);
	const { toasts } = texts.pool;
	if (lineup.unanswered.length === 0) {
		await toast(ctx, toasts.allAnswered);
		return refreshCard(ctx.room, poolId);
	}
	if (!ctx.room.throttle.claim(`ping:${poolId}`, ctx.room.clock(), TAG_WINDOW_MS)) {
		return toast(ctx, toasts.pingedJustNow);
	}
	await toast(ctx, toasts.pinged(lineup.unanswered.length));
	const mentions = mentionsIn(state, lineup.unanswered);
	for (const text of pingMessages(mentions, ctx.room.mentionChunk)) {
		await postUnderCard(ctx.room, poolId, pool.messageId, text);
	}
}

/** 🎲: a player's one-time draw while someone sits on the bench. */
async function drawTap(ctx: TapContext, poolId: number): Promise<void> {
	const outcome = commitDraw(ctx.room, poolId, ctx.callbackQuery.from.id);
	switch (outcome.kind) {
		case 'drawn':
			await toast(ctx, texts.pool.toasts.drawn);
			return showDraw(ctx.room, poolId, outcome.squad, outcome.bench);
		case 'refused':
			// The keyboard may be outdated: the render puts the right buttons back.
			await toast(ctx, drawRefusalToast(outcome.refusal));
			return refreshCard(ctx.room, poolId);
		case 'closed':
			return closedTap(ctx, poolId);
		case 'missing':
			return toast(ctx);
	}
}

/** ✖️: only the author closes. */
async function closeTap(ctx: TapContext, poolId: number): Promise<void> {
	const pool = ctx.room.read((sql) => poolById(sql, poolId));
	if (!pool) return toast(ctx);
	if (pool.status === 'closed') return closedTap(ctx, poolId);
	if (pool.authorId !== ctx.callbackQuery.from.id) {
		return toast(ctx, texts.pool.toasts.closeNotAuthor);
	}
	commitClose(ctx.room, poolId, 'author');
	await toast(ctx, texts.pool.toasts.closedByYou);
	await showClose(ctx.room, poolId);
}

/** Any button on a closed pool: its toast, and the card shown closed. */
async function closedTap(ctx: TapContext, poolId: number): Promise<void> {
	await toast(ctx, texts.pool.toasts.closed);
	await refreshCard(ctx.room, poolId);
}

async function toast(ctx: TapContext, text?: string): Promise<void> {
	await attempt('pools: a toast', () => ctx.answerCallbackQuery(text));
}
