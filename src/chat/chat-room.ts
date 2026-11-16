import { DurableObject } from 'cloudflare:workers';
import { type RoomSettings, readRoomSettings } from '../settings';
import { MIGRATIONS, migrate } from './schema';

export class ChatRoom extends DurableObject<Env> {
	/** Test seam: replace through `runInDurableObject` before the first update. */
	clock: () => number = Date.now;

	readonly #settings: RoomSettings;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.#settings = readRoomSettings(env);
		void ctx.blockConcurrencyWhile(async () => migrate(ctx.storage, MIGRATIONS, this.clock()));
	}
}
