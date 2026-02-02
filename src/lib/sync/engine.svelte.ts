import { browser } from '$app/environment';
import type { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { connectionStatus } from './status.svelte';
import {
	getPendingMutations,
	removeMutation,
	incrementRetry,
	markFailed,
	getQueueLength
} from './queue';
import { getChore, putChore, getChoresByStatus } from '$lib/db/operations';
import type { Mutation } from '$lib/db/schema';

const MAX_RETRIES = 3;
const SYNC_INTERVAL_MS = 30_000; // 30 seconds when online and visible

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

	private syncIntervalId: ReturnType<typeof setInterval> | null = null;
	private initialized = false;

	// Bound event handlers for cleanup
	private handleOnline = () => this.processQueue();
	private handleVisibility = () => {
		if (document.visibilityState === 'visible' && connectionStatus.isOnline) {
			this.processQueue();
		}
	};

	async init() {
		if (!browser || this.initialized) return;
		this.initialized = true;

		// Initial count
		this.pendingCount = await getQueueLength();
		this.failedCount = (await getChoresByStatus('failed')).length;

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
	}

	private async applyMutation(mutation: Mutation): Promise<void> {
		const client = getConvexClient();
		if (!client) {
			throw new Error('Convex client not available');
		}

		const { type, table, payload } = mutation;

		if (table !== 'chores') {
			throw new Error(`Unknown table: ${table}`);
		}

		switch (type) {
			case 'create':
				await client.mutation(api.chores.create, payload as {
					clientId: string;
					text: string;
					isCompleted: boolean;
					completedAt?: string;
					completedBy?: string;
					lastModified: number;
				});
				// Update local record to synced
				await this.markLocalSynced(payload.clientId as string);
				break;

			case 'update':
				await client.mutation(api.chores.update, payload as {
					id: string; // clientId
					text?: string;
					isCompleted?: boolean;
					completedAt?: string;
					completedBy?: string;
					lastModified: number;
				});
				await this.markLocalSynced(payload.id as string);
				break;

			case 'delete':
				await client.mutation(api.chores.remove, { id: payload.id as string });
				break;

			default:
				throw new Error(`Unknown mutation type: ${type}`);
		}
	}

	private async markLocalSynced(id: string): Promise<void> {
		const chore = await getChore(id);
		if (chore) {
			await putChore({ ...chore, syncStatus: 'synced' });
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

		this.failedCount = 0;
		await this.processQueue();
		return resetCount;
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
