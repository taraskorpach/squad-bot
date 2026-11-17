import type { Member, Presence } from './roster';

type MemberRow = {
	user_id: number;
	first_name: string;
	last_name: string | null;
	username: string | null;
};

/** Saves what an update said about each member: the names they have now, and in or out. */
export function savePresences(sql: SqlStorage, presences: readonly Presence[], now: number): void {
	for (const { member, inChat } of presences) {
		sql.exec(
			`INSERT INTO members (user_id, first_name, last_name, username, in_chat, seen_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (user_id) DO UPDATE SET
				first_name = excluded.first_name,
				last_name  = excluded.last_name,
				username   = excluded.username,
				in_chat    = excluded.in_chat,
				seen_at    = excluded.seen_at`,
			member.id,
			member.firstName,
			member.lastName ?? null,
			member.username ?? null,
			inChat ? 1 : 0,
			now,
		);
	}
}

export function membersInChat(sql: SqlStorage): Member[] {
	return sql
		.exec<MemberRow>(
			'SELECT user_id, first_name, last_name, username FROM members WHERE in_chat = 1',
		)
		.toArray()
		.map(memberOf);
}

/** Every member the bot has learned, in the chat or not: the stats name leavers too. */
export function knownMembers(sql: SqlStorage): Member[] {
	return sql
		.exec<MemberRow>('SELECT user_id, first_name, last_name, username FROM members')
		.toArray()
		.map(memberOf);
}

/** These members, whether or not they are still in the chat: a card keeps a leaver's name. */
export function membersById(sql: SqlStorage, ids: readonly number[]): Member[] {
	return sql
		.exec<MemberRow>(
			`SELECT user_id, first_name, last_name, username FROM members
			 WHERE user_id IN (SELECT value FROM json_each(?))`,
			JSON.stringify(ids),
		)
		.toArray()
		.map(memberOf);
}

function memberOf(row: MemberRow): Member {
	return {
		id: row.user_id,
		firstName: row.first_name,
		lastName: row.last_name ?? undefined,
		username: row.username ?? undefined,
	};
}
