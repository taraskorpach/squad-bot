import type { Api } from 'grammy';
import { Throttle } from './throttle';

export interface RoomOptions {
	storage: DurableObjectStorage;
	chatId: number;
	mentionChunk: number;
	api: Api;
	clock: () => number;
	random: () => number;
}

/**
 * The chat's storage and Telegram client, shared by every write path: updates and alarms.
 * It knows nothing about grammY's context, because an alarm has none.
 */
export class Room {
	readonly chatId: number;
	/** How many mentions go in one message. */
	readonly mentionChunk: number;
	/** The bot's client: capped retries, and every successful call marks its update delivered. */
	readonly api: Api;
	/** Per object, because feature modules are shared by every object in the isolate. */
	readonly throttle = new Throttle();
	readonly #storage: DurableObjectStorage;
	readonly #clock: () => number;
	readonly #random: () => number;

	constructor(options: RoomOptions) {
		this.chatId = options.chatId;
		this.mentionChunk = options.mentionChunk;
		this.api = options.api;
		this.#storage = options.storage;
		this.#clock = options.clock;
		this.#random = options.random;
	}

	clock(): number {
		return this.#clock();
	}

	random(): number {
		return this.#random();
	}

	/**
	 * Reads, decides and writes in one transaction, and returns the decision.
	 * Synchronous on purpose: an await between reading and writing would let other events in.
	 */
	tx<T>(fn: (sql: SqlStorage) => T): T {
		return this.#storage.transactionSync(() => fn(this.#storage.sql));
	}

	/** For idempotent writes, which a redelivery may repeat harmlessly. */
	write<T>(fn: (sql: SqlStorage) => T): T {
		return this.tx(fn);
	}
}
