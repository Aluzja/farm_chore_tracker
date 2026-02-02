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
		if (!browser || serverChores.length === 0) return;

		try {
			// Convert server chores to local format with synced status
			const localChores: Chore[] = serverChores.map((sc) => ({
				_id: sc.clientId, // Use clientId as local _id for consistency
				text: sc.text,
				isCompleted: sc.isCompleted,
				completedAt: sc.completedAt,
				completedBy: sc.completedBy,
				syncStatus: 'synced' as const,
				lastModified: sc.lastModified
			}));

			// Merge with local data (server wins for same _id with newer timestamp)
			const localMap = new Map(this.items.map((c) => [c._id, c]));

			for (const serverChore of localChores) {
				const local = localMap.get(serverChore._id);
				if (!local || serverChore.lastModified >= local.lastModified) {
					localMap.set(serverChore._id, serverChore);
				}
				// If local is pending and newer, keep local (will sync to server)
			}

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
		// Optimistic UI update
		this.items = this.items.filter((c) => c._id !== id);

		// Remove from IndexedDB
		await deleteChore(id);

		// Queue for sync
		await enqueueMutation('delete', 'chores', { id });
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
