<script lang="ts">
	import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';
	import { syncEngine } from '$lib/sync/engine.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';
	import { formatTimeSlot } from '$lib/utils/date';

	// Get user name from parent layout context (passed via URL or stored)
	// For now, we'll use a simple approach - could be enhanced with context
	let userName = $state('Worker');

	function formatCompletionTime(isoString: string | undefined): string {
		if (!isoString) return '';
		try {
			const date = new Date(isoString);
			return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			return '';
		}
	}

	async function handleToggle(id: string) {
		await dailyChoreStore.toggleComplete(id, userName);
	}
</script>

<main class="container">
	<header class="header">
		<h1 class="title">Today's Chores</h1>
		<div class="header-meta">
			<div class="connection-status" class:online={connectionStatus.isOnline}>
				{connectionStatus.isOnline ? 'Online' : 'Offline'}
			</div>
			{#if syncEngine.pendingCount > 0}
				<div class="sync-indicator">
					{syncEngine.isSyncing ? 'Syncing...' : `${syncEngine.pendingCount} pending`}
				</div>
			{/if}
		</div>
	</header>

	<div class="progress-bar-container">
		<div class="progress-bar" style="width: {dailyChoreStore.progress}%"></div>
	</div>
	<div class="progress-text">
		{dailyChoreStore.completedCount} of {dailyChoreStore.totalCount} complete ({dailyChoreStore.progress}%)
	</div>

	{#if dailyChoreStore.isLoading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Loading chores...</p>
		</div>
	{:else if dailyChoreStore.error}
		<div class="error-message">
			Error loading chores: {dailyChoreStore.error.message}
		</div>
	{:else if dailyChoreStore.totalCount === 0}
		<div class="empty-state">
			<p class="empty-title">No chores for today</p>
			<p class="empty-subtitle">Chores will appear here when the admin adds them to the master list.</p>
		</div>
	{:else}
		<div class="chore-list">
			{#each dailyChoreStore.grouped as timeSlotGroup (timeSlotGroup.timeSlot)}
				<section class="time-slot-section">
					<h2 class="time-slot-header">{formatTimeSlot(timeSlotGroup.timeSlot)}</h2>

					{#each timeSlotGroup.categories as categoryGroup (categoryGroup.name)}
						<div class="category-group">
							<h3 class="category-header">{categoryGroup.name}</h3>

							<ul class="chore-items">
								{#each categoryGroup.chores as chore (chore._id)}
									<li class="chore-item" class:completed={chore.isCompleted}>
										<button
											class="toggle-button"
											class:checked={chore.isCompleted}
											onclick={() => handleToggle(chore._id)}
											aria-label={chore.isCompleted ? 'Mark incomplete' : 'Mark complete'}
										>
											{#if chore.isCompleted}
												<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
											{/if}
										</button>

										<div class="chore-content">
											<span class="chore-text">{chore.text}</span>

											{#if chore.isAdHoc}
												<span class="badge adhoc">Today only</span>
											{/if}

											{#if chore.isCompleted && chore.completedBy}
												<div class="completion-info">
													{chore.completedBy} at {formatCompletionTime(chore.completedAt)}
												</div>
											{/if}
										</div>

										{#if chore.syncStatus === 'pending'}
											<span class="sync-status pending" title="Pending sync">...</span>
										{:else if chore.syncStatus === 'failed'}
											<span class="sync-status failed" title="Sync failed">!</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</section>
			{/each}
		</div>
	{/if}
</main>

<style>
	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 1rem;
		padding-bottom: 4rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
		margin: 0;
	}

	.header-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.connection-status {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		background: #fef2f2;
		color: #dc2626;
	}

	.connection-status.online {
		background: #f0fdf4;
		color: #16a34a;
	}

	.sync-indicator {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.progress-bar-container {
		height: 0.5rem;
		background: #e5e7eb;
		border-radius: 9999px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.progress-bar {
		height: 100%;
		background: #22c55e;
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 0.875rem;
		color: #6b7280;
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 0;
		color: #6b7280;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid #e5e7eb;
		border-top-color: #22c55e;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-message {
		padding: 1rem;
		background: #fef2f2;
		color: #dc2626;
		border-radius: 0.5rem;
		text-align: center;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 1rem;
	}

	.empty-title {
		font-size: 1.125rem;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
	}

	.empty-subtitle {
		color: #6b7280;
	}

	.chore-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.time-slot-section {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.time-slot-header {
		font-size: 1rem;
		font-weight: 600;
		color: white;
		background: #4b5563;
		padding: 0.75rem 1rem;
		margin: 0;
	}

	.time-slot-section:nth-child(1) .time-slot-header {
		background: #f59e0b;
	}

	.time-slot-section:nth-child(2) .time-slot-header {
		background: #3b82f6;
	}

	.time-slot-section:nth-child(3) .time-slot-header {
		background: #8b5cf6;
	}

	.category-group {
		border-bottom: 1px solid #e5e7eb;
	}

	.category-group:last-child {
		border-bottom: none;
	}

	.category-header {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		background: #f9fafb;
		padding: 0.5rem 1rem;
		margin: 0;
	}

	.chore-items {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.chore-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		border-bottom: 1px solid #f3f4f6;
		transition: background-color 0.15s;
	}

	.chore-item:last-child {
		border-bottom: none;
	}

	.chore-item:active {
		background: #f9fafb;
	}

	.chore-item.completed {
		background: #f0fdf4;
	}

	.toggle-button {
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 2px solid #d1d5db;
		background: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}

	.toggle-button:hover {
		border-color: #22c55e;
	}

	.toggle-button.checked {
		background: #22c55e;
		border-color: #22c55e;
	}

	.check-icon {
		width: 1rem;
		height: 1rem;
		color: white;
	}

	.chore-content {
		flex: 1;
		min-width: 0;
	}

	.chore-text {
		display: block;
		color: #111827;
		line-height: 1.4;
	}

	.chore-item.completed .chore-text {
		color: #6b7280;
		text-decoration: line-through;
	}

	.badge {
		display: inline-block;
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		margin-left: 0.5rem;
	}

	.badge.adhoc {
		background: #fef3c7;
		color: #92400e;
	}

	.completion-info {
		font-size: 0.75rem;
		color: #16a34a;
		margin-top: 0.25rem;
	}

	.sync-status {
		flex-shrink: 0;
		font-size: 0.875rem;
		opacity: 0.6;
	}

	.sync-status.pending {
		color: #f59e0b;
		opacity: 1;
	}

	.sync-status.failed {
		color: #dc2626;
		font-weight: 600;
		opacity: 1;
	}
</style>
