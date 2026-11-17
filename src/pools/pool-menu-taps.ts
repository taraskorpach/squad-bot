import { Composer, type Filter } from 'grammy';
import { attempt } from '../chat/attempt';
import type { BotContext } from '../context';
import { occurrencesAround } from '../kyiv-time';
import { texts } from '../texts';
import { openPool } from './pool-actions';
import { startOf } from './pool-args';
import {
	type CompleteMenu,
	decodeMenu,
	gameOf,
	isComplete,
	type MenuState,
	menuScreen,
} from './pool-menu';

type TapContext = Filter<BotContext, 'callback_query:data'>;

/** A menu that opened its pool opens no other: a second tap inside this window is ignored. */
const USED_MENU_MS = 60 * 1000;

/**
 * The menu's buttons. Only its author's taps count. Every tap taken here is answered, or its button
 * keeps spinning; a tap that isn't the menu's goes on to the cards' buttons.
 */
export const poolMenu = new Composer<BotContext>();

poolMenu.on('callback_query:data', async (ctx, next) => {
	const tapped = decodeMenu(ctx.callbackQuery.data);
	if (!tapped) return next();
	const { menu } = texts.pool;
	const author = tapped.kind === 'cancel' ? tapped.author : tapped.state.author;
	if (ctx.callbackQuery.from.id !== author) return toast(ctx, menu.notYours);
	if (tapped.kind === 'cancel') {
		await toast(ctx, menu.cancelled);
		await attempt('pools: deleting a cancelled menu', () => ctx.deleteMessage());
		return;
	}
	const { state } = tapped;
	const now = ctx.room.clock();
	if (!isComplete(state)) {
		await toast(ctx);
		return showStep(ctx, state, now);
	}
	const startsAt = startOfChoice(state, now);
	if (startsAt === 'passed') {
		await toast(ctx, menu.hourPassed);
		return showStep(ctx, { ...state, time: { kind: 'unset' } }, now);
	}
	await toast(ctx);
	await openFromMenu(ctx, state, startsAt, now);
});

/**
 * The pool, opened as a typed /pool opens it: its card replies to the /pool the menu answers. Then
 * the menu goes, or, past the age Telegram lets a bot delete, says the pool opened.
 */
async function openFromMenu(
	ctx: TapContext,
	state: CompleteMenu,
	startsAt: number | undefined,
	now: number,
): Promise<void> {
	const message = ctx.callbackQuery.message;
	if (!message || !ctx.room.throttle.claim(`menu:${message.message_id}`, now, USED_MENU_MS)) return;
	const command = 'reply_to_message' in message ? message.reply_to_message : undefined;
	await openPool(ctx.room, {
		game: gameOf(state),
		...(state.seats !== 'no-limit' && { size: state.seats }),
		authorId: state.author,
		openedAt: now,
		startsAt,
		commandId: command?.message_id ?? message.message_id,
	});
	const deleted = await attempt('pools: deleting a used menu', () => ctx.deleteMessage());
	if (deleted) return;
	await attempt('pools: closing a used menu', () => ctx.editMessageText(texts.pool.menu.opened));
}

/** Now is none; a full hour is today's, unless it has passed; another time follows /pool's rule. */
function startOfChoice({ time }: CompleteMenu, now: number): number | undefined | 'passed' {
	switch (time.kind) {
		case 'now':
			return undefined;
		case 'hour': {
			const at = occurrencesAround({ hour: time.hour, minute: 0 }, now).today;
			return at > now ? at : 'passed';
		}
		case 'at':
			return startOf(time.time, now);
	}
}

async function showStep(ctx: TapContext, state: MenuState, now: number): Promise<void> {
	const { text, keyboard } = menuScreen(state, now);
	await attempt('pools: a menu step', () => ctx.editMessageText(text, { reply_markup: keyboard }));
}

async function toast(ctx: TapContext, text?: string): Promise<void> {
	await attempt('pools: a menu toast', () => ctx.answerCallbackQuery(text));
}
