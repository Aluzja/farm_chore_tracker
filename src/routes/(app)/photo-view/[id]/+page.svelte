<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../../convex/_generated/api';
	import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';
	import type { Id } from '../../../../convex/_generated/dataModel';

	const choreId = $page.params.id;

	// Find the chore
	const chore = $derived(dailyChoreStore.items.find((c) => c._id === choreId));

	// Use Convex query to get photo URL reactively
	// Only query when we have a valid photoStorageId
	const photoUrlQuery = $derived(
		chore?.photoStorageId
			? useQuery(api.photos.getPhotoUrl, { storageId: chore.photoStorageId as Id<'_storage'> })
			: null
	);

	const photoUrl = $derived(photoUrlQuery?.data ?? null);
	const isLoading = $derived(photoUrlQuery?.isLoading ?? !chore?.photoStorageId);
	const queryError = $derived(photoUrlQuery?.error?.message ?? null);

	function handleDownload() {
		if (!photoUrl) return;

		const link = document.createElement('a');
		link.href = photoUrl;
		link.download = `chore-${choreId}-${Date.now()}.jpg`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function handleBack() {
		goto(resolve('/'));
	}

	function handleReplace() {
		// Navigate to photo capture with replace flag
		goto(resolve(`/photo-capture?choreId=${choreId}&replace=true`));
	}

	function formatDateTime(timestamp: number | undefined): string {
		if (!timestamp) return '';
		return new Date(timestamp).toLocaleString();
	}
</script>

<main class="view-container">
	<header class="view-header">
		<button class="back-button" onclick={handleBack} aria-label="Go back">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="19" y1="12" x2="5" y2="12"></line>
				<polyline points="12 19 5 12 12 5"></polyline>
			</svg>
		</button>
		<h1 class="view-title">{chore?.text || 'Photo'}</h1>
	</header>

	<div class="photo-container">
		{#if queryError}
			<div class="error-state">
				<p>Failed to load photo</p>
				<p class="error-detail">{queryError}</p>
			</div>
		{:else if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading photo...</p>
			</div>
		{:else if photoUrl}
			<img src={photoUrl} alt="Chore completion photo" class="photo-image" />
		{:else}
			<div class="empty-state">
				<p>No photo available</p>
			</div>
		{/if}
	</div>

	{#if chore}
		<div class="metadata-bar">
			{#if chore.completedBy}
				<div class="metadata-item">
					<span class="metadata-label">Completed by</span>
					<span class="metadata-value">{chore.completedBy}</span>
				</div>
			{/if}
			{#if chore.completedAt}
				<div class="metadata-item">
					<span class="metadata-label">Completed at</span>
					<span class="metadata-value">{formatDateTime(new Date(chore.completedAt).getTime())}</span
					>
				</div>
			{/if}
		</div>
	{/if}

	<footer class="view-footer">
		<div class="footer-buttons">
			<button class="replace-button" onclick={handleReplace}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
					<circle cx="12" cy="13" r="4"></circle>
				</svg>
				Replace Photo
			</button>
			<button class="download-button" onclick={handleDownload} disabled={!photoUrl}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
					<polyline points="7 10 12 15 17 10"></polyline>
					<line x1="12" y1="15" x2="12" y2="3"></line>
				</svg>
				Download
			</button>
		</div>
	</footer>
</main>

<style>
	.view-container {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		background: #000;
		color: white;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.view-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.8);
		z-index: 10;
	}

	.back-button {
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
	}

	.back-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.view-title {
		font-size: 1rem;
		font-weight: 500;
		margin: 0;
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.photo-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: auto;
		background: #111;
		touch-action: pinch-zoom;
		-webkit-overflow-scrolling: touch;
	}

	.photo-image {
		max-width: none;
		max-height: none;
		width: 100%;
		height: auto;
		object-fit: contain;
		transform-origin: 0 0;
	}

	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: rgba(255, 255, 255, 0.7);
		text-align: center;
		padding: 2rem;
	}

	.error-detail {
		font-size: 0.875rem;
		color: #f87171;
	}

	.spinner {
		width: 2.5rem;
		height: 2.5rem;
		border: 3px solid rgba(255, 255, 255, 0.2);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.metadata-bar {
		display: flex;
		gap: 2rem;
		justify-content: center;
		padding: 0.75rem 1rem;
		background: rgba(0, 0, 0, 0.8);
	}

	.metadata-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.metadata-label {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: rgba(255, 255, 255, 0.5);
	}

	.metadata-value {
		font-size: 0.875rem;
		color: white;
	}

	.view-footer {
		padding: 1rem;
		background: rgba(0, 0, 0, 0.8);
	}

	.footer-buttons {
		display: flex;
		gap: 0.75rem;
	}

	.replace-button,
	.download-button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem;
		border: none;
		border-radius: 0.75rem;
		color: white;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}

	.replace-button {
		background: #10b981;
	}

	.download-button {
		background: #3b82f6;
	}

	.download-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.replace-button svg,
	.download-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}
</style>
