import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import type { Middleware } from 'grammy';
import type { ChatRoom } from '../../src/chat/chat-room';
import type { BotContext } from '../../src/context';

/** Its own object, so a test never sees another test's storage (storage is shared per file). */
export function freshRoom() {
	return env.CHAT_ROOM.getByName(`test-${crypto.randomUUID()}`);
}

export type RoomStub = ReturnType<typeof freshRoom>;

export interface RoomSeams {
	clock?: () => number;
}

/**
 * A fresh object that runs these test features, with a `notes` table for them to commit to.
 * Same isolate as the test, so the features and the clock may close over test variables.
 */
export async function roomWith(
	features: Middleware<BotContext>[],
	seams: RoomSeams = {},
): Promise<RoomStub> {
	const stub = freshRoom();
	await runInDurableObject(stub, (room: ChatRoom, state) => {
		room.features = features;
		if (seams.clock) room.clock = seams.clock;
		state.storage.sql.exec('CREATE TABLE notes (update_id INTEGER NOT NULL, text TEXT NOT NULL)');
	});
	return stub;
}

/** A test feature that commits one note per update. */
export const noting: Middleware<BotContext> = (ctx) => {
	ctx.room.commit((sql) => {
		sql.exec('INSERT INTO notes (update_id, text) VALUES (?, ?)', ctx.update.update_id, 'note');
	});
};

export function rows(stub: RoomStub, query: string) {
	return runInDurableObject(stub, (_room, state) => state.storage.sql.exec(query).toArray());
}

export function tableNames(storage: DurableObjectStorage): string[] {
	return storage.sql
		.exec<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name",
		)
		.toArray()
		.map((row) => row.name);
}
