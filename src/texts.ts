// The bot's Ukrainian: every string it sends, and the language's rules. The setup script imports
// this module, so keep it free of imports.

const HI_BUTTON = '👋 Я тут';

export const texts = {
	/** One message of mentions. */
	tags: (mentions: readonly string[]): string => `📢 ${mentions.join(', ')}`,
	all: {
		nobodyToTag: 'Поки нікого тегати — хай усі напишуть щось у чат.',
	},
	welcome: {
		intro: 'Привіт! Я тегаю всіх (/all), збираю пули на гру (/pool) і веду статистику (/stats).',
		howToBeTagged: `Щоб я міг вас тегати, натисніть «${HI_BUTTON}» або просто напишіть щось у чат.`,
		makeMeAdmin:
			'⚠️ Зробіть мене адміном (вистачить права закріплювати повідомлення), інакше я не бачу частини команд.',
		hiButton: HI_BUTTON,
		hiToast: "Запам'ятав 👌",
	},
} as const;

const UKRAINIAN = new Intl.Collator('uk');

/** Ukrainian alphabetical order. SQLite sorts by code point, which puts І, Ї, Є and Ґ out of place. */
export function compareNames(a: string, b: string): number {
	return UKRAINIAN.compare(a, b);
}
