import type { InlineKeyboardButton, InlineKeyboardMarkup } from 'grammy/types';
import { texts } from '../texts';
import type { Lineup } from './pool-rules';
import type { Pool } from './pool-store';

/** What a pool's buttons do. */
const ACTIONS = ['in', 'out', 'ping', 'draw', 'close'] as const;
export type PoolAction = (typeof ACTIONS)[number];

// `p:{pool}:{action}`, far under Telegram's 64 bytes. The welcome's 👋 is `hi`.
const POOL_ACTION = new RegExp(`^p:(\\d+):(${ACTIONS.join('|')})$`);

export function encodePoolAction(poolId: number, action: PoolAction): string {
	return `p:${poolId}:${action}`;
}

/** The pool and action a button carries, or nothing for any other data. */
export function decodePoolAction(data: string): { poolId: number; action: PoolAction } | undefined {
	const match = POOL_ACTION.exec(data);
	if (!match) return undefined;
	return { poolId: Number(match[1]), action: match[2] as PoolAction };
}

/**
 * An open card's buttons: Граю and Пас, then 🎲 while plays exceed the seats and the draw is
 * unused, 🔔 while someone hasn't answered, and ✖️, which only the author's press closes.
 * A closed card has none.
 */
export function poolKeyboard(
	pool: Pick<Pool, 'id' | 'drawn'>,
	lineup: Pick<Lineup, 'bench' | 'unanswered'>,
): InlineKeyboardMarkup {
	const { card } = texts.pool;
	const button = (text: string, action: PoolAction): InlineKeyboardButton.CallbackButton => ({
		text,
		callback_data: encodePoolAction(pool.id, action),
	});
	const extras = [
		...(lineup.bench.length > 0 && !pool.drawn ? [button(card.drawButton, 'draw')] : []),
		...(lineup.unanswered.length > 0 ? [button(card.pingButton, 'ping')] : []),
		button(card.closeButton, 'close'),
	];
	return {
		inline_keyboard: [
			[
				{ ...button(card.playButton, 'in'), style: 'success' },
				{ ...button(card.passButton, 'out'), style: 'danger' },
			],
			extras,
		],
	};
}
