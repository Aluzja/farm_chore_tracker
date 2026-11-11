export class TimeoutError extends Error {}

// Convex calls wait forever for a connection, so cap how long we wait
export function withTimeout<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => setTimeout(() => reject(new TimeoutError('timeout')), ms))
	]);
}
