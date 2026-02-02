import { browser } from '$app/environment';
import {
	getAllChores,
	putChore,
	putChores,
	deleteChore,
	getChore
} from '$lib/db/operations';
import { enqueueMutation } from '$lib/sync/queue';
import type { Chore } from '$lib/db/schema';

class ChoreStore {
	items = $state<Chore[]>([]);
	isLoading = $state(true);
	error = $state<Error | null>(null);
	lastLoadedAt = $state<number | null>(null);

	// Track locally deleted IDs to prevent hydration from re-adding them
	private pendingDeletes = new Set<string>();

	// Load from IndexedDB (instant, offline-first)
	async load(): Promise<void> {
		if (!browser) return;

		try {
			this.isLoading = true;
			this.error = null;
			const chores = await getAllChores();
			this.items = chores.sort((a, b) => b.lastModified - a.lastModified);
			this.lastLoadedAt = Date.now();
		} catch (e) {
			this.error = e instanceof Error ? e : new Error(String(e));
			console.error('[ChoreStore] Load error:', e);
		} finally {
			this.isLoading = false;
		}
	}

	// Hydrate from Convex server data (called when online)
	async hydrateFromServer(
		serverChores: Array<{
			_id: string;
			clientId: string;
			text: string;
			isCompleted: boolean;
			completedAt?: string;
			completedBy?: string;
			lastModified: number;
		}>
	): Promise<void> {
		if (!browser) return;

		try {
			// Convert server chores to local format, excluding pending deletes
			const serverMap = new Map<string, Chore>();
			for (const sc of serverChores) {
				// Skip items that are pending local deletion
				if (this.pendingDeletes.has(sc.clientId)) continue;

				serverMap.set(sc.clientId, {
					_id: sc.clientId,
					text: sc.text,
					isCompleted: sc.isCompleted,
					completedAt: sc.completedAt,
					completedBy: sc.completedBy,
					syncStatus: 'synced' as const,
					lastModified: sc.lastModified
				});
			}

			// Build merged map starting with local items
			const localMap = new Map(this.items.map((c) => [c._id, c]));
			let hasChanges = false;

			// Merge server data (server wins for same _id with newer or equal timestamp)
			for (const [id, serverChore] of serverMap) {
				const local = localMap.get(id);
				if (!local) {
					// New item from server
					localMap.set(id, serverChore);
					hasChanges = true;
				} else if (local.syncStatus === 'pending') {
					// Local has pending changes, keep local version
				} else if (serverChore.lastModified > local.lastModified) {
					// Server is newer, update local
					localMap.set(id, serverChore);
					hasChanges = true;
				} else if (
					serverChore.lastModified === local.lastModified &&
					local.syncStatus !== 'synced'
				) {
					// Same timestamp but local not marked synced, update status
					localMap.set(id, { ...local, syncStatus: 'synced' });
					hasChanges = true;
				}
			}

			// Check for items that exist locally but not on server (and aren't pending)
			for (const [id, local] of localMap) {
				if (!serverMap.has(id) && local.syncStatus === 'synced') {
					// Item was deleted on server, remove locally
					localMap.delete(id);
					hasChanges = true;
				}
			}

			if (!hasChanges) return;

			const merged = Array.from(localMap.values());

			// Persist merged data to IndexedDB
			await putChores(merged);

			// Update reactive state
			this.items = merged.sort((a, b) => b.lastModified - a.lastModified);
			this.lastLoadedAt = Date.now();
		} catch (e) {
			console.error('[ChoreStore] Hydration error:', e);
			// Don't set error - hydration failure shouldn't break the app
		}
	}

	// Add new chore (optimistic + queue)
	async add(text: string, completedBy?: string): Promise<string> {
		const newChore: Chore = {
			_id: crypto.randomUUID(),
			text,
			isCompleted: false,
			completedBy,
			syncStatus: 'pending',
			lastModified: Date.now()
		};

		// Optimistic UI update
		this.items = [newChore, ...this.items];

		// Persist to IndexedDB
		await putChore(newChore);

		// Queue for sync - use clientId for Convex
		await enqueueMutation('create', 'chores', {
			clientId: newChore._id,
			text: newChore.text,
			isCompleted: newChore.isCompleted,
			completedBy: newChore.completedBy,
			lastModified: newChore.lastModified
		});

		return newChore._id;
	}

	// Toggle completion (optimistic + queue)
	async toggleComplete(id: string, completedBy?: string): Promise<void> {
		const chore = this.items.find((c) => c._id === id);
		if (!chore) return;

		const now = Date.now();
		const updated: Chore = {
			...chore,
			isCompleted: !chore.isCompleted,
			completedAt: !chore.isCompleted ? new Date(now).toISOString() : undefined,
			completedBy: !chore.isCompleted ? completedBy : undefined,
			syncStatus: 'pending',
			lastModified: now
		};

		// Optimistic UI update - use $state.snapshot to avoid proxy issues
		this.items = this.items.map((c) => (c._id === id ? updated : c));

		// Persist to IndexedDB (use snapshot to avoid storing Proxy)
		await putChore($state.snapshot(updated));

		// Queue for sync
		await enqueueMutation('update', 'chores', {
			id: updated._id,
			isCompleted: updated.isCompleted,
			completedAt: updated.completedAt,
			completedBy: updated.completedBy,
			lastModified: updated.lastModified
		});
	}

	// Update chore text (optimistic + queue)
	async updateText(id: string, text: string): Promise<void> {
		const chore = this.items.find((c) => c._id === id);
		if (!chore) return;

		const updated: Chore = {
			...chore,
			text,
			syncStatus: 'pending',
			lastModified: Date.now()
		};

		this.items = this.items.map((c) => (c._id === id ? updated : c));
		await putChore($state.snapshot(updated));

		await enqueueMutation('update', 'chores', {
			id: updated._id,
			text: updated.text,
			lastModified: updated.lastModified
		});
	}

	// Delete chore (optimistic + queue)
	async remove(id: string): Promise<void> {
		// Track as pending delete to prevent hydration from re-adding
		this.pendingDeletes.add(id);

		// Optimistic UI update
		this.items = this.items.filter((c) => c._id !== id);

		// Remove from IndexedDB
		await deleteChore(id);

		// Queue for sync
		await enqueueMutation('delete', 'chores', { id });
	}

	// Called by sync engine after successful delete sync
	confirmDelete(id: string): void {
		this.pendingDeletes.delete(id);
	}

	// Called by sync engine after successful create/update sync
	markSynced(id: string): void {
		const index = this.items.findIndex((c) => c._id === id);
		if (index !== -1 && this.items[index].syncStatus !== 'synced') {
			// Update in place to avoid full array replacement
			this.items[index] = { ...this.items[index], syncStatus: 'synced' };
		}
	}

	// Get chore by ID (reactive derived would be better, but simple for now)
	getById(id: string): Chore | undefined {
		return this.items.find((c) => c._id === id);
	}

	// Computed stats
	get completedCount(): number {
		return this.items.filter((c) => c.isCompleted).length;
	}

	get pendingCount(): number {
		return this.items.filter((c) => c.syncStatus === 'pending').length;
	}

	get failedCount(): number {
		return this.items.filter((c) => c.syncStatus === 'failed').length;
	}
}

export const choreStore = new ChoreStore();
