// The setup script's decisions, kept apart from its I/O so the workerd tests can run them. Node
// runs this file with type stripping: import only the src leaves, with their extensions.
import type { Opts, Update, WebhookInfo } from 'grammy/types';
import {
	ALLOWED_UPDATES,
	chatOf,
	isGroup,
	WEBHOOK_PATH,
	WEBHOOK_SECRET_HEADER,
} from '../src/telegram.ts';
import { texts } from '../src/texts.ts';

/** The menu Telegram shows in group chats. */
export const COMMAND_MENU: Opts<'setMyCommands'> = {
	commands: Object.entries(texts.commandMenu).map(([command, description]) => ({
		command,
		description,
	})),
	scope: { type: 'all_group_chats' },
};

export interface FoundGroup {
	id: number;
	title: string;
	type: 'group' | 'supergroup';
	/** The supergroup this basic group was upgraded to: its id is the one to use. */
	upgradedTo?: number;
}

/** Every group in pending updates, of any update type. An upgraded group brings its supergroup. */
export function groupsIn(updates: readonly Update[]): FoundGroup[] {
	const groups = new Map<number, FoundGroup>();
	for (const update of updates) {
		const chat = chatOf(update);
		if (!chat || !isGroup(chat)) continue;
		const upgradedTo = update.message?.migrate_to_chat_id ?? groups.get(chat.id)?.upgradedTo;
		groups.set(chat.id, { id: chat.id, title: chat.title, type: chat.type, upgradedTo });
		if (upgradedTo !== undefined && !groups.has(upgradedTo)) {
			groups.set(upgradedTo, { id: upgradedTo, title: chat.title, type: 'supergroup' });
		}
	}
	return [...groups.values()];
}

// Telegram takes 1 to 256 of these characters; 32 or more can't be guessed.
const SECRET_RULE = /^[A-Za-z0-9_-]{32,256}$/;

/** How Telegram reaches the Worker: its webhook, the secret, our update types, a clean start. */
export function webhookSettings(workerUrl: string, secret: string): Opts<'setWebhook'> {
	if (!SECRET_RULE.test(secret)) {
		throw new Error('WEBHOOK_SECRET must be 32 to 256 characters of A-Z, a-z, 0-9, _ and -');
	}
	return {
		url: webhookUrl(workerUrl),
		secret_token: secret,
		allowed_updates: ALLOWED_UPDATES,
		// Whatever was sent while the bot was being set up is stale: acting on it now would surprise.
		drop_pending_updates: true,
	};
}

function webhookUrl(workerUrl: string): string {
	if (!URL.canParse(workerUrl)) throw new Error(`Not a URL: ${workerUrl}`);
	const worker = new URL(workerUrl);
	if (worker.protocol !== 'https:') throw new Error("The Worker's URL must start with https://");
	return new URL(WEBHOOK_PATH, worker).href;
}

/** How Telegram's last delivery to the webhook failed, if it did. */
export function deliveryError(info: WebhookInfo): string | undefined {
	if (info.last_error_message === undefined) return undefined;
	const at = new Date((info.last_error_date ?? 0) * 1000).toISOString();
	return `Telegram's last delivery failed at ${at}: ${info.last_error_message}`;
}

/** The request Telegram will send, carrying an update with no chat, which the Worker ignores. */
export function probeRequest(secret: string): RequestInit {
	return {
		method: 'POST',
		headers: { [WEBHOOK_SECRET_HEADER]: secret, 'Content-Type': 'application/json' },
		body: JSON.stringify({ update_id: 0 }),
	};
}

/** Why the Worker's answer to the probe means Telegram's updates won't get through, if it does. */
export function probeProblem(status: number): string | undefined {
	switch (status) {
		case 200:
			return undefined;
		case 401:
			return 'The Worker refused the secret: its WEBHOOK_SECRET is a different one';
		case 404:
			return 'Nothing answers at this URL: check it, and that the Worker is deployed';
		default:
			return `The Worker answered ${status}, not 200`;
	}
}
