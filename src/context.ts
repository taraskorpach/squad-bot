import type { Api, Context } from 'grammy';
import type { Room, RoomAccess } from './chat/room';
import type { Throttle } from './chat/throttle';
import { recordProcessed } from './chat/update-log';

export type BotContext = Context & { room: UpdateRoom };

/**
 * One update's view of the room. `commit` is for every non-idempotent change: the change and
 * the update's id commit together, so a redelivery can never apply it twice.
 */
export class UpdateRoom implements RoomAccess {
	readonly room: Room;
	readonly updateId: number;
	#committed = false;
	#delivered = false;
	#stale = false;

	constructor(room: Room, updateId: number) {
		this.room = room;
		this.updateId = updateId;
	}

	commit<T>(fn: (sql: SqlStorage) => T): T {
		const decision = this.room.tx((sql) => {
			recordProcessed(sql, this.updateId, this.room.clock());
			return fn(sql);
		});
		this.#committed = true;
		return decision;
	}

	/** As `commit`, so an action handed this room records the update with its change. */
	tx<T>(fn: (sql: SqlStorage) => T): T {
		return this.commit(fn);
	}

	/** For idempotent writes: they don't mark the update committed. */
	write<T>(fn: (sql: SqlStorage) => T): T {
		return this.room.write(fn);
	}

	read<T>(fn: (sql: SqlStorage) => T): T {
		return this.room.read(fn);
	}

	clock(): number {
		return this.room.clock();
	}

	random(): number {
		return this.room.random();
	}

	get chatId(): number {
		return this.room.chatId;
	}

	get api(): Api {
		return this.room.api;
	}

	get mentionChunk(): number {
		return this.room.mentionChunk;
	}

	get throttle(): Throttle {
		return this.room.throttle;
	}

	/** True once a change of this update has committed. */
	get committed(): boolean {
		return this.#committed;
	}

	/** True once any Telegram call of this update succeeded. */
	get delivered(): boolean {
		return this.#delivered;
	}

	/** True for a message that reached the bot over 10 minutes late. */
	get stale(): boolean {
		return this.#stale;
	}

	markDelivered(): void {
		this.#delivered = true;
	}

	markStale(): void {
		this.#stale = true;
	}
}
