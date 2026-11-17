import type { Api } from 'grammy';
import { Throttle } from './throttle';

/** After an unexpected error the alarm tries again this much later, never at a past time. */
const ALARM_RETRY_MS = 60 * 1000;

/** What the object's alarm runs, assembled in src/bot.ts so chat/ imports no feature. */
export interface Timers {
	/** When the alarm next has work, read synchronously; none when nothing is scheduled. */
	nextDue(sql: SqlStorage, now: number): number | undefined;
	/** Runs every timer action that is due. */
	run(room: RoomAccess): Promise<void>;
}

export interface RoomOptions {
	storage: DurableObjectStorage;
	chatId: number;
	mentionChunk: number;
	api: Api;
	clock: () => number;
	random: () => number;
	nextDue: Timers['nextDue'];
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
	/**
	 * Points the alarm at the next due timer. Called right after a commit that moved it, in the
	 * same synchronous block and without awaiting, so the alarm commits with the change.
	 */
	arm(): void;
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
	readonly #nextDue: Timers['nextDue'];

	constructor(options: RoomOptions) {
		this.chatId = options.chatId;
		this.mentionChunk = options.mentionChunk;
		this.api = options.api;
		this.#storage = options.storage;
		this.#clock = options.clock;
		this.#random = options.random;
		this.#nextDue = options.nextDue;
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

	arm(): void {
		const due = this.#due();
		const arming = due === undefined ? this.#storage.deleteAlarm() : this.#storage.setAlarm(due);
		arming.catch((error: unknown) => console.error('Pointing the alarm failed', error));
	}

	/** At the end of every task: sets the alarm where it differs, which restores a lost one too. */
	async armIfChanged(): Promise<void> {
		const due = this.#due() ?? null;
		if ((await this.#storage.getAlarm()) === due) return;
		await (due === null ? this.#storage.deleteAlarm() : this.#storage.setAlarm(due));
	}

	/** After an unexpected error in the alarm: once more in a minute, so it never stops silently. */
	async retryAlarmSoon(): Promise<void> {
		await this.#storage.setAlarm(this.clock() + ALARM_RETRY_MS);
	}

	#due(): number | undefined {
		return this.read((sql) => this.#nextDue(sql, this.clock()));
	}
}
