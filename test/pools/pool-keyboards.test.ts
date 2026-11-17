import { describe, expect, it } from 'vitest';
import { decodePoolAction, encodePoolAction, poolKeyboard } from '../../src/pools/pool-keyboards';

describe('encodePoolAction and decodePoolAction', () => {
	it('carry the pool and the action in a few bytes, both ways', () => {
		const data = encodePoolAction(12345, 'close');

		expect(data).toBe('p:12345:close');
		expect(new TextEncoder().encode(data).byteLength).toBeLessThanOrEqual(64);
		for (const action of ['in', 'out', 'ping', 'draw', 'close'] as const) {
			expect(decodePoolAction(encodePoolAction(7, action))).toEqual({ poolId: 7, action });
		}
	});

	it.each(['hi', 'p:7', 'p:7:dance', 'p:x:in', 'p:7:in:extra', 'q:7:in'])(
		'reads %s as no pool action',
		(data) => {
			expect(decodePoolAction(data)).toBeUndefined();
		},
	);
});

describe('poolKeyboard', () => {
	const answerRow = [
		{ text: '✅ Граю', callback_data: 'p:7:in', style: 'success' },
		{ text: '❌ Пас', callback_data: 'p:7:out', style: 'danger' },
	];
	const draw = { text: '🎲 Жереб', callback_data: 'p:7:draw' };
	const ping = { text: '🔔 Нагадати', callback_data: 'p:7:ping' };
	const close = { text: '✖️ Закрити', callback_data: 'p:7:close' };
	const pool = { id: 7, drawn: false };

	it.each([
		['🔔 while someone has yet to answer', pool, { bench: [], unanswered: [4] }, [ping, close]],
		['🎲 while plays exceed the seats', pool, { bench: [6], unanswered: [] }, [draw, close]],
		['both, when both hold', pool, { bench: [6], unanswered: [4] }, [draw, ping, close]],
		['no 🎲 once it was used', { id: 7, drawn: true }, { bench: [6], unanswered: [] }, [close]],
		[
			'only ✖️ when everyone answered and all are seated',
			pool,
			{ bench: [], unanswered: [] },
			[close],
		],
	])('gives an open card Граю and Пас, then %s', (_case, card, lineup, extras) => {
		expect(poolKeyboard(card, lineup)).toEqual({ inline_keyboard: [answerRow, extras] });
	});
});
