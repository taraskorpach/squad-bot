/**
 * Runs tasks one at a time, each to the end, in the order they were queued.
 * A failed task rejects its own caller and the queue moves on.
 */
export class SerialQueue {
	#tail: Promise<unknown> = Promise.resolve();

	run<T>(task: () => Promise<T>): Promise<T> {
		const result = this.#tail.then(task);
		this.#tail = result.catch(() => undefined);
		return result;
	}
}
