import { describe, expect, it } from 'vitest';
import { compareNames, plural } from '../src/texts';

describe('plural', () => {
	const seats = { one: 'місце', few: 'місця', many: 'місць' };

	it.each([
		[1, 'місце'],
		[2, 'місця'],
		[4, 'місця'],
		[5, 'місць'],
		[10, 'місць'],
		[11, 'місць'],
		[21, 'місце'],
		[22, 'місця'],
		[25, 'місць'],
	])('picks the Ukrainian form for %i: %s', (count, form) => {
		expect(plural(count, seats)).toBe(form);
	});
});

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
