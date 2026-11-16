// The setup script's decisions, kept apart from its I/O so the workerd tests can run them. Node
// runs this file with type stripping: import only the src leaves, with their extensions.
import type { Opts, Update } from 'grammy/types';
import { chatOf, isGroup } from '../src/telegram.ts';
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
