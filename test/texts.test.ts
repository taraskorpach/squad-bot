import { describe, expect, it } from 'vitest';
import { compareNames } from '../src/texts';

describe('compareNames', () => {
	it('orders names in the Ukrainian alphabet, which byte order gets wrong', () => {
		const names = [
			'Олег',
			'Ігор',
			'Ґанна',
			'Іра',
			'Гліб',
			'Єва',
			'Їжак',
			'Евеліна',
			'Андрій',
			'Иван',
		];

		expect(names.sort(compareNames)).toEqual([
			'Андрій',
			'Гліб',
			'Ґанна',
			'Евеліна',
			'Єва',
			'Иван',
			'Ігор',
			'Іра',
			'Їжак',
			'Олег',
		]);
	});
});
