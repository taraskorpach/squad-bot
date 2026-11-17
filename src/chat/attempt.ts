/**
 * A Telegram call after the update's change has committed. Nothing will be redelivered, so a
 * failure is logged and the next call still goes. Gives back the call's result, or nothing.
 */
export async function attempt<T>(what: string, call: () => Promise<T>): Promise<T | undefined> {
	try {
		return await call();
	} catch (error) {
		console.error(`${what} failed`, error);
		return undefined;
	}
}
