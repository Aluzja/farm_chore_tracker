/* eslint-disable svelte/prefer-svelte-reactivity */
import { browser } from '$app/environment';
import { getDailyChoresByDate, putDailyChore, putDailyChores } from '$lib/db/operations';
import { enqueueMutation } from '$lib/sync/queue';
import { getTodayDateString } from '$lib/utils/date';
import type { DailyChore } from '$lib/db/schema';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

interface CategoryGroup {
	name: string;
	chores: DailyChore[];
}

interface TimeSlotGroup {
	timeSlot: TimeSlot;
	categories: CategoryGroup[];
}

class DailyChoreStore {
	items = $state<DailyChore[]>([]);
	isLoading = $state(true);
	error = $state<Error | null>(null);
	currentDate = $state(getTodayDateString());

	// Whether we've received at least one server hydration
	serverHydrated = $state(false);

	// Track pending deletes to prevent hydration conflicts
	private pendingDeletes = new Set<string>();

	// Grouped by time slot, then by animal category
	grouped = $derived.by(() => {
		const timeSlotOrder: TimeSlot[] = ['morning', 'afternoon', 'evening'];
		const result: TimeSlotGroup[] = [];

		for (const timeSlot of timeSlotOrder) {
			const slotChores = this.items.filter((c) => c.timeSlot === timeSlot);
			if (slotChores.length === 0) continue;

			// Group by animal category
			const categoryMap = new Map<string, DailyChore[]>();
			for (const chore of slotChores) {
				const category = chore.animalCategory || 'General';
				if (!categoryMap.has(category)) {
					categoryMap.set(category, []);
				}
				categoryMap.get(category)!.push(chore);
			}

			// Sort categories alphabetically, chores by sortOrder
			const categories = Array.from(categoryMap.entries())
				.map(([name, chores]) => ({
					name,
					chores: chores.sort((a, b) => a.sortOrder - b.sortOrder)
				}))
				.sort((a, b) => a.name.localeCompare(b.name));

			result.push({ timeSlot, categories });
		}

		return result;
	});

	// Progress stats
	completedCount = $derived(this.items.filter((c) => c.isCompleted).length);
	totalCount = $derived(this.items.length);
	progress = $derived(
		this.totalCount > 0 ? Math.round((this.completedCount / this.totalCount) * 100) : 0
	);

	// Load from IndexedDB for today
	async load(): Promise<void> {
		if (!browser) return;

		try {
			this.isLoading = true;
			this.error = null;
			this.currentDate = getTodayDateString();
			const chores = await getDailyChoresByDate(this.currentDate);
			this.items = chores;
			// If we got local data, stop loading immediately so we show it.
			// If local cache is empty, keep isLoading true until server hydrates
			// (prevents flash of "No chores for today" before server data arrives).
			if (chores.length > 0) {
				this.isLoading = false;
			}
		} catch (e) {
			this.error = e instanceof Error ? e : new Error(String(e));
			this.isLoading = false;
			console.error('[DailyChoreStore] Load error:', e);
		}
	}

	// Hydrate from Convex server data
	async hydrateFromServer(
		serverChores: Array<{
			_id: string;
			clientId: string;
			date: string;
			masterChoreId?: string;
			text: string;
			description?: string;
			timeSlot: string;
			animalCategory: string;
			sortOrder: number;
			isCompleted: boolean;
			completedAt?: string;
			completedBy?: string;
			isAdHoc: boolean;
			requiresPhoto: boolean;
			photoStorageId?: string;
			thumbnailStorageId?: string;
			photoStatus?: string;
			lastModified: number;
		}>
	): Promise<void> {
		if (!browser) return;

		try {
			const today = getTodayDateString();
			// Only hydrate today's chores
			const todayChores = serverChores.filter((c) => c.date === today);

			const serverMap = new Map<string, DailyChore>();
			for (const sc of todayChores) {
				if (this.pendingDeletes.has(sc.clientId)) continue;

				serverMap.set(sc.clientId, {
					_id: sc.clientId,
					date: sc.date,
					masterChoreId: sc.masterChoreId,
					text: sc.text,
					description: sc.description,
					timeSlot: sc.timeSlot,
					animalCategory: sc.animalCategory,
					sortOrder: sc.sortOrder,
					isCompleted: sc.isCompleted,
					completedAt: sc.completedAt,
					completedBy: sc.completedBy,
					isAdHoc: sc.isAdHoc,
					requiresPhoto: sc.requiresPhoto,
					photoStorageId: sc.photoStorageId,
					thumbnailStorageId: sc.thumbnailStorageId,
					photoStatus: sc.photoStatus as DailyChore['photoStatus'],
					syncStatus: 'synced' as const,
					lastModified: sc.lastModified
				});
			}

			// Merge with local
			const localMap = new Map(this.items.map((c) => [c._id, c]));
			let hasChanges = false;

			for (const [id, serverChore] of serverMap) {
				const local = localMap.get(id);
				if (!local) {
					localMap.set(id, serverChore);
					hasChanges = true;
				} else if (local.syncStatus === 'pending') {
					// Keep local pending changes
				} else if (serverChore.lastModified > local.lastModified) {
					localMap.set(id, serverChore);
					hasChanges = true;
				}
			}

			// Remove items deleted on server (if synced locally)
			for (const [id, local] of localMap) {
				if (!serverMap.has(id) && local.syncStatus === 'synced') {
					localMap.delete(id);
					hasChanges = true;
				}
			}

			this.serverHydrated = true;
			this.isLoading = false;

			if (!hasChanges) return;

			const merged = Array.from(localMap.values());
			await putDailyChores(merged);
			this.items = merged;
		} catch (e) {
			console.error('[DailyChoreStore] Hydration error:', e);
		}
	}

	// Toggle completion
	async toggleComplete(
		id: string,
		userName: string,
		extra?: Partial<Pick<DailyChore, 'photoStatus'>>
	): Promise<void> {
		const chore = this.items.find((c) => c._id === id);
		if (!chore) return;

		const now = Date.now();
		const nowIso = new Date(now).toISOString();
		const updated: DailyChore = {
			...chore,
			isCompleted: !chore.isCompleted,
			completedAt: !chore.isCompleted ? nowIso : undefined,
			completedBy: !chore.isCompleted ? userName : undefined,
			...extra,
			syncStatus: 'pending',
			lastModified: now
		};

		// Optimistic update
		this.items = this.items.map((c) => (c._id === id ? updated : c));

		// Persist to IndexedDB
		await putDailyChore($state.snapshot(updated));

		// Queue for sync
		await enqueueMutation('update', 'dailyChores', {
			clientId: updated._id,
			isCompleted: updated.isCompleted,
			completedAt: updated.completedAt,
			completedBy: updated.completedBy,
			...extra,
			lastModified: updated.lastModified
		});
	}

	// Mark item as synced
	markSynced(id: string): void {
		const index = this.items.findIndex((c) => c._id === id);
		if (index !== -1 && this.items[index].syncStatus !== 'synced') {
			this.items[index] = { ...this.items[index], syncStatus: 'synced' };
		}
	}

	// Mark item as failed
	markFailed(id: string): void {
		const index = this.items.findIndex((c) => c._id === id);
		if (index !== -1 && this.items[index].syncStatus !== 'failed') {
			this.items[index] = { ...this.items[index], syncStatus: 'failed' };
		}
	}

	// Get count of failed items
	get failedCount(): number {
		return this.items.filter((c) => c.syncStatus === 'failed').length;
	}

	// Reset failed items to pending for retry
	async resetFailedToPending(): Promise<number> {
		const failedItems = this.items.filter((c) => c.syncStatus === 'failed');
		let count = 0;

		for (const chore of failedItems) {
			const updated: DailyChore = { ...chore, syncStatus: 'pending' };
			this.items = this.items.map((c) => (c._id === chore._id ? updated : c));
			await putDailyChore($state.snapshot(updated));
			count++;
		}

		return count;
	}

	// Clear photoStatus on a chore (when photo upload permanently fails)
	async clearPhotoStatus(id: string): Promise<void> {
		const chore = this.items.find((c) => c._id === id);
		if (!chore || chore.photoStatus !== 'pending') return;

		const updated: DailyChore = {
			...chore,
			photoStatus: undefined,
			lastModified: Date.now()
		};
		this.items = this.items.map((c) => (c._id === id ? updated : c));
		await putDailyChore($state.snapshot(updated));
	}

	// Clear all photo fields on a chore (when photo reference is broken)
	async clearBrokenPhoto(id: string): Promise<void> {
		const chore = this.items.find((c) => c._id === id);
		if (!chore) return;

		const updated: DailyChore = {
			...chore,
			photoStorageId: undefined,
			thumbnailStorageId: undefined,
			photoStatus: undefined,
			lastModified: Date.now()
		};
		this.items = this.items.map((c) => (c._id === id ? updated : c));
		await putDailyChore($state.snapshot(updated));
	}

	// Add ad-hoc chore for today only
	async addAdHoc(
		text: string,
		timeSlot: 'morning' | 'afternoon' | 'evening',
		animalCategory: string,
		createdBy: string
	): Promise<string> {
		const now = Date.now();
		const clientId = crypto.randomUUID();

		// Calculate sortOrder (max + 1 for this time slot)
		const slotChores = this.items.filter((c) => c.timeSlot === timeSlot);
		const maxOrder = slotChores.length > 0 ? Math.max(...slotChores.map((c) => c.sortOrder)) : 0;

		const newChore: DailyChore = {
			_id: clientId,
			date: this.currentDate,
			masterChoreId: undefined,
			text,
			timeSlot,
			animalCategory: animalCategory || 'General',
			sortOrder: maxOrder + 1,
			isCompleted: false,
			isAdHoc: true,
			requiresPhoto: false, // Ad-hoc chores don't require photos
			syncStatus: 'pending',
			lastModified: now
		};

		// Optimistic update
		this.items = [...this.items, newChore];

		// Persist to IndexedDB
		await putDailyChore(newChore);

		// Queue for sync
		await enqueueMutation('create', 'dailyChores', {
			clientId: newChore._id,
			text: newChore.text,
			timeSlot: newChore.timeSlot,
			animalCategory: newChore.animalCategory,
			date: newChore.date,
			createdBy,
			lastModified: newChore.lastModified
		});

		return clientId;
	}

	// Confirm delete (for future delete feature)
	confirmDelete(id: string): void {
		this.pendingDeletes.delete(id);
	}
}

export const dailyChoreStore = new DailyChoreStore();
