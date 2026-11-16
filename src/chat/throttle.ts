/**
 * When each kind of action last ran in this object, so it runs at most once per window. Kept in
 * memory: an evicted object has been idle longer than any window, so losing it only lets an
 * action run again.
 */
export class Throttle {
	readonly #lastRanAt = new Map<string, number>();

	/** True when `key` may run now, which then counts as its last run; false inside its window. */
	claim(key: string, now: number, windowMs: number): boolean {
		const lastRanAt = this.#lastRanAt.get(key);
		if (lastRanAt !== undefined && now - lastRanAt < windowMs) return false;
		this.#lastRanAt.set(key, now);
		return true;
	}
}
