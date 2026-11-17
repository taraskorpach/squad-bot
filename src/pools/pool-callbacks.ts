import { Composer } from 'grammy';
import { attempt } from '../chat/attempt';
import type { BotContext } from '../context';
import { texts } from '../texts';
import { applyAnswer, showAnswer } from './pool-actions';
import { refreshCard } from './pool-card';
import { decodePoolAction } from './pool-keyboards';
import { toastOf } from './pool-messages';
import { adoptCard } from './pool-store';

/**
 * ✅ Граю and ❌ Пас on a card. Every tap taken here is answered, or its button keeps spinning;
 * a tap that isn't a pool action goes on to the catch-all.
 */
export const poolTaps = new Composer<BotContext>();

poolTaps.on('callback_query:data', async (ctx, next) => {
	const action = decodePoolAction(ctx.callbackQuery.data);
	if (!action) return next();
	const { poolId } = action;
	const tappedId = ctx.callbackQuery.message?.message_id;
	// The card went out but its id was never stored: the message carrying its buttons is the card.
	if (tappedId !== undefined) ctx.room.write((sql) => adoptCard(sql, poolId, tappedId));
	const choice = action.action === 'in' ? 'play' : 'pass';
	const result = applyAnswer(ctx.room, poolId, ctx.callbackQuery.from.id, choice, ctx.room.clock());
	switch (result.kind) {
		case 'answered':
			await attempt('pools: the toast', () => ctx.answerCallbackQuery(toastOf(result.decision)));
			await showAnswer(ctx.room, poolId, result.decision);
			return;
		case 'closed':
			await attempt('pools: the closed toast', () =>
				ctx.answerCallbackQuery(texts.pool.toasts.closed),
			);
			await refreshCard(ctx.room, poolId);
			return;
		case 'missing':
			await attempt('pools: an empty answer', () => ctx.answerCallbackQuery());
	}
});
