<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';
	import { syncEngine } from '$lib/sync/engine.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';
	import { formatTimeSlot, getTodayDayName } from '$lib/utils/date';
	import { getCurrentUser } from '$lib/auth/user-context.svelte';
	import { compressImage, generateThumbnail, type CompressionProgress } from '$lib/photo/capture';
	import { enqueuePhoto } from '$lib/photo/queue';
	import Fireworks from '$lib/components/Fireworks.svelte';
	import PhotoThumbnail from '$lib/components/PhotoThumbnail.svelte';
	import SyncStatusBadge from '$lib/components/SyncStatusBadge.svelte';
	import type { DailyChore } from '$lib/db/schema';
	import { browser } from '$app/environment';
	import { SvelteSet } from 'svelte/reactivity';

	const STORAGE_KEY = 'ksf-collapsed-daily';

	// Load collapsed state from localStorage
	function loadCollapsedSlots(): Set<string> {
		if (!browser) return new Set();
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) return new SvelteSet(JSON.parse(saved));
		} catch {}
		return new SvelteSet();
	}

	function saveCollapsedSlots(slots: Set<string>) {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...slots]));
		} catch {}
	}

	let collapsedSlots = $state<Set<string>>(loadCollapsedSlots());

	function toggleSlotCollapse(timeSlot: string) {
		if (collapsedSlots.has(timeSlot)) {
			collapsedSlots.delete(timeSlot);
		} else {
			collapsedSlots.add(timeSlot);
		}
		collapsedSlots = new SvelteSet(collapsedSlots);
		saveCollapsedSlots(collapsedSlots);
	}

	function isSlotCollapsed(timeSlot: string): boolean {
		return collapsedSlots.has(timeSlot);
	}

	const dayName = getTodayDayName();

	// Get completion stats for a time slot
	function getSlotStats(categories: { chores: DailyChore[] }[]): {
		completed: number;
		total: number;
		percent: number;
	} {
		let completed = 0;
		let total = 0;
		for (const cat of categories) {
			for (const chore of cat.chores) {
				total++;
				if (chore.isCompleted) completed++;
			}
		}
		const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
		return { completed, total, percent };
	}

	function formatCompletionTime(isoString: string | undefined): string {
		if (!isoString) return '';
		try {
			const date = new Date(isoString);
			return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			return '';
		}
	}

	let showFireworks = $state(false);

	// Persist completion snapshot to sessionStorage so we can detect
	// transitions even after navigating away (e.g. photo capture) and back.
	const COMPLETION_KEY = 'ksf-slot-completion';

	function loadCompletionSnapshot(): Map<string, boolean> {
		if (!browser) return new Map();
		try {
			const saved = sessionStorage.getItem(COMPLETION_KEY);
			if (saved) return new Map(JSON.parse(saved));
		} catch {}
		return new Map();
	}

	function saveCompletionSnapshot(map: Map<string, boolean>) {
		if (!browser) return;
		try {
			sessionStorage.setItem(COMPLETION_KEY, JSON.stringify([...map]));
		} catch {}
	}

	let previousCompletion = loadCompletionSnapshot();
	let isFirstRun = true;

	$effect(() => {
		const grouped = dailyChoreStore.grouped;
		if (!grouped.length || dailyChoreStore.isLoading) return;

		// On the very first run with no saved snapshot, just record state
		// without triggering (handles fresh session / hard reload).
		const hasSavedState = previousCompletion.size > 0;

		for (const group of grouped) {
			const stats = getSlotStats(group.categories);
			const isComplete = stats.completed === stats.total && stats.total > 0;
			const wasComplete = previousCompletion.get(group.timeSlot) ?? false;

			if ((hasSavedState || !isFirstRun) && isComplete && !wasComplete) {
				showFireworks = true;
			}

			previousCompletion.set(group.timeSlot, isComplete);
		}

		isFirstRun = false;
		saveCompletionSnapshot(previousCompletion);
	});

	// Inline photo capture state
	let photoFileInput: HTMLInputElement;
	let captureChoreId = $state<string | null>(null);
	let capturePreviewUrl = $state<string | null>(null);
	let captureBlob = $state<Blob | null>(null);
	let captureThumbnail = $state<Blob | undefined>(undefined);
	let captureOriginalSize = $state(0);
	let captureProcessing = $state(false);
	let captureSubmitting = $state(false);
	let captureError = $state<string | null>(null);
	let captureProgress = $state(0);

	const captureChore = $derived(
		captureChoreId ? dailyChoreStore.items.find((c) => c._id === captureChoreId) : null
	);

	function handleChoreAction(chore: DailyChore) {
		if (chore.requiresPhoto && !chore.isCompleted) {
			// Store chore ID and trigger file input synchronously (iOS requires user gesture)
			captureChoreId = chore._id;
			photoFileInput?.click();
		} else {
			// Normal toggle (or undo for completed chores)
			dailyChoreStore.toggleComplete(chore._id, getCurrentUser());
		}
	}

	async function handlePhotoSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) {
			// User cancelled the camera — reset
			captureChoreId = null;
			return;
		}

		captureProcessing = true;
		captureError = null;
		captureProgress = 0;

		try {
			captureOriginalSize = file.size;
			const [compressed, thumbnail] = await Promise.all([
				compressImage(file, (p: CompressionProgress) => {
					captureProgress = Math.round(p.percent);
				}),
				generateThumbnail(file)
			]);

			if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl);
			capturePreviewUrl = URL.createObjectURL(compressed);
			captureBlob = compressed;
			captureThumbnail = thumbnail;
		} catch (e) {
			captureError = e instanceof Error ? e.message : 'Failed to process photo';
		} finally {
			captureProcessing = false;
			input.value = '';
		}
	}

	async function handlePhotoAccept() {
		if (!captureBlob || !captureChoreId || !captureChore) return;

		captureSubmitting = true;
		captureError = null;

		try {
			const user = getCurrentUser();

			await enqueuePhoto({
				id: crypto.randomUUID(),
				dailyChoreClientId: captureChore._id,
				blob: captureBlob,
				thumbnailBlob: captureThumbnail,
				thumbnailSize: captureThumbnail?.size,
				mimeType: 'image/jpeg',
				originalSize: captureOriginalSize,
				compressedSize: captureBlob.size,
				capturedAt: Date.now(),
				capturedBy: user,
				uploadStatus: 'pending'
			});

			await dailyChoreStore.toggleComplete(captureChoreId, user, {
				photoStatus: 'pending'
			});

			if (connectionStatus.isOnline) {
				syncEngine.processQueue();
				syncEngine.processPhotoQueue();
			}

			resetCapture();
		} catch (e) {
			captureError = e instanceof Error ? e.message : 'Failed to save photo';
			captureSubmitting = false;
		}
	}

	function handlePhotoCancel() {
		resetCapture();
	}

	function handlePhotoRetake() {
		if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl);
		capturePreviewUrl = null;
		captureBlob = null;
		captureError = null;
		photoFileInput?.click();
	}

	function resetCapture() {
		if (capturePreviewUrl) URL.revokeObjectURL(capturePreviewUrl);
		captureChoreId = null;
		capturePreviewUrl = null;
		captureBlob = null;
		captureThumbnail = undefined;
		captureOriginalSize = 0;
		captureProcessing = false;
		captureSubmitting = false;
		captureError = null;
		captureProgress = 0;
	}
</script>

<div class="page">
	<main class="container">
		<header class="header">
			<h1 class="title">{dayName}'s Chores</h1>
			<div class="header-meta">
				{#if connectionStatus.updateAvailable}
					<button class="connection-status update" onclick={() => connectionStatus.applyUpdate()}>
						Update Available
					</button>
				{:else}
					<div class="connection-status" class:online={connectionStatus.isOnline}>
						{connectionStatus.isOnline ? 'Online' : 'Offline'}
					</div>
				{/if}
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
					{@const stats = getSlotStats(timeSlotGroup.categories)}
					{@const isCollapsed = isSlotCollapsed(timeSlotGroup.timeSlot)}
					<section class="time-slot-section" class:collapsed={isCollapsed}>
						<button
							class="time-slot-header"
							onclick={() => toggleSlotCollapse(timeSlotGroup.timeSlot)}
							aria-expanded={!isCollapsed}
						>
							<span class="time-slot-title">{formatTimeSlot(timeSlotGroup.timeSlot)}</span>
							<span class="time-slot-stats">
								{stats.completed}/{stats.total}
								<span class="time-slot-percent">({stats.percent}%)</span>
								{#if stats.completed === stats.total && stats.total > 0}
									<svg
										class="check-mini"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
									>
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
								{/if}
							</span>
							<svg
								class="chevron"
								class:rotated={isCollapsed}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<polyline points="6 9 12 15 18 9"></polyline>
							</svg>
						</button>

						{#if !isCollapsed}
							<div class="time-slot-content" transition:slide={{ duration: 200 }}>
								{#each timeSlotGroup.categories as categoryGroup, categoryIndex (categoryGroup.name)}
									<div class="category-group category-color-{categoryIndex % 6}">
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
																<span class="badge photo-required" title="Photo required"
																	>Photo</span
																>
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
															<PhotoThumbnail
																choreId={chore._id}
																storageId={chore.photoStorageId}
																thumbnailStorageId={chore.thumbnailStorageId}
															/>
														{/key}
													{:else if chore.isCompleted && chore.photoStatus === 'pending'}
														<div class="photo-pending">
															<span class="photo-pending-spinner"></span>
														</div>
													{/if}

													<SyncStatusBadge status={chore.syncStatus} />
												</li>
											{/each}
										</ul>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Hidden file input for photo capture (must be in DOM for iOS) -->
<input
	bind:this={photoFileInput}
	type="file"
	accept="image/*"
	capture="environment"
	onchange={handlePhotoSelect}
	class="file-input-hidden"
/>

<!-- Photo processing/preview overlay -->
{#if captureProcessing}
	<div class="capture-overlay">
		<div class="capture-processing">
			<div class="progress-ring-container">
				<svg class="progress-ring" viewBox="0 0 100 100">
					<circle class="progress-ring-bg" cx="50" cy="50" r="45" />
					<circle
						class="progress-ring-fill"
						cx="50"
						cy="50"
						r="45"
						style="stroke-dashoffset: {283 - (283 * captureProgress) / 100}"
					/>
				</svg>
				<span class="progress-percent">{captureProgress}%</span>
			</div>
			<p class="progress-label">Processing...</p>
		</div>
	</div>
{:else if capturePreviewUrl}
	<div class="capture-overlay">
		<header class="capture-header">
			<h1 class="capture-title">{captureChore?.text || 'Photo'}</h1>
			<button
				class="capture-close"
				onclick={handlePhotoCancel}
				disabled={captureSubmitting}
				aria-label="Cancel"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</header>

		<div class="capture-preview">
			<img src={capturePreviewUrl} alt="Captured preview" />
		</div>

		{#if captureError}
			<p class="capture-error">{captureError}</p>
		{/if}

		<div class="capture-actions">
			<button
				class="capture-btn capture-btn-secondary"
				onclick={handlePhotoRetake}
				disabled={captureSubmitting}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M1 4v6h6"></path>
					<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
				</svg>
				Retake
			</button>
			<button
				class="capture-btn capture-btn-primary"
				onclick={handlePhotoAccept}
				disabled={captureSubmitting}
			>
				{#if captureSubmitting}
					<div class="capture-spinner"></div>
					Saving...
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
					Accept
				{/if}
			</button>
		</div>
	</div>
{/if}

{#if showFireworks}
	<Fireworks onfinish={() => (showFireworks = false)} />
{/if}

<style>
	.page {
		min-height: 100%;
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

	.connection-status.update {
		background: #3b82f6;
		color: white;
		border: none;
		cursor: pointer;
		font-weight: 600;
		animation: pulse-update 2s ease-in-out infinite;
	}

	@keyframes pulse-update {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
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
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		font-size: 1rem;
		font-weight: 600;
		color: white;
		background: #4b5563;
		padding: 0.75rem 1rem;
		margin: 0;
		border: none;
		cursor: pointer;
		text-align: left;
		-webkit-tap-highlight-color: transparent;
	}

	.time-slot-header:active {
		filter: brightness(0.95);
	}

	.time-slot-title {
		flex: 1;
	}

	.time-slot-stats {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.875rem;
		font-weight: 500;
		opacity: 0.9;
	}

	.time-slot-percent {
		opacity: 0.8;
	}

	.check-mini {
		width: 1rem;
		height: 1rem;
	}

	.chevron {
		width: 1.25rem;
		height: 1.25rem;
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.chevron.rotated {
		transform: rotate(-90deg);
	}

	.time-slot-content {
		overflow: hidden;
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

	.time-slot-section.collapsed {
		border-radius: 0.75rem;
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
		padding: 0.5rem 1rem;
		margin: 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
	}

	/* Category color highlights */
	.category-color-0 {
		background-color: rgba(239, 68, 68, 0.04);
	}
	.category-color-0 .category-header {
		background-color: rgba(239, 68, 68, 0.08);
		color: #b91c1c;
	}

	.category-color-1 {
		background-color: rgba(34, 197, 94, 0.04);
	}
	.category-color-1 .category-header {
		background-color: rgba(34, 197, 94, 0.08);
		color: #15803d;
	}

	.category-color-2 {
		background-color: rgba(59, 130, 246, 0.04);
	}
	.category-color-2 .category-header {
		background-color: rgba(59, 130, 246, 0.08);
		color: #1d4ed8;
	}

	.category-color-3 {
		background-color: rgba(168, 85, 247, 0.04);
	}
	.category-color-3 .category-header {
		background-color: rgba(168, 85, 247, 0.08);
		color: #7c3aed;
	}

	.category-color-4 {
		background-color: rgba(245, 158, 11, 0.04);
	}
	.category-color-4 .category-header {
		background-color: rgba(245, 158, 11, 0.08);
		color: #b45309;
	}

	.category-color-5 {
		background-color: rgba(20, 184, 166, 0.04);
	}
	.category-color-5 .category-header {
		background-color: rgba(20, 184, 166, 0.08);
		color: #0f766e;
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

	/* Photo pending upload indicator */
	.photo-pending {
		flex-shrink: 0;
		width: 3rem;
		height: 3rem;
		border-radius: 0.375rem;
		border: 1px solid #e5e7eb;
		background: #f9fafb;
		display: flex;
		align-items: center;
		justify-content: center;
		order: 0.5;
		margin-left: auto;
	}

	.photo-pending-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid #e5e7eb;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
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

	/* Hidden file input */
	.file-input-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* Photo capture overlay */
	.capture-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		background: #000;
		color: white;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}

	.capture-processing {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.progress-ring-container {
		position: relative;
		width: 6rem;
		height: 6rem;
	}

	.progress-ring {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.progress-ring-bg {
		fill: none;
		stroke: rgba(255, 255, 255, 0.2);
		stroke-width: 6;
	}

	.progress-ring-fill {
		fill: none;
		stroke: #22c55e;
		stroke-width: 6;
		stroke-linecap: round;
		stroke-dasharray: 283;
		transition: stroke-dashoffset 0.2s ease;
	}

	.progress-percent {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		font-weight: 600;
		color: white;
	}

	.progress-label {
		margin: 0;
		font-size: 1rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.capture-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.8);
	}

	.capture-title {
		font-size: 1rem;
		font-weight: 500;
		margin: 0;
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.capture-close {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.2);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.capture-close:disabled {
		opacity: 0.5;
	}

	.capture-close svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.capture-preview {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: #111;
	}

	.capture-preview img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.capture-error {
		color: #f87171;
		text-align: center;
		padding: 0.75rem 1rem;
		margin: 0;
	}

	.capture-actions {
		display: flex;
		gap: 1rem;
		padding: 1.5rem;
		background: rgba(0, 0, 0, 0.8);
	}

	.capture-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem;
		border: none;
		border-radius: 0.75rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		min-height: 3.5rem;
	}

	.capture-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.capture-btn svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.capture-btn-secondary {
		background: rgba(255, 255, 255, 0.15);
		color: white;
	}

	.capture-btn-primary {
		background: #22c55e;
		color: white;
	}

	.capture-spinner {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: capture-spin 1s linear infinite;
	}

	@keyframes capture-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
