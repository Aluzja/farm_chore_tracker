<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';
	import { getOrCacheImage } from '$lib/db/imageCache';
	import { getStoredAccessKey } from '$lib/auth/access-key';
	import { getCurrentUser } from '$lib/auth/user-context.svelte';

	interface Props {
		choreId: string;
		siblingIds?: string[];
		onclose: () => void;
	}

	const { choreId, siblingIds = [], onclose }: Props = $props();

	// Position within the sibling list, for left/right navigation.
	const currentIndex = $derived(siblingIds.indexOf(choreId));
	const hasPrev = $derived(currentIndex > 0);
	const hasNext = $derived(currentIndex >= 0 && currentIndex < siblingIds.length - 1);

	function navigate(offset: number) {
		const target = siblingIds[currentIndex + offset];
		if (!target) return;
		// Replace (not push) so the viewer stays a single history entry and
		// closing returns to the list rather than stepping back through photos.
		replaceState(`/photo-view/${target}`, {
			photoChoreId: target,
			photoSiblingIds: siblingIds
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft' && hasPrev) navigate(-1);
		else if (event.key === 'ArrowRight' && hasNext) navigate(1);
		else if (event.key === 'Escape') onclose();
	}

	// Pinch-to-zoom + pan. The app disables native zoom globally (viewport
	// user-scalable=no), so we handle it ourselves inside the viewer.
	const MAX_SCALE = 4;
	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	const isZoomed = $derived(scale > 1);

	let startDist = 0;
	let startScale = 1;
	let panStartX = 0;
	let panStartY = 0;
	let panStartTx = 0;
	let panStartTy = 0;
	let lastTapTime = 0;

	function resetZoom() {
		scale = 1;
		tx = 0;
		ty = 0;
	}

	// Reset zoom whenever the displayed photo changes.
	$effect(() => {
		choreId;
		resetZoom();
	});

	function touchDistance(touches: TouchList): number {
		return Math.hypot(
			touches[0].clientX - touches[1].clientX,
			touches[0].clientY - touches[1].clientY
		);
	}

	function handleTouchStart(event: TouchEvent) {
		if (event.touches.length === 2) {
			startDist = touchDistance(event.touches);
			startScale = scale;
		} else if (event.touches.length === 1 && isZoomed) {
			panStartX = event.touches[0].clientX;
			panStartY = event.touches[0].clientY;
			panStartTx = tx;
			panStartTy = ty;
		}
	}

	function handleTouchMove(event: TouchEvent) {
		if (event.touches.length === 2 && startDist > 0) {
			const next = startScale * (touchDistance(event.touches) / startDist);
			scale = Math.min(Math.max(next, 1), MAX_SCALE);
			if (scale === 1) {
				tx = 0;
				ty = 0;
			}
		} else if (event.touches.length === 1 && isZoomed) {
			tx = panStartTx + (event.touches[0].clientX - panStartX);
			ty = panStartTy + (event.touches[0].clientY - panStartY);
		}
	}

	function handleTouchEnd(event: TouchEvent) {
		startDist = 0;
		if (event.touches.length > 0) return;
		// Double-tap toggles between fit and 2x zoom.
		const now = Date.now();
		if (now - lastTapTime < 300) {
			if (isZoomed) resetZoom();
			else scale = 2;
			lastTapTime = 0;
		} else {
			lastTapTime = now;
		}
	}

	// Find the chore in the local store (today's chores).
	// May be undefined for history chores — that's fine, we query the photo URL
	// by clientId directly so the modal works for any chore.
	const chore = $derived(dailyChoreStore.items.find((c) => c._id === choreId));

	// Query photo URL by chore clientId — works for both today and history chores.
	// Wrapped in $derived so navigating between photos (choreId prop changes on the
	// same component instance) re-subscribes the query to the new chore.
	const photoUrlQuery = $derived(
		useQuery(api.photos.getPhotoUrlByChore, {
			dailyChoreClientId: choreId,
			accessKey: getStoredAccessKey() ?? undefined
		})
	);

	// Create a promise that loads the image (from cache or network)
	async function loadImage(remoteUrl: string): Promise<string> {
		const blobUrl = await getOrCacheImage(choreId, remoteUrl);
		if (!blobUrl) {
			throw new Error('Failed to load image');
		}
		return blobUrl;
	}

	// Stabilize image promise — only create a new one when the URL actually changes.
	// Without this, every store hydration would create a new Promise (even with
	// identical data), causing {#await} to reset to "Loading..." indefinitely.
	let imagePromise = $state<Promise<string> | null>(null);
	let trackedUrl = '';

	$effect(() => {
		if (photoUrlQuery.error) {
			trackedUrl = '';
			imagePromise = Promise.reject(new Error(photoUrlQuery.error.message));
			return;
		}

		const url = photoUrlQuery.data;
		if (url && url !== trackedUrl) {
			trackedUrl = url;
			loadedImageUrl = null;
			imagePromise = loadImage(url);
		} else if (url === null && !photoUrlQuery.isLoading) {
			trackedUrl = '';
			imagePromise = null;
		}
	});

	// Track loaded URL for download functionality
	let loadedImageUrl = $state<string | null>(null);

	function handleImageLoad(url: string) {
		loadedImageUrl = url;
	}

	function handleDownload() {
		if (!loadedImageUrl) return;

		const link = document.createElement('a');
		link.href = loadedImageUrl;
		link.download = `chore-${choreId}-${Date.now()}.jpg`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function handleReplace() {
		goto(resolve('/(app)/photo-capture/[choreId]/replace', { choreId }));
	}

	function formatDateTime(timestamp: number | undefined): string {
		if (!timestamp) return '';
		return new Date(timestamp).toLocaleString();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="view-container" role="dialog" aria-modal="true" aria-label="Photo viewer">
	<header class="view-header">
		<h1 class="view-title">{chore?.text || 'Photo'}</h1>
		<button class="close-button" onclick={onclose} aria-label="Close">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	</header>

	<div
		class="photo-container"
		role="group"
		aria-label="Zoomable photo — pinch or double-tap to zoom"
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		{#if hasPrev && !isZoomed}
			<button class="nav-arrow nav-prev" onclick={() => navigate(-1)} aria-label="Previous photo">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="15 18 9 12 15 6"></polyline>
				</svg>
			</button>
		{/if}
		{#if hasNext && !isZoomed}
			<button class="nav-arrow nav-next" onclick={() => navigate(1)} aria-label="Next photo">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			</button>
		{/if}
		{#if imagePromise}
			{#await imagePromise}
				<div class="loading-state">
					<div class="spinner"></div>
					<p>Loading photo...</p>
				</div>
			{:then url}
				<img
					src={url}
					alt="Chore completion"
					class="photo-image"
					class:zoomed={isZoomed}
					style="transform: translate({tx}px, {ty}px) scale({scale})"
					onload={() => handleImageLoad(url)}
				/>
			{:catch error}
				<div class="error-state">
					<p>Failed to load photo</p>
					<p class="error-detail">{error.message}</p>
				</div>
			{/await}
		{:else if photoUrlQuery.isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading photo...</p>
			</div>
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
			<button class="replace-button" onclick={handleReplace} disabled={!chore || chore.completedBy !== getCurrentUser()}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path
						d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
					></path>
					<circle cx="12" cy="13" r="4"></circle>
				</svg>
				Replace Photo
			</button>
			<button class="download-button" onclick={handleDownload} disabled={!loadedImageUrl}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
					<polyline points="7 10 12 15 17 10"></polyline>
					<line x1="12" y1="15" x2="12" y2="3"></line>
				</svg>
				Download
			</button>
		</div>
	</footer>
</div>

<style>
	.view-container {
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

	.view-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.8);
		z-index: 10;
	}

	.close-button {
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

	.close-button svg {
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
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: #111;
		/* Gestures are handled in JS (pinch-zoom / pan), so suppress native touch actions */
		touch-action: none;
	}

	.photo-image {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		transform-origin: center center;
		will-change: transform;
	}

	.photo-image.zoomed {
		cursor: grab;
	}

	.nav-arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 5;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.5);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.nav-arrow:hover {
		background: rgba(0, 0, 0, 0.75);
	}

	.nav-arrow svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	.nav-prev {
		left: 0.75rem;
	}

	.nav-next {
		right: 0.75rem;
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

	.replace-button:disabled,
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
