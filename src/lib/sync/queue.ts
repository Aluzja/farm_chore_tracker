import { getDB } from '$lib/db/client';
import { STORES, MutationSchema, type Mutation } from '$lib/db/schema';

export async function enqueueMutation(
	type: Mutation['type'],
	table: string,
	payload: Record<string, unknown>
): Promise<string> {
	const db = await getDB();
	const mutation: Mutation = {
		id: crypto.randomUUID(),
		type,
		table,
		payload,
		createdAt: Date.now(),
		retryCount: 0
	};

	// Validate before storing
	MutationSchema.parse(mutation);
	await db.add(STORES.mutationQueue, mutation);

	// Trigger sync engine to process immediately
	// Import dynamically to avoid circular dependency
	const { syncEngine } = await import('./engine.svelte');
	syncEngine.processQueue();

	return mutation.id;
}

export async function getPendingMutations(): Promise<Mutation[]> {
	const db = await getDB();
	return db.getAllFromIndex(STORES.mutationQueue, 'by-created-at');
}

export async function getMutation(id: string): Promise<Mutation | undefined> {
	const db = await getDB();
	return db.get(STORES.mutationQueue, id);
}

export async function removeMutation(id: string): Promise<void> {
	const db = await getDB();
	await db.delete(STORES.mutationQueue, id);
}

export async function incrementRetry(id: string): Promise<number> {
	const db = await getDB();
	const tx = db.transaction(STORES.mutationQueue, 'readwrite');
	const mutation = await tx.store.get(id);
	if (mutation) {
		mutation.retryCount += 1;
		await tx.store.put(mutation);
		await tx.done;
		return mutation.retryCount;
	}
	await tx.done;
	return 0;
}

export async function markFailed(id: string): Promise<void> {
	// For now, we keep failed mutations in queue for manual retry
	// Could move to a separate 'failedMutations' store if needed
	const db = await getDB();
	const mutation = await db.get(STORES.mutationQueue, id);
	if (mutation) {
		// Update payload to mark as failed
		mutation.payload = { ...mutation.payload, _failed: true, _failedAt: Date.now() };
		await db.put(STORES.mutationQueue, mutation);
	}
}

export async function getQueueLength(): Promise<number> {
	const db = await getDB();
	return db.count(STORES.mutationQueue);
}

export async function clearQueue(): Promise<void> {
	const db = await getDB();
	await db.clear(STORES.mutationQueue);
}
