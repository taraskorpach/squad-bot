import { describe, expect, it } from 'vitest';
import { Throttle } from '../../src/chat/throttle';

const WINDOW = 30_000;

describe('Throttle', () => {
	it('lets an action run, then refuses it until the window has passed', () => {
		const throttle = new Throttle();

		expect(throttle.claim('all', 0, WINDOW)).toBe(true);
		expect(throttle.claim('all', WINDOW - 1, WINDOW)).toBe(false);
		expect(throttle.claim('all', WINDOW, WINDOW)).toBe(true);
	});

	it('times the window from the last run, not from a refused attempt', () => {
		const throttle = new Throttle();
		throttle.claim('all', 0, WINDOW);

		expect(throttle.claim('all', 20_000, WINDOW)).toBe(false);
		expect(throttle.claim('all', WINDOW, WINDOW)).toBe(true);
	});

	it('keeps each key to its own window', () => {
		const throttle = new Throttle();

		expect(throttle.claim('ping:1', 0, WINDOW)).toBe(true);
		expect(throttle.claim('ping:2', 0, WINDOW)).toBe(true);
		expect(throttle.claim('ping:1', 1, WINDOW)).toBe(false);
	});
});
