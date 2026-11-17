import { GrammyError, HttpError } from 'grammy';
import { describe, expect, it } from 'vitest';
import { canRedeliver, redeliveryCapReached } from '../../src/chat/failure-policy';

const MINUTE = 60 * 1000;

function telegramError(code: number): GrammyError {
	return new GrammyError(
		'Call failed',
		{ ok: false, error_code: code, description: `error ${code}` },
		'sendMessage',
		{},
	);
}

describe('canRedeliver', () => {
	const untouched = { committed: false, delivered: false };

	it.each([
		['a bug in a handler', new Error('boom')],
		['a rate limit', telegramError(429)],
		['a Telegram server error', telegramError(500)],
		['a network error', new HttpError('Network request failed', new Error('reset'))],
	])('allows it after %s, when nothing was committed or sent', (_case, error) => {
		expect(canRedeliver({ ...untouched, error })).toBe(true);
	});

	it.each([
		['committed', { committed: true, delivered: false }],
		['reached Telegram', { committed: false, delivered: true }],
	])('refuses it once something %s: a retry would do it twice', (_case, progress) => {
		expect(canRedeliver({ ...progress, error: new Error('boom') })).toBe(false);
	});

	it.each([400, 403, 404])('refuses it after a permanent Telegram error %i', (code) => {
		expect(canRedeliver({ ...untouched, error: telegramError(code) })).toBe(false);
	});
});

describe('redeliveryCapReached', () => {
	const firstFailedAt = Date.UTC(2026, 10, 16, 20);

	it.each([
		[1, 0, false],
		[3, 4 * MINUTE, false],
		[2, 10 * MINUTE, false],
		[3, 5 * MINUTE, true],
		[4, 6 * MINUTE, true],
	])('after %i failures, %i ms since the first: %s', (attempts, elapsed, reached) => {
		expect(redeliveryCapReached({ attempts, firstFailedAt }, firstFailedAt + elapsed)).toBe(
			reached,
		);
	});
});
