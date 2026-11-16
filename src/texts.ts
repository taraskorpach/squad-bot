// The bot's Ukrainian: every string it sends, and the language's rules. The setup script imports
// this module, so keep it free of imports.

export const texts = {
	/** One message of mentions. */
	tags: (mentions: readonly string[]): string => `📢 ${mentions.join(', ')}`,
	all: {
		nobodyToTag: 'Поки нікого тегати — хай усі напишуть щось у чат.',
	},
} as const;

const UKRAINIAN = new Intl.Collator('uk');

/** Ukrainian alphabetical order. SQLite sorts by code point, which puts І, Ї, Є and Ґ out of place. */
export function compareNames(a: string, b: string): number {
	return UKRAINIAN.compare(a, b);
}
