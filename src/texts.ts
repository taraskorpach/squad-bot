// The bot's Ukrainian: every string it sends, and the language's rules. The setup script imports
// this module, so keep it free of imports.

const UKRAINIAN = new Intl.Collator('uk');

/** Ukrainian alphabetical order. SQLite sorts by code point, which puts І, Ї, Є and Ґ out of place. */
export function compareNames(a: string, b: string): number {
	return UKRAINIAN.compare(a, b);
}
