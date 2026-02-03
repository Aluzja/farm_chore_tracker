<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import type { Id } from '../../convex/_generated/dataModel';

	interface Props {
		choreId: string;
		storageId: string;
	}

	const { choreId, storageId }: Props = $props();

	// Make query reactive to storageId changes (e.g., when photo is replaced)
	const photoUrlQuery = $derived(
		useQuery(api.photos.getPhotoUrl, {
			storageId: storageId as Id<'_storage'>
		})
	);

	// Add cache-busting param using storageId to prevent browser caching old images
	const photoUrl = $derived(
		photoUrlQuery.data ? `${photoUrlQuery.data}${photoUrlQuery.data.includes('?') ? '&' : '?'}v=${storageId}` : null
	);

	// Preload image and return promise that resolves when loaded
	function preloadImage(url: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(url);
			img.onerror = () => reject(new Error('Failed to load image'));
			img.src = url;
		});
	}

	// Create promise that reacts to URL changes - {#await} will show loading while image loads
	const imagePromise = $derived(photoUrl ? preloadImage(photoUrl) : null);

	function handleClick() {
		goto(resolve(`/photo-view/${choreId}`));
	}
</script>

<button class="thumbnail" onclick={handleClick} aria-label="View photo">
	{#if photoUrlQuery.isLoading}
		<span class="thumbnail-loading"></span>
	{:else if imagePromise}
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
		<span class="thumbnail-placeholder">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
				<circle cx="8.5" cy="8.5" r="1.5"></circle>
				<polyline points="21 15 16 10 5 21"></polyline>
			</svg>
		</span>
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
