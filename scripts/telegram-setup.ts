// The setup script's decisions, kept apart from its I/O so the workerd tests can run them. Node
// runs this file with type stripping: import only the src leaves, with their extensions.
import type { Opts } from 'grammy/types';
import { texts } from '../src/texts.ts';

/** The menu Telegram shows in group chats. */
export const COMMAND_MENU: Opts<'setMyCommands'> = {
	commands: Object.entries(texts.commandMenu).map(([command, description]) => ({
		command,
		description,
	})),
	scope: { type: 'all_group_chats' },
};
