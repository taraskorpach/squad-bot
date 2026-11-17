import { describe, expect, it } from 'vitest';
import { chunk, displayNames, escapeHtml, mention, mentionsOf } from '../../src/members/mentions';
import type { Member } from '../../src/members/roster';

const oleg: Member = { id: 1, firstName: 'Олег', lastName: 'Коваль' };
const otherOleg: Member = { id: 2, firstName: 'Олег', username: 'oleg_p' };
const thirdOleg: Member = { id: 3, firstName: 'Олег' };
const andriy: Member = { id: 4, firstName: 'Андрій' };
const ihor: Member = { id: 5, firstName: 'Ігор' };
const yeva: Member = { id: 6, firstName: 'Єва' };

describe('escapeHtml', () => {
	it.each([
		['Том & Джері', 'Том &amp; Джері'],
		['<3 CS2>', '&lt;3 CS2&gt;'],
		['a &lt; b', 'a &amp;lt; b'],
		[`"Лапки" й 'апостроф'`, `"Лапки" й 'апостроф'`],
	])('escapes %j as %j', (text, escaped) => {
		expect(escapeHtml(text)).toBe(escaped);
	});
});

describe('displayNames', () => {
	it('is the first name when nobody else in the chat has it', () => {
		expect(displayNames([oleg, andriy])).toEqual(
			new Map([
				[oleg.id, 'Олег'],
				[andriy.id, 'Андрій'],
			]),
		);
	});

	it("tells a shared first name apart by the last name's initial, else the username", () => {
		expect(displayNames([oleg, otherOleg, thirdOleg, andriy])).toEqual(
			new Map([
				[oleg.id, 'Олег К.'],
				[otherOleg.id, 'Олег @oleg_p'],
				[thirdOleg.id, 'Олег'],
				[andriy.id, 'Андрій'],
			]),
		);
	});

	it('takes a whole character as the initial, even an emoji', () => {
		const fiery: Member = { id: 7, firstName: 'Олег', lastName: '🔥🔥' };

		expect(displayNames([oleg, fiery]).get(fiery.id)).toBe('Олег 🔥.');
	});
});

describe('mention', () => {
	it('links the member by id, with the name escaped', () => {
		expect(mention(oleg, 'R&D <3')).toBe('<a href="tg://user?id=1">R&amp;D &lt;3</a>');
	});
});

describe('mentionsOf', () => {
	it('mentions the targets in Ukrainian alphabetical order', () => {
		const targets = [thirdOleg, ihor, andriy, yeva];

		expect(mentionsOf(targets, targets)).toEqual([
			mention(andriy, 'Андрій'),
			mention(yeva, 'Єва'),
			mention(ihor, 'Ігор'),
			mention(thirdOleg, 'Олег'),
		]);
	});

	it('tells names apart among everyone in the chat, not only the targets', () => {
		expect(mentionsOf([otherOleg], [oleg, otherOleg])).toEqual([
			mention(otherOleg, 'Олег @oleg_p'),
		]);
	});
});

describe('chunk', () => {
	it.each([
		[[], 5, []],
		[[1, 2, 3], 5, [[1, 2, 3]]],
		[[1, 2, 3, 4, 5], 5, [[1, 2, 3, 4, 5]]],
		[[1, 2, 3, 4, 5, 6], 5, [[1, 2, 3, 4, 5], [6]]],
		[[1, 2, 3], 1, [[1], [2], [3]]],
	])('splits %j into groups of %i', (items, size, groups) => {
		expect(chunk(items, size)).toEqual(groups);
	});
});
