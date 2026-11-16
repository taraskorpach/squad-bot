import { Composer } from 'grammy';
import type { BotContext } from '../context';
import { HI_CALLBACK, isInChat } from '../telegram';
import { texts } from '../texts';
import { welcomeMessage } from '../welcome';

/** The welcome when the bot is added to the chat, and the answer to its 👋 button. */
export const welcoming = new Composer<BotContext>();

// Added means not in the chat before and in it now, so a promotion doesn't greet twice.
welcoming.on('my_chat_member', async (ctx) => {
	const { old_chat_member: before, new_chat_member: now } = ctx.myChatMember;
	if (isInChat(before) || !isInChat(now)) return;
	const welcome = welcomeMessage({ isAdmin: now.status === 'administrator' });
	await ctx.reply(welcome.text, welcome.options);
});

// Member learning has already saved whoever tapped: the toast only says so.
welcoming.callbackQuery(HI_CALLBACK, (ctx) => ctx.answerCallbackQuery(texts.welcome.hiToast));
