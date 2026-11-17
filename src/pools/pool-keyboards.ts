import type { InlineKeyboardMarkup } from 'grammy/types';
import { texts } from '../texts';

/** What a pool's buttons do. Phase 7 adds 🔔, 🎲 and ✖️ here. */
const ACTIONS = ['in', 'out'] as const;
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

/** An open card's buttons. A closed card has none. */
export function poolKeyboard(poolId: number): InlineKeyboardMarkup {
	const { playButton, passButton } = texts.pool.card;
	return {
		inline_keyboard: [
			[
				{ text: playButton, callback_data: encodePoolAction(poolId, 'in'), style: 'success' },
				{ text: passButton, callback_data: encodePoolAction(poolId, 'out'), style: 'danger' },
			],
		],
	};
}
