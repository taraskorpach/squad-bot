import { describe, expect, it } from 'vitest';
import { SerialQueue } from '../../src/chat/serial-queue';

function deferred() {
	let resolve: () => void = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

const settle = () => new Promise((done) => setTimeout(done, 0));

describe('SerialQueue', () => {
	it('runs each task to the end before the next one starts', async () => {
		const queue = new SerialQueue();
		const log: string[] = [];
		const firstMayEnd = deferred();

		const first = queue.run(async () => {
			log.push('first starts');
			await firstMayEnd.promise;
			log.push('first ends');
		});
		const second = queue.run(async () => {
			log.push('second runs');
		});
		await settle();

		expect(log).toEqual(['first starts']);

		firstMayEnd.resolve();
		await Promise.all([first, second]);

		expect(log).toEqual(['first starts', 'first ends', 'second runs']);
	});

	it("gives each caller its own task's result", async () => {
		const queue = new SerialQueue();

		await expect(
			Promise.all([queue.run(async () => 1), queue.run(async () => 2)]),
		).resolves.toEqual([1, 2]);
	});

	it('keeps going after a task fails, and rejects only that task', async () => {
		const queue = new SerialQueue();

		const failing = queue.run(async () => {
			throw new Error('boom');
		});
		const next = queue.run(async () => 'still runs');

		await expect(failing).rejects.toThrow('boom');
		await expect(next).resolves.toBe('still runs');
	});
});
