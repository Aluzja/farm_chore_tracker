<script lang="ts">
	import { choreStore } from '$lib/stores/chores.svelte';
	import { syncEngine } from '$lib/sync/engine.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';
	import { getStorageEstimate, formatStorageSize } from '$lib/db/storage';
	import { browser } from '$app/environment';

	let newChoreText = $state('');
	let storageInfo = $state({ usage: 0, quota: 0 });

	// Load storage info
	$effect(() => {
		if (browser) {
			getStorageEstimate().then((info) => {
				storageInfo = info;
			});
		}
	});

	async function handleAddChore() {
		if (!newChoreText.trim()) return;
		await choreStore.add(newChoreText.trim());
		newChoreText = '';
	}

	async function handleToggle(id: string) {
		await choreStore.toggleComplete(id);
	}

	async function handleDelete(id: string) {
		await choreStore.remove(id);
	}

	async function handleRetryFailed() {
		const count = await syncEngine.retryFailed();
		console.log(`[Test] Retried ${count} failed mutations`);
	}

	function formatTime(timestamp: number | null): string {
		if (!timestamp) return 'Never';
		return new Date(timestamp).toLocaleTimeString();
	}
</script>

<main class="container">
	<h1>Kitchen Sink Farm - Data Layer Test</h1>

	<!-- Connection Status -->
	<section class="status-panel">
		<h2>System Status</h2>
		<div class="status-grid">
			<div
				class="status-item"
				class:online={connectionStatus.isOnline}
				class:offline={!connectionStatus.isOnline}
			>
				<span class="status-label">Connection</span>
				<span class="status-value">{connectionStatus.isOnline ? 'Online' : 'Offline'}</span>
			</div>
			<div class="status-item" class:syncing={syncEngine.isSyncing}>
				<span class="status-label">Sync</span>
				<span class="status-value">{syncEngine.isSyncing ? 'Syncing...' : 'Idle'}</span>
			</div>
			<div class="status-item">
				<span class="status-label">Pending</span>
				<span class="status-value">{syncEngine.pendingCount}</span>
			</div>
			<div class="status-item" class:has-failed={syncEngine.failedCount > 0}>
				<span class="status-label">Failed</span>
				<span class="status-value">{syncEngine.failedCount}</span>
				{#if syncEngine.failedCount > 0}
					<button class="retry-btn" onclick={handleRetryFailed}>Retry</button>
				{/if}
			</div>
			<div class="status-item">
				<span class="status-label">Last Sync</span>
				<span class="status-value">{formatTime(syncEngine.lastSyncedAt)}</span>
			</div>
			<div class="status-item">
				<span class="status-label">Storage</span>
				<span class="status-value"
					>{formatStorageSize(storageInfo.usage)} / {formatStorageSize(storageInfo.quota)}</span
				>
			</div>
		</div>
		{#if syncEngine.lastError}
			<div class="error-banner">
				Error: {syncEngine.lastError}
			</div>
		{/if}
	</section>

	<!-- Add Chore -->
	<section class="add-chore">
		<h2>Add Chore</h2>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleAddChore();
			}}
		>
			<input
				type="text"
				bind:value={newChoreText}
				placeholder="Enter chore description..."
				class="chore-input"
			/>
			<button type="submit" class="add-btn" disabled={!newChoreText.trim()}> Add Chore </button>
		</form>
	</section>

	<!-- Chore List -->
	<section class="chore-list">
		<h2>
			Chores
			<span class="count">({choreStore.completedCount}/{choreStore.items.length} complete)</span>
		</h2>

		{#if choreStore.isLoading}
			<div class="loading">Loading from local storage...</div>
		{:else if choreStore.error}
			<div class="error">Error: {choreStore.error.message}</div>
		{:else if choreStore.items.length === 0}
			<div class="empty">No chores yet. Add one above!</div>
		{:else}
			<ul class="chores">
				{#each choreStore.items as chore (chore._id)}
					<li class="chore-item" class:completed={chore.isCompleted}>
						<button
							class="toggle-btn"
							onclick={() => handleToggle(chore._id)}
							aria-label={chore.isCompleted ? 'Mark incomplete' : 'Mark complete'}
						>
							{chore.isCompleted ? 'v' : 'o'}
						</button>
						<span class="chore-text">{chore.text}</span>
						<span
							class="sync-status"
							class:pending={chore.syncStatus === 'pending'}
							class:failed={chore.syncStatus === 'failed'}
						>
							{#if chore.syncStatus === 'pending'}
								...
							{:else if chore.syncStatus === 'failed'}
								X
							{:else}
								ok
							{/if}
						</span>
						<button
							class="delete-btn"
							onclick={() => handleDelete(chore._id)}
							aria-label="Delete chore"
						>
							x
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Instructions -->
	<section class="instructions">
		<h2>Testing Offline-First Behavior</h2>
		<ol>
			<li><strong>Add a chore</strong> - It appears instantly (optimistic update)</li>
			<li><strong>Check "Pending"</strong> - Shows unsynchronized mutations</li>
			<li><strong>Go offline</strong> (DevTools > Network > Offline) - Add more chores</li>
			<li><strong>Refresh page</strong> - Chores persist from IndexedDB!</li>
			<li><strong>Go online</strong> - Watch "Pending" count decrease as sync runs</li>
			<li><strong>Open another tab</strong> - Changes sync via Convex in real-time</li>
		</ol>
	</section>
</main>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 1rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	h1 {
		color: #4caf50;
		margin-bottom: 1.5rem;
	}

	h2 {
		font-size: 1.25rem;
		margin-bottom: 0.75rem;
		color: #333;
	}

	section {
		background: #f9f9f9;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	/* Status Panel */
	.status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
	}

	.status-item {
		background: white;
		padding: 0.5rem;
		border-radius: 4px;
		text-align: center;
		border: 1px solid #ddd;
	}

	.status-item.online {
		border-color: #4caf50;
		background: #e8f5e9;
	}
	.status-item.offline {
		border-color: #f44336;
		background: #ffebee;
	}
	.status-item.syncing {
		border-color: #2196f3;
		background: #e3f2fd;
	}
	.status-item.has-failed {
		border-color: #ff9800;
		background: #fff3e0;
	}

	.status-label {
		display: block;
		font-size: 0.75rem;
		color: #666;
		text-transform: uppercase;
	}

	.status-value {
		display: block;
		font-weight: 600;
		font-size: 1rem;
	}

	.retry-btn {
		margin-top: 0.25rem;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		background: #ff9800;
		color: white;
		border: none;
		border-radius: 3px;
		cursor: pointer;
	}

	.error-banner {
		margin-top: 0.75rem;
		padding: 0.5rem;
		background: #ffebee;
		color: #c62828;
		border-radius: 4px;
	}

	/* Add Chore */
	.add-chore form {
		display: flex;
		gap: 0.5rem;
	}

	.chore-input {
		flex: 1;
		padding: 0.75rem;
		font-size: 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.add-btn {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		background: #4caf50;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.add-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	/* Chore List */
	.count {
		font-weight: normal;
		font-size: 1rem;
		color: #666;
	}

	.loading,
	.error,
	.empty {
		padding: 2rem;
		text-align: center;
		color: #666;
	}

	.error {
		color: #c62828;
	}

	.chores {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.chore-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: white;
		border-radius: 4px;
		margin-bottom: 0.5rem;
		border: 1px solid #ddd;
	}

	.chore-item.completed {
		background: #f5f5f5;
	}

	.chore-item.completed .chore-text {
		text-decoration: line-through;
		color: #999;
	}

	.toggle-btn {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 2px solid #4caf50;
		background: white;
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.chore-item.completed .toggle-btn {
		background: #4caf50;
		color: white;
	}

	.chore-text {
		flex: 1;
	}

	.sync-status {
		font-size: 0.875rem;
		opacity: 0.6;
	}

	.sync-status.pending {
		opacity: 1;
	}

	.sync-status.failed {
		opacity: 1;
		color: #f44336;
	}

	.delete-btn {
		width: 2rem;
		height: 2rem;
		border-radius: 4px;
		border: none;
		background: #ffebee;
		color: #c62828;
		font-size: 1.25rem;
		cursor: pointer;
	}

	/* Instructions */
	.instructions ol {
		padding-left: 1.5rem;
	}

	.instructions li {
		margin-bottom: 0.5rem;
	}
</style>
