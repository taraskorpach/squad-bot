import { env } from 'cloudflare:workers';

/** Its own object, so a test never sees another test's storage (storage is shared per file). */
export function freshRoom() {
	return env.CHAT_ROOM.getByName(`test-${crypto.randomUUID()}`);
}

export function tableNames(storage: DurableObjectStorage): string[] {
	return storage.sql
		.exec<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name",
		)
		.toArray()
		.map((row) => row.name);
}
