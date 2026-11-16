import { afterEach, beforeEach } from 'vitest';
import { network, telegram, telegramApi } from './helpers/telegram';

// Enabled before any test file is imported, so every grammY client built later
// captures the patched fetch.
network.configure({ onUnhandledFrame: 'error' });
network.resetHandlers(telegramApi);
network.enable();

beforeEach(() => {
	telegram.reset();
});

afterEach(() => {
	network.resetHandlers();
});
