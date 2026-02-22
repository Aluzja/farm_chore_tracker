<script lang="ts">
	import { getPhotoQueueWithDetails, removePhotoEntry } from '$lib/photo/queue';
	import { syncEngine, getConvexClient } from '$lib/sync/engine.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';
	import { getStoredAccessKey } from '$lib/auth/access-key';
	import { api } from '../../convex/_generated/api';
	import type { PhotoQueueEntry } from '$lib/db/schema';

	interface Props {
		onclose: () => void;
	}

	const { onclose }: Props = $props();

	type QueueEntry = PhotoQueueEntry & { choreName?: string };

	let entries = $state<QueueEntry[]>([]);
	let isLoading = $state(true);

	const failedEntries = $derived(entries.filter((e) => e.uploadStatus === 'failed'));

	async function loadEntries() {
		isLoading = true;
		entries = await getPhotoQueueWithDetails();
		isLoading = false;
	}

	$effect(() => {
		loadEntries();
	});

	function statusLabel(status: string): string {
		switch (status) {
			case 'uploading':
				return 'Uploading';
			case 'failed':
				return 'Failed';
			default:
				return 'Queued';
		}
	}

	function formatTimeAgo(timestamp: number): string {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);
		if (seconds < 60) return 'just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	async function handleDismiss(entry: QueueEntry) {
		const choreClientId = await removePhotoEntry(entry.id);
		entries = entries.filter((e) => e.id !== entry.id);

		// Clear photoStatus on the chore
		if (choreClientId) {
			const { dailyChoreStore } = await import('$lib/stores/dailyChores.svelte');
			await dailyChoreStore.clearPhotoStatus(choreClientId);

			const client = getConvexClient();
			if (client && connectionStatus.isOnline) {
				try {
					const accessKey = getStoredAccessKey() ?? undefined;
					await client.mutation(api.photos.clearPhotoStatus, {
						dailyChoreClientId: choreClientId,
						accessKey
					});
				} catch (err) {
					console.warn('[PhotoQueueModal] Failed to clear server photoStatus:', err);
				}
			}
		}

		// Update sync engine counts
		syncEngine.pendingPhotoCount = Math.max(
			0,
			entries.filter((e) => e.uploadStatus !== 'failed').length
		);
		syncEngine.failedPhotoCount = entries.filter((e) => e.uploadStatus === 'failed').length;

		if (entries.length === 0) {
			onclose();
		}
	}

	async function handleRetryAll() {
		await syncEngine.retryFailedPhotos();
		await loadEntries();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onmousedown={onclose}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal" onmousedown={(e) => e.stopPropagation()}>
		<h2 class="modal-title">Photo Uploads</h2>

		{#if isLoading}
			<p class="modal-message">Loading...</p>
		{:else if entries.length === 0}
			<p class="modal-message">No photos in queue.</p>
		{:else}
			<ul class="queue-list">
				{#each entries as entry (entry.id)}
					<li class="queue-item">
						<div class="queue-item-info">
							<span class="queue-chore-name">{entry.choreName ?? 'Unknown chore'}</span>
							<span class="queue-item-meta">
								<span class="queue-status queue-status--{entry.uploadStatus}">
									{statusLabel(entry.uploadStatus)}
								</span>
								{#if entry.retryCount > 0}
									<span class="queue-retries">
										{entry.retryCount} {entry.retryCount === 1 ? 'retry' : 'retries'}
									</span>
								{/if}
								<span class="queue-time">{formatTimeAgo(entry.capturedAt)}</span>
							</span>
						</div>
						<button class="queue-dismiss-btn" onclick={() => handleDismiss(entry)}>
							{entry.uploadStatus === 'failed' ? 'Dismiss' : 'Cancel'}
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="modal-actions">
			{#if failedEntries.length > 0}
				<button class="modal-btn modal-btn-retry" onclick={handleRetryAll}>
					Retry Failed ({failedEntries.length})
				</button>
			{/if}
			<button class="modal-btn modal-btn-close" onclick={onclose}>Close</button>
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1rem;
	}

	.modal {
		background: white;
		border-radius: 0.75rem;
		padding: 1.5rem;
		max-width: 24rem;
		width: 100%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
		margin: 0 0 0.75rem 0;
	}

	.modal-message {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0 0 1rem 0;
		line-height: 1.5;
	}

	.queue-list {
		list-style: none;
		margin: 0 0 1rem 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	.queue-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid #f3f4f6;
	}

	.queue-item:last-child {
		border-bottom: none;
	}

	.queue-item-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.queue-chore-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: #111827;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.queue-item-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
	}

	.queue-status {
		font-weight: 500;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	.queue-status--pending {
		background: #fef3c7;
		color: #92400e;
	}

	.queue-status--uploading {
		background: #dbeafe;
		color: #1e40af;
	}

	.queue-status--failed {
		background: #fee2e2;
		color: #991b1b;
	}

	.queue-retries {
		color: #9ca3af;
	}

	.queue-time {
		color: #9ca3af;
	}

	.queue-dismiss-btn {
		flex-shrink: 0;
		padding: 0.375rem 0.75rem;
		min-height: 36px;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid #e5e7eb;
		background: white;
		color: #6b7280;
	}

	.queue-dismiss-btn:hover {
		background: #f9fafb;
		color: #374151;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.modal-btn {
		padding: 0.5rem 1rem;
		min-height: 44px;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
	}

	.modal-btn-retry {
		background: #3b82f6;
		color: white;
	}

	.modal-btn-retry:hover {
		background: #2563eb;
	}

	.modal-btn-close {
		background: #f3f4f6;
		color: #374151;
	}

	.modal-btn-close:hover {
		background: #e5e7eb;
	}
</style>
