<script lang="ts">
	import { pushState } from '$app/navigation';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';
	import { getOrCacheImage, removeCachedImage } from '$lib/db/imageCache';
	import { getStoredAccessKey } from '$lib/auth/access-key';

	interface Props {
		choreId: string;
		storageId: string;
		thumbnailStorageId?: string;
	}

	const { choreId, storageId, thumbnailStorageId }: Props = $props();

	// Use thumbnail for the list view if available, fall back to full image
	const displayStorageId = $derived(thumbnailStorageId ?? storageId);

	// Query for the remote URL
	const photoUrlQuery = $derived(
		useQuery(api.photos.getPhotoUrl, {
			storageId: displayStorageId as Id<'_storage'>,
			accessKey: getStoredAccessKey() ?? undefined
		})
	);

	// Track consecutive null results before declaring broken.
	// This prevents transient nulls (subscription reconnection, brief network blip)
	// from immediately showing the broken state.
	let nullCount = $state(0);
	const BROKEN_THRESHOLD = 3;

	$effect(() => {
		const isNull =
			photoUrlQuery.isLoading === false &&
			photoUrlQuery.error === undefined &&
			photoUrlQuery.data === null;

		if (isNull) {
			nullCount++;
		} else {
			nullCount = 0;
		}
	});

	const isBrokenReference = $derived(nullCount >= BROKEN_THRESHOLD);

	// Track retry attempts for onerror recovery
	let retryCount = $state(0);
	const MAX_RETRIES = 2;

	// Validate that a blob URL actually contains decodable image data
	function validateImage(blobUrl: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(blobUrl);
			img.onerror = () => reject(new Error('Image decode failed'));
			img.src = blobUrl;
		});
	}

	// Load image from cache or network, then validate it's decodable
	async function loadImage(remoteUrl: string): Promise<string> {
		const blobUrl = await getOrCacheImage(displayStorageId, remoteUrl);
		if (!blobUrl) {
			throw new Error('Failed to load image');
		}
		// Validate the blob is actually renderable image data
		return validateImage(blobUrl);
	}

	// Derive the image promise - only create when we have data
	// retryCount is read here so that incrementing it triggers a re-fetch
	const imagePromise = $derived.by(() => {
		// Read retryCount to establish reactivity for retries
		const _retry = retryCount;

		if (photoUrlQuery.error) {
			return Promise.reject(new Error('Query failed'));
		}
		if (photoUrlQuery.data) {
			return loadImage(photoUrlQuery.data);
		}
		if (isBrokenReference) {
			return Promise.reject(new Error('Photo not found'));
		}
		return null;
	});

	// When <img> fails to render, evict cache and retry
	async function handleImgError() {
		if (retryCount < MAX_RETRIES) {
			await removeCachedImage(displayStorageId);
			retryCount++;
		}
	}

	// Manual retry: evict cache, reset broken-reference counter, and re-trigger load
	async function handleRetry(event: MouseEvent) {
		event.stopPropagation();
		await removeCachedImage(displayStorageId);
		nullCount = 0;
		retryCount++;
	}

	function handleClick() {
		pushState(`/photo-view/${choreId}`, { photoChoreId: choreId });
	}
</script>

<button class="thumbnail" onclick={handleClick} aria-label="View photo">
	{#if imagePromise}
		{#await imagePromise}
			<span class="thumbnail-loading"></span>
		{:then url}
			<img src={url} alt="Chore completion" onerror={handleImgError} />
		{:catch}
			<span
				class="thumbnail-retry"
				role="button"
				tabindex="0"
				onclick={handleRetry}
				onkeydown={(e) => {
					if (e.key === 'Enter') handleRetry(e as unknown as MouseEvent);
				}}
				aria-label="Tap to retry loading photo"
				title="Tap to retry"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="23 4 23 10 17 10"></polyline>
					<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
				</svg>
			</span>
		{/await}
	{:else}
		<span class="thumbnail-loading"></span>
	{/if}
</button>

<style>
	.thumbnail {
		flex-shrink: 0;
		width: 3rem;
		height: 3rem;
		border-radius: 0.375rem;
		border: 1px solid #e5e7eb;
		background: #f9fafb;
		overflow: hidden;
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.thumbnail:hover {
		border-color: #3b82f6;
	}

	.thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumbnail-loading {
		width: 1rem;
		height: 1rem;
		border: 2px solid #e5e7eb;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.thumbnail-retry {
		color: #6b7280;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		background: #f3f4f6;
	}

	.thumbnail-retry svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.thumbnail-retry:hover {
		background: #e5e7eb;
		color: #3b82f6;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
