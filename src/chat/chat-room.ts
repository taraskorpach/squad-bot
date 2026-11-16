import { DurableObject } from 'cloudflare:workers';
import type { Bot, Middleware } from 'grammy';
import type { Update } from 'grammy/types';
import { createBot, FEATURES } from '../bot';
import { type BotContext, UpdateRoom } from '../context';
import { type RoomSettings, readRoomSettings } from '../settings';
import { Room } from './room';
import { MIGRATIONS, migrate } from './schema';
import { SerialQueue } from './serial-queue';
import { isProcessed, pruneUpdateLog, recordProcessed } from './update-log';

/** The bot serves one chat, so there is one object, addressed by this name. */
export const ROOM_NAME = 'chat';

export class ChatRoom extends DurableObject<Env> {
	// Test seams: replace through `runInDurableObject` before the first update,
	// because the bot is built from them on the first queued task.
	clock: () => number = Date.now;
	random: () => number = randomFraction;
	features: readonly Middleware<BotContext>[] = FEATURES;

	readonly #settings: RoomSettings;
	readonly #queue = new SerialQueue();
	#runtime?: { bot: Bot<BotContext>; room: Room };
	#current?: UpdateRoom;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.#settings = readRoomSettings(env);
		void ctx.blockConcurrencyWhile(async () => migrate(ctx.storage, MIGRATIONS, this.clock()));
	}

	/** Resolves once the update has been processed; updates run one at a time, in order. */
	handleUpdate(update: Update): Promise<void> {
		return this.#queue.run(() => this.#process(update));
	}

	async #process(update: Update): Promise<void> {
		const { bot, room } = this.#ensureRuntime();
		const updateId = update.update_id;
		if (room.tx((sql) => isProcessed(sql, updateId))) return;
		this.#current = new UpdateRoom(room, updateId);
		try {
			await bot.handleUpdate(update);
			room.write((sql) => recordProcessed(sql, updateId, room.clock()));
		} finally {
			this.#current = undefined;
			room.write((sql) => pruneUpdateLog(sql, room.clock()));
		}
	}

	#ensureRuntime(): { bot: Bot<BotContext>; room: Room } {
		if (this.#runtime) return this.#runtime;
		const bot = createBot({
			token: this.env.BOT_TOKEN,
			botInfo: this.#settings.botInfo,
			features: this.features,
			currentRoom: () => this.#currentRoom(),
		});
		const room = new Room({
			storage: this.ctx.storage,
			chatId: this.#settings.allowedChatId,
			api: bot.api,
			clock: () => this.clock(),
			random: () => this.random(),
		});
		this.#runtime = { bot, room };
		return this.#runtime;
	}

	#currentRoom(): UpdateRoom {
		if (!this.#current) throw new Error('No update is being processed');
		return this.#current;
	}
}

function randomFraction(): number {
	const [draw = 0] = crypto.getRandomValues(new Uint32Array(1));
	return draw / 2 ** 32;
}
