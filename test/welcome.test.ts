import { describe, expect, it } from 'vitest';
import { HI_CALLBACK } from '../src/telegram';
import { welcomeMessage } from '../src/welcome';

const GREETING = [
	'Привіт! Я тегаю всіх (/all), збираю пули на гру (/pool) і веду статистику (/stats).',
	'Щоб я міг вас тегати, натисніть «👋 Я тут» або просто напишіть щось у чат.',
];
const MAKE_ME_ADMIN =
	'⚠️ Зробіть мене адміном (вистачить права закріплювати повідомлення), інакше я не бачу частини команд.';

describe('welcomeMessage', () => {
	it('greets, and asks to be made an admin when the bot is not one', () => {
		expect(welcomeMessage({ isAdmin: false }).text).toBe([...GREETING, MAKE_ME_ADMIN].join('\n'));
	});

	it('leaves the request out when the bot already is an admin', () => {
		expect(welcomeMessage({ isAdmin: true }).text).toBe(GREETING.join('\n'));
	});

	it('carries the 👋 button, and goes out as HTML without link previews', () => {
		expect(welcomeMessage({ isAdmin: true }).options).toEqual({
			parse_mode: 'HTML',
			link_preview_options: { is_disabled: true },
			reply_markup: { inline_keyboard: [[{ text: '👋 Я тут', callback_data: HI_CALLBACK }]] },
		});
	});
});
