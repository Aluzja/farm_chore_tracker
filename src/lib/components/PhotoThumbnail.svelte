<script lang="ts">
	import { pushState } from '$app/navigation';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';
	import { getOrCacheImage } from '$lib/db/imageCache';
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

	// Create a promise that loads the image (from cache or network)
	async function loadImage(remoteUrl: string): Promise<string> {
		const blobUrl = await getOrCacheImage(displayStorageId, remoteUrl);
		if (!blobUrl) {
			throw new Error('Failed to load image');
		}
		return blobUrl;
	}

	// Derive the image promise - only create when we have data
	const imagePromise = $derived.by(() => {
		if (photoUrlQuery.error) {
			return Promise.reject(new Error('Query failed'));
		}
		if (photoUrlQuery.data) {
			return loadImage(photoUrlQuery.data);
		}
		return null;
	});

	function handleClick() {
		pushState(`/photo-view/${choreId}`, { photoChoreId: choreId });
	}
</script>

<button class="thumbnail" onclick={handleClick} aria-label="View photo">
	{#if imagePromise}
		{#await imagePromise}
			<span class="thumbnail-loading"></span>
		{:then url}
			<img src={url} alt="Chore completion" />
		{:catch}
			<span class="thumbnail-placeholder">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
					<circle cx="8.5" cy="8.5" r="1.5"></circle>
					<polyline points="21 15 16 10 5 21"></polyline>
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

	.thumbnail-placeholder {
		color: #9ca3af;
	}

	.thumbnail-placeholder svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
