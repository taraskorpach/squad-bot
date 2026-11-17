// The setup script sends this message too, under Node's type stripping: import only the two
// import-free leaves, with their extensions.
import { HI_CALLBACK, MESSAGE_FORMAT } from './telegram.ts';
import { texts } from './texts.ts';

/** The greeting with its 👋 button, asking to be made an admin while the bot isn't one. */
export function welcomeMessage({ isAdmin }: { isAdmin: boolean }) {
	const { intro, howToBeTagged, makeMeAdmin, hiButton } = texts.welcome;
	return {
		text: [intro, howToBeTagged, ...(isAdmin ? [] : [makeMeAdmin])].join('\n'),
		options: {
			...MESSAGE_FORMAT,
			reply_markup: { inline_keyboard: [[{ text: hiButton, callback_data: HI_CALLBACK }]] },
		},
	};
}
