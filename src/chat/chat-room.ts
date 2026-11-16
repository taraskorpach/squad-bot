import { DurableObject } from 'cloudflare:workers';
import { type Bot, BotError, type Middleware } from 'grammy';
import type { Update } from 'grammy/types';
import { createBot, FEATURES } from '../bot';
import { type BotContext, UpdateRoom } from '../context';
import { type RoomSettings, readRoomSettings } from '../settings';
import { canRedeliver, redeliveryCapReached } from './failure-policy';
import { Room } from './room';
import { MIGRATIONS, migrate } from './schema';
import { SerialQueue } from './serial-queue';
import { isProcessed, pruneUpdateLog, recordFailure, recordProcessed } from './update-log';

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

	/** Rejects, so the Worker answers 500 and Telegram redelivers, only as the policy allows. */
	async #process(update: Update): Promise<void> {
		const { bot, room } = this.#ensureRuntime();
		const updateId = update.update_id;
		if (room.tx((sql) => isProcessed(sql, updateId))) return;
		const current = new UpdateRoom(room, updateId);
		this.#current = current;
		try {
			await bot.handleUpdate(update);
		} catch (thrown) {
			const error = thrown instanceof BotError ? thrown.error : thrown;
			if (this.#shouldRedeliver(current, error)) throw error;
			console.error(`Update ${updateId} failed and is acknowledged without redelivery`, error);
		} finally {
			this.#current = undefined;
		}
		room.write((sql) => {
			recordProcessed(sql, updateId, room.clock());
			pruneUpdateLog(sql, room.clock());
		});
	}

	/** Only failures a retry can't duplicate are counted, and only they count toward the cap. */
	#shouldRedeliver(update: UpdateRoom, error: unknown): boolean {
		const { room, updateId, committed, delivered } = update;
		if (!canRedeliver({ committed, delivered, error })) return false;
		const count = room.tx((sql) => recordFailure(sql, updateId, room.clock()));
		return !redeliveryCapReached(count, room.clock());
	}

	#ensureRuntime(): { bot: Bot<BotContext>; room: Room } {
		if (this.#runtime) return this.#runtime;
		const bot = createBot({
			token: this.env.BOT_TOKEN,
			botInfo: this.#settings.botInfo,
			features: this.features,
			currentRoom: () => this.#currentRoom(),
			onDelivered: () => this.#current?.markDelivered(),
		});
		const room = new Room({
			storage: this.ctx.storage,
			chatId: this.#settings.allowedChatId,
			mentionChunk: this.#settings.mentionChunk,
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
