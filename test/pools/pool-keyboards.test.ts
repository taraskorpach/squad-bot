import { describe, expect, it } from 'vitest';
import { decodePoolAction, encodePoolAction, poolKeyboard } from '../../src/pools/pool-keyboards';

describe('encodePoolAction and decodePoolAction', () => {
	it('carry the pool and the action in a few bytes, both ways', () => {
		const data = encodePoolAction(12345, 'in');

		expect(data).toBe('p:12345:in');
		expect(new TextEncoder().encode(data).byteLength).toBeLessThanOrEqual(64);
		expect(decodePoolAction(data)).toEqual({ poolId: 12345, action: 'in' });
		expect(decodePoolAction(encodePoolAction(7, 'out'))).toEqual({ poolId: 7, action: 'out' });
	});

	it.each(['hi', 'p:7', 'p:7:dance', 'p:x:in', 'p:7:in:extra', 'q:7:in'])(
		'reads %s as no pool action',
		(data) => {
			expect(decodePoolAction(data)).toBeUndefined();
		},
	);
});

describe('poolKeyboard', () => {
	it('gives an open card a green Граю and a red Пас', () => {
		expect(poolKeyboard(7)).toEqual({
			inline_keyboard: [
				[
					{ text: '✅ Граю', callback_data: 'p:7:in', style: 'success' },
					{ text: '❌ Пас', callback_data: 'p:7:out', style: 'danger' },
				],
			],
		});
	});
});
