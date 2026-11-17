import { describe, expect, it, vi } from 'vitest';
import { attempt } from '../../src/chat/attempt';

describe('attempt', () => {
	it('gives back what the call returns', async () => {
		expect(await attempt('a call', async () => 42)).toBe(42);
	});

	it('logs a failed call under its label and gives back nothing, so the next call still goes', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		const error = new Error('boom');

		expect(
			await attempt('/all: a reply', async () => {
				throw error;
			}),
		).toBeUndefined();
		expect(logged).toHaveBeenCalledWith('/all: a reply failed', error);
		logged.mockRestore();
	});
});
