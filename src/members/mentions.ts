import { compareNames } from '../texts';
import type { Member } from './roster';

/** Telegram's HTML mode needs only these three escaped. Every string a user typed goes through it. */
export function escapeHtml(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Each member's name as the chat sees it: the first name, and when two of these members share
 * it, the last name's initial (`Олег К.`), or else the username, to tell them apart.
 */
export function displayNames(members: readonly Member[]): Map<number, string> {
	const holders = new Map<string, number>();
	for (const { firstName } of members) holders.set(firstName, (holders.get(firstName) ?? 0) + 1);
	return new Map(
		members.map((member) => {
			const isShared = (holders.get(member.firstName) ?? 0) > 1;
			return [member.id, isShared ? toldApart(member) : member.firstName];
		}),
	);
}

/** A link that notifies the member, its text their escaped name. */
export function mention(member: Member, name: string): string {
	return `<a href="tg://user?id=${member.id}">${escapeHtml(name)}</a>`;
}

/** Mentions of the targets in name order, with names told apart among everyone in the chat. */
export function mentionsOf(targets: readonly Member[], inChat: readonly Member[]): string[] {
	const names = displayNames(inChat);
	return targets
		.map((member) => ({ member, name: names.get(member.id) ?? member.firstName }))
		.sort((a, b) => compareNames(a.name, b.name))
		.map(({ member, name }) => mention(member, name));
}

/** Groups of at most `size`, in order: Telegram notifies only so many mentions per message. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
	const groups: T[][] = [];
	for (let start = 0; start < items.length; start += size) {
		groups.push(items.slice(start, start + size));
	}
	return groups;
}

function toldApart(member: Member): string {
	const [initial] = member.lastName ?? '';
	if (initial) return `${member.firstName} ${initial}.`;
	if (member.username) return `${member.firstName} @${member.username}`;
	return member.firstName;
}
