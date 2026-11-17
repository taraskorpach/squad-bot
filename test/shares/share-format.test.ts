import { describe, expect, it } from 'vitest';
import { bayanText, sentWhen } from '../../src/shares/share-format';
import type { StatEvent } from '../../src/stats/event-store';

const CHAT_ID = -1001234567890;

// 17.11.2026 at 21:40 in Kyiv, two hours ahead of UTC in winter.
const NOW = Date.UTC(2026, 10, 17, 19, 40);

const NAMES = new Map([
	[1002, 'Олег'],
	[1005, 'Макс'],
]);

function firstShare(fields: Partial<StatEvent> = {}): StatEvent {
	return {
		kind: 'share',
		ref: 'youtube:dQw4w9WgXcQ',
		userId: 1002,
		messageId: 42,
		at: Date.UTC(2026, 10, 16, 19, 40),
		...fields,
	};
}

describe('sentWhen', () => {
	it.each([
		['the same day', Date.UTC(2026, 10, 17, 6, 5), 'сьогодні о 08:05'],
		['the day before', Date.UTC(2026, 10, 16, 19, 40), 'вчора о 21:40'],
		['the day before by the Kyiv calendar', Date.UTC(2026, 10, 16, 21, 59), 'вчора о 23:59'],
		['earlier this year', Date.UTC(2026, 10, 12, 10), '12.11'],
		['in another year', Date.UTC(2025, 10, 12, 10), '12.11.2025'],
	])('names a first share sent %s as %s', (_, at, when) => {
		expect(sentWhen(at, NOW)).toBe(when);
	});
});

describe('bayanText', () => {
	it("words design.md's баян, with a link to the first message", () => {
		expect(bayanText([firstShare()], NAMES, CHAT_ID, NOW)).toBe(
			'🪗 Баян! Уже було — Олег, вчора о 21:40 → <a href="https://t.me/c/1234567890/42">оригінал</a>',
		);
	});

	it('gives each post the chat has seen a line of its own', () => {
		const text = bayanText(
			[firstShare(), firstShare({ userId: 1005, messageId: 43, at: Date.UTC(2026, 10, 12, 10) })],
			NAMES,
			CHAT_ID,
			NOW,
		);

		expect(text.split('\n')).toEqual([
			'🪗 Баян! Уже було — Олег, вчора о 21:40 → <a href="https://t.me/c/1234567890/42">оригінал</a>',
			'🪗 Баян! Уже було — Макс, 12.11 → <a href="https://t.me/c/1234567890/43">оригінал</a>',
		]);
	});

	it('escapes a name, shows the id of someone never seen, and links nothing without a message', () => {
		const names = new Map([[8, 'Ж<b>ук</b>']]);

		expect(bayanText([firstShare({ userId: 8 })], names, CHAT_ID, NOW)).toContain(
			'Уже було — Ж&lt;b&gt;ук&lt;/b&gt;, ',
		);
		expect(bayanText([firstShare({ userId: 99, messageId: undefined })], NAMES, CHAT_ID, NOW)).toBe(
			'🪗 Баян! Уже було — 99, вчора о 21:40',
		);
	});
});
