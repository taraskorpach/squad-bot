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
 * What an action needs of a room. A handler passes the update's room, whose `tx` records the
 * update with the change; the alarm passes the plain one.
 */
export interface RoomAccess {
	readonly chatId: number;
	/** How many mentions go in one message. */
	readonly mentionChunk: number;
	readonly api: Api;
	clock(): number;
	random(): number;
	/** Every change a redelivery must not repeat: read, decide and write in one transaction. */
	tx<T>(fn: (sql: SqlStorage) => T): T;
	/** For idempotent writes, which a redelivery may repeat harmlessly. */
	write<T>(fn: (sql: SqlStorage) => T): T;
	/** Reads that change nothing. */
	read<T>(fn: (sql: SqlStorage) => T): T;
}

/**
 * The chat's storage and Telegram client, shared by every write path: updates and alarms.
 * It knows nothing about grammY's context, because an alarm has none.
 */
export class Room implements RoomAccess {
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

	read<T>(fn: (sql: SqlStorage) => T): T {
		return this.tx(fn);
	}
}
