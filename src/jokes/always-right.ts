import { Composer } from 'grammy';
import { attempt } from '../chat/attempt';
import type { BotContext } from '../context';
import { texts } from '../texts';

/** `/artemisalwaysright`: the bot reminds the chat, and the command itself goes. Not counted. */
export const artemIsAlwaysRight = new Composer<BotContext>();

artemIsAlwaysRight.command('artemisalwaysright', async (ctx) => {
	if (ctx.room.stale) return;
	// Nothing has committed, so a failed reminder is the failure policy's to judge.
	await ctx.reply(texts.jokes.alwaysRight);
	// Best effort: without the delete right the command stays, and the reminder is already out.
	await attempt('jokes: deleting /artemisalwaysright', () => ctx.deleteMessage());
});
