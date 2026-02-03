<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fade, slide } from 'svelte/transition';
	import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';
	import { syncEngine } from '$lib/sync/engine.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';
	import { formatTimeSlot } from '$lib/utils/date';
	import { getCurrentUser } from '$lib/auth/user-context.svelte';
	import AdminNav from '$lib/components/AdminNav.svelte';
	import PhotoThumbnail from '$lib/components/PhotoThumbnail.svelte';
	import SyncStatusBadge from '$lib/components/SyncStatusBadge.svelte';
	import type { DailyChore } from '$lib/db/schema';

	function formatCompletionTime(isoString: string | undefined): string {
		if (!isoString) return '';
		try {
			const date = new Date(isoString);
			return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			return '';
		}
	}

	async function handleChoreAction(chore: DailyChore) {
		if (chore.requiresPhoto && !chore.isCompleted) {
			// Must take photo - navigate to capture page
			await goto(resolve('/(app)/photo-capture/[choreId]', { choreId: chore._id }));
		} else {
			// Normal toggle (or undo for completed chores)
			await dailyChoreStore.toggleComplete(chore._id, getCurrentUser());
		}
	}
</script>

<AdminNav />

<div class="page">
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
				{#if syncEngine.pendingPhotoCount > 0}
					<div class="photo-upload-indicator">
						{#if syncEngine.currentPhotoUpload}
							<span class="upload-spinner"></span>
						{/if}
						{syncEngine.currentPhotoUpload
							? 'Uploading photo...'
							: `${syncEngine.pendingPhotoCount} photos`}
					</div>
				{/if}
				{#if syncEngine.failedCount > 0 || syncEngine.failedPhotoCount > 0}
					<button
						class="retry-button"
						onclick={() => {
							syncEngine.retryFailed();
							syncEngine.retryFailedPhotos();
						}}
					>
						{syncEngine.failedCount + syncEngine.failedPhotoCount} failed - Retry
					</button>
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
				<p class="empty-subtitle">
					Chores will appear here when the admin adds them to the master list.
				</p>
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
										<li
											class="chore-item"
											class:completed={chore.isCompleted}
											transition:slide={{ duration: 150 }}
										>
											<button
												class="toggle-button"
												class:checked={chore.isCompleted}
												onclick={() => handleChoreAction(chore)}
												aria-label={chore.isCompleted
													? 'Mark incomplete'
													: chore.requiresPhoto
														? 'Take photo to complete'
														: 'Mark complete'}
											>
												{#if chore.isCompleted}
													<svg
														class="check-icon"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="3"
													>
														<polyline points="20 6 9 17 4 12"></polyline>
													</svg>
												{:else if chore.requiresPhoto}
													<svg
														class="camera-icon"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<path
															d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
														></path>
														<circle cx="12" cy="13" r="4"></circle>
													</svg>
												{/if}
											</button>

											<div class="chore-content">
												<span class="chore-text">
													{chore.text}
													{#if chore.requiresPhoto && !chore.isCompleted}
														<span class="badge photo-required" title="Photo required">Photo</span>
													{/if}
												</span>

												{#if chore.description}
													<span class="chore-description">{chore.description}</span>
												{/if}

												{#if chore.isAdHoc}
													<span class="badge adhoc">Today only</span>
												{/if}

												{#if chore.isCompleted && chore.completedBy}
													<div class="completion-info" transition:fade={{ duration: 200 }}>
														{chore.completedBy} at {formatCompletionTime(chore.completedAt)}
													</div>
												{/if}
											</div>

											{#if chore.isCompleted && chore.photoStorageId}
												{#key chore.photoStorageId}
													<PhotoThumbnail choreId={chore._id} storageId={chore.photoStorageId} />
												{/key}
											{/if}

											<SyncStatusBadge status={chore.syncStatus} />
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
</div>

<style>
	.page {
		min-height: 100vh;
		background-color: #f9fafb;
	}

	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 1rem;
		padding-bottom: calc(4rem + env(safe-area-inset-bottom, 0px));
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		-webkit-overflow-scrolling: touch;
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

	.retry-button {
		font-size: 0.75rem;
		color: #dc2626;
		background: none;
		border: none;
		padding: 0.75rem 0.5rem;
		min-height: 44px;
		cursor: pointer;
		text-decoration: underline;
	}

	.retry-button:hover {
		color: #b91c1c;
	}

	.progress-bar-container {
		height: 0.625rem;
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
		margin-bottom: 1rem;
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
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		min-height: 56px;
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
		width: 48px;
		height: 48px;
		min-width: 48px;
		min-height: 48px;
		border-radius: 50%;
		border: 2px solid #d1d5db;
		background: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			transform 0.1s ease;
		/* Larger touch target for mobile - toggle button positioned on right via flex order */
		order: 1;
		/* Remove browser tap highlight (the blue square) on mobile */
		-webkit-tap-highlight-color: transparent;
		/* Remove default outline, replaced with custom focus ring below */
		outline: none;
	}

	/* Custom focus ring that follows the round button shape */
	.toggle-button:focus-visible {
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.4);
		border-color: #22c55e;
	}

	.toggle-button:hover {
		border-color: #22c55e;
	}

	.toggle-button.checked {
		background: #22c55e;
		border-color: #22c55e;
	}

	.check-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: white;
		animation: fadeIn 0.15s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.chore-content {
		flex: 1;
		min-width: 0;
		/* Content appears before toggle button (left side) for thumb-friendly layout */
		order: 0;
	}

	.chore-text {
		display: block;
		color: #111827;
		line-height: 1.4;
		font-size: 1rem;
	}

	.chore-description {
		display: block;
		font-size: 0.8125rem;
		color: #6b7280;
		line-height: 1.3;
		margin-top: 0.125rem;
	}

	.chore-item.completed .chore-text {
		color: #6b7280;
	}

	.chore-item.completed .chore-description {
		color: #9ca3af;
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

	.photo-upload-indicator {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: #3b82f6;
	}

	.upload-spinner {
		width: 0.75rem;
		height: 0.75rem;
		border: 1.5px solid #bfdbfe;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.camera-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: #6b7280;
	}

	.toggle-button:hover .camera-icon {
		color: #3b82f6;
	}

	.badge.photo-required {
		background: #dbeafe;
		color: #1d4ed8;
		margin-left: 0.5rem;
	}

	/* Photo thumbnail and sync badge ordering for thumb-friendly layout */
	/* Photo thumbnail appears to the left of toggle button */
	.chore-item :global(.photo-thumbnail) {
		order: 0.5;
		margin-left: auto;
	}

	.chore-item :global(.sync-badge) {
		order: 2;
	}
</style>
