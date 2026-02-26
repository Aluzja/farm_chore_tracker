import { browser } from '$app/environment';
import type { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { getStoredAccessKey } from '$lib/auth/access-key';
import { connectionStatus } from './status.svelte';
import {
	getPendingMutations,
	removeMutation,
	incrementRetry,
	markFailed,
	getQueueLength
} from './queue';
import {
	getPhotoQueue,
	removePhoto,
	incrementPhotoRetry,
	markPhotoFailed,
	markPhotoUploading,
	getPendingPhotoCount,
	getFailedPhotoCount
} from '$lib/photo/queue';
import { uploadPhoto } from '$lib/photo/upload';
import { getDailyChore, getDailyChoresByStatus, putDailyChore } from '$lib/db/operations';
import type { Mutation } from '$lib/db/schema';

const MAX_RETRIES = 5;
const SYNC_INTERVAL_MS = 30_000; // 30 seconds when online and visible

// Exponential backoff schedule for photo retries (in ms)
export const PHOTO_BACKOFF_MS = [5_000, 15_000, 45_000, 120_000, 300_000]; // 5s, 15s, 45s, 2min, 5min

// Global reference to Convex client, set by layout component
let convexClient: ConvexClient | null = null;

/**
 * Set the Convex client for sync engine to use.
 * Call this from the layout component after setupConvex.
 */
export function setConvexClient(client: ConvexClient): void {
	convexClient = client;
}

/**
 * Get the current Convex client.
 * Returns null if not yet initialized.
 */
export function getConvexClient(): ConvexClient | null {
	return convexClient;
}

class SyncEngine {
	isSyncing = $state(false);
	pendingCount = $state(0);
	failedCount = $state(0);
	lastSyncedAt = $state<number | null>(null);
	lastError = $state<string | null>(null);

	// Photo queue state
	isUploadingPhotos = $state(false);
	pendingPhotoCount = $state(0);
	failedPhotoCount = $state(0);
	currentPhotoUpload = $state<string | null>(null);

	private syncIntervalId: ReturnType<typeof setInterval> | null = null;
	private initialized = false;

	// Bound event handlers for cleanup
	private handleOnline = () => {
		this.processQueue();
		this.autoRetryFailedPhotos();
	};
	private handleVisibility = () => {
		if (document.visibilityState === 'visible' && connectionStatus.isOnline) {
			this.processQueue();
			this.processPhotoQueue();
		}
	};

	async init() {
		if (!browser || this.initialized) return;
		this.initialized = true;

		// Request persistent storage so the browser is less likely to evict
		// photo blobs from IndexedDB under memory pressure
		if (navigator.storage?.persist) {
			try {
				await navigator.storage.persist();
			} catch {
				// Non-critical — best-effort
			}
		}

		// Initial mutation queue counts
		this.pendingCount = await getQueueLength();
		this.failedCount = (await getDailyChoresByStatus('failed')).length;

		// Initial photo queue counts
		this.pendingPhotoCount = await getPendingPhotoCount();
		this.failedPhotoCount = await getFailedPhotoCount();

		// Process queue if we start online
		if (connectionStatus.isOnline) {
			await this.processQueue();
		}

		// Set up periodic sync when online
		this.startPeriodicSync();

		// Listen for online/visibility events directly
		window.addEventListener('online', this.handleOnline);
		document.addEventListener('visibilitychange', this.handleVisibility);
	}

	private startPeriodicSync() {
		if (this.syncIntervalId) return;

		this.syncIntervalId = setInterval(() => {
			if (connectionStatus.isOnline && document.visibilityState === 'visible') {
				this.processQueue();
				this.processPhotoQueue();
			}
		}, SYNC_INTERVAL_MS);
	}

	async processQueue() {
		if (this.isSyncing || !connectionStatus.isOnline) return;

		this.isSyncing = true;
		this.lastError = null;

		try {
			const mutations = await getPendingMutations();
			this.pendingCount = mutations.length;

			for (const mutation of mutations) {
				// Skip already-failed mutations
				if (mutation.payload._failed) continue;

				try {
					await this.applyMutation(mutation);
					await removeMutation(mutation.id);
					this.pendingCount = Math.max(0, this.pendingCount - 1);
				} catch (error) {
					const retryCount = await incrementRetry(mutation.id);
					if (retryCount >= MAX_RETRIES) {
						await markFailed(mutation.id);
						this.failedCount += 1;
						// Mark the associated dailyChore as failed in the store
						if (mutation.table === 'dailyChores') {
							const clientId = (mutation.payload.clientId || mutation.payload.id) as string;
							if (clientId) {
								const { dailyChoreStore } = await import('$lib/stores/dailyChores.svelte');
								dailyChoreStore.markFailed(clientId);
							}
						}
						console.error(
							`[Sync] Mutation ${mutation.id} failed after ${MAX_RETRIES} retries`,
							error
						);
					} else {
						console.warn(
							`[Sync] Mutation ${mutation.id} failed, retry ${retryCount}/${MAX_RETRIES}`,
							error
						);
					}
				}
			}

			this.lastSyncedAt = Date.now();
		} catch (error) {
			this.lastError = error instanceof Error ? error.message : 'Sync failed';
			console.error('[Sync] Queue processing error:', error);
		} finally {
			this.isSyncing = false;
		}

		// Process photo queue independently — never blocks mutation syncing
		this.processPhotoQueue();
	}

	async processPhotoQueue(): Promise<void> {
		if (this.isUploadingPhotos) return;

		const client = getConvexClient();
		if (!client || !connectionStatus.isOnline) return;

		this.isUploadingPhotos = true;
		try {
			const photos = await getPhotoQueue();
			this.pendingPhotoCount = photos.filter((p) => p.uploadStatus !== 'failed').length;

			// Process sequentially (one at a time)
			for (const photo of photos) {
				if (photo.uploadStatus === 'failed') continue;

				// Skip photos not yet ready for retry (exponential backoff)
				if (photo.nextRetryAt && Date.now() < photo.nextRetryAt) continue;

				this.currentPhotoUpload = photo.id;

				// Validate blob is still intact (iOS Safari can evict IndexedDB blob data)
				if (!photo.blob || photo.blob.size === 0) {
					console.error(`[Sync] Photo ${photo.id} has empty blob — data was evicted`);
					await markPhotoFailed(photo.id);
					this.failedPhotoCount += 1;
					await this.clearChorePhotoStatus(photo.dailyChoreClientId);
					continue;
				}

				await markPhotoUploading(photo.id);

				try {
					await uploadPhoto(
						client,
						photo.blob,
						photo.dailyChoreClientId,
						photo.capturedAt,
						photo.capturedBy,
						photo.thumbnailBlob
					);
					await removePhoto(photo.id);
					this.pendingPhotoCount = Math.max(0, this.pendingPhotoCount - 1);
				} catch (error) {
					const retryCount = await incrementPhotoRetry(photo.id);
					if (retryCount >= MAX_RETRIES) {
						await markPhotoFailed(photo.id);
						this.failedPhotoCount += 1;
						await this.clearChorePhotoStatus(photo.dailyChoreClientId);
						console.error(
							`[Sync] Photo ${photo.id} failed after ${MAX_RETRIES} retries`,
							error
						);
					} else {
						console.warn(
							`[Sync] Photo ${photo.id} failed, retry ${retryCount}/${MAX_RETRIES}`,
							error
						);
					}
				}
			}

			this.currentPhotoUpload = null;
		} finally {
			this.isUploadingPhotos = false;
		}
	}

	private async clearChorePhotoStatus(dailyChoreClientId: string): Promise<void> {
		try {
			const { dailyChoreStore } = await import('$lib/stores/dailyChores.svelte');
			await dailyChoreStore.clearPhotoStatus(dailyChoreClientId);

			const client = getConvexClient();
			if (client && connectionStatus.isOnline) {
				const accessKey = getStoredAccessKey() ?? undefined;
				await client.mutation(api.photos.clearPhotoStatus, {
					dailyChoreClientId,
					accessKey
				});
			}
		} catch (err) {
			console.warn('[Sync] Failed to clear photoStatus:', dailyChoreClientId, err);
		}
	}

	private async applyMutation(mutation: Mutation): Promise<void> {
		const client = getConvexClient();
		if (!client) {
			throw new Error('Convex client not available');
		}

		const { type, table, payload } = mutation;

		switch (table) {
			case 'dailyChores':
				await this.applyDailyChoresMutation(client, type, payload);
				break;
			default:
				throw new Error(`Unknown table: ${table}`);
		}
	}

	private async applyDailyChoresMutation(
		client: ConvexClient,
		type: Mutation['type'],
		payload: Record<string, unknown>
	): Promise<void> {
		const accessKey = getStoredAccessKey() ?? undefined;
		switch (type) {
			case 'create': {
				const createId = payload.clientId as string;
				await client.mutation(api.dailyChores.addAdHoc, {
					...(payload as {
						clientId: string;
						text: string;
						timeSlot: string;
						animalCategory: string;
						date: string;
						createdBy?: string;
						lastModified: number;
					}),
					accessKey
				});
				await this.markDailyChoreLocalSynced(createId);
				const { dailyChoreStore } = await import('$lib/stores/dailyChores.svelte');
				dailyChoreStore.markSynced(createId);
				break;
			}
			case 'update': {
				const updateId = payload.clientId as string;
				await client.mutation(api.dailyChores.toggleComplete, {
					...(payload as {
						clientId: string;
						isCompleted: boolean;
						completedAt?: string;
						completedBy?: string;
						photoStatus?: string;
						lastModified: number;
					}),
					accessKey
				});
				await this.markDailyChoreLocalSynced(updateId);
				const { dailyChoreStore } = await import('$lib/stores/dailyChores.svelte');
				dailyChoreStore.markSynced(updateId);
				break;
			}
			default:
				throw new Error(`Unsupported dailyChores mutation type: ${type}`);
		}
	}

	private async markDailyChoreLocalSynced(id: string): Promise<void> {
		const chore = await getDailyChore(id);
		if (chore) {
			await putDailyChore({ ...chore, syncStatus: 'synced' });
		}
	}

	async retryFailed(): Promise<number> {
		// Reset failed mutations for retry
		const mutations = await getPendingMutations();
		let resetCount = 0;

		for (const mutation of mutations) {
			if (mutation.payload._failed) {
				mutation.retryCount = 0;
				delete mutation.payload._failed;
				delete mutation.payload._failedAt;
				// Re-enqueue (put will update existing)
				const { getDB } = await import('$lib/db/client');
				const db = await getDB();
				await db.put('mutationQueue', mutation);
				resetCount += 1;
			}
		}

		// Also reset failed dailyChores in the store to pending
		const { dailyChoreStore } = await import('$lib/stores/dailyChores.svelte');
		await dailyChoreStore.resetFailedToPending();

		this.failedCount = 0;
		await this.processQueue();
		return resetCount;
	}

	async retryFailedPhotos(): Promise<number> {
		const { resetFailedPhotos } = await import('$lib/photo/queue');
		const count = await resetFailedPhotos();
		this.failedPhotoCount = 0;
		await this.processPhotoQueue();
		return count;
	}

	/** Auto-retry failed photos when coming back online */
	private async autoRetryFailedPhotos(): Promise<void> {
		const failedCount = await getFailedPhotoCount();
		if (failedCount === 0) return;

		const { resetFailedPhotos } = await import('$lib/photo/queue');
		await resetFailedPhotos();
		this.failedPhotoCount = 0;
		this.processPhotoQueue();
	}

	destroy() {
		if (this.syncIntervalId) {
			clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
		}
		if (browser) {
			window.removeEventListener('online', this.handleOnline);
			document.removeEventListener('visibilitychange', this.handleVisibility);
		}
		this.initialized = false;
	}
}

export const syncEngine = new SyncEngine();
