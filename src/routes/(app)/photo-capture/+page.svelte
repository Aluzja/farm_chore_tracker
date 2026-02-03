<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { capturePhoto } from '$lib/photo/capture';
	import { enqueuePhoto } from '$lib/photo/queue';
	import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';
	import { getCurrentUser } from '$lib/auth/user-context.svelte';
	import { syncEngine } from '$lib/sync/engine.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';

	// Get chore ID and replace flag from query params
	const choreId = $page.url.searchParams.get('choreId');
	const isReplaceMode = $page.url.searchParams.get('replace') === 'true';

	let previewUrl = $state<string | null>(null);
	let capturedBlob = $state<Blob | null>(null);
	let originalSize = $state(0);
	let isCapturing = $state(false);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	// Find the chore to display its name
	const chore = $derived(dailyChoreStore.items.find((c) => c._id === choreId));

	async function handleCapture() {
		isCapturing = true;
		error = null;

		try {
			const result = await capturePhoto();
			if (result) {
				previewUrl = result.previewUrl;
				capturedBlob = result.blob;
				originalSize = result.originalSize;
			} else {
				// User cancelled
				await goto(resolve('/'));
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to capture photo';
		} finally {
			isCapturing = false;
		}
	}

	async function handleRetake() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		previewUrl = null;
		capturedBlob = null;
		await handleCapture();
	}

	async function handleAccept() {
		if (!capturedBlob || !choreId) return;

		isSubmitting = true;
		error = null;

		try {
			const user = getCurrentUser();
			const capturedAt = Date.now();

			// Queue photo for upload
			await enqueuePhoto({
				id: crypto.randomUUID(),
				dailyChoreClientId: choreId,
				blob: capturedBlob,
				mimeType: 'image/jpeg',
				originalSize,
				compressedSize: capturedBlob.size,
				capturedAt,
				capturedBy: user,
				uploadStatus: 'pending'
			});

			// Mark chore as complete (skip if replacing - already complete)
			if (!isReplaceMode) {
				await dailyChoreStore.toggleComplete(choreId, user);
			}

			// Trigger sync if online - IMPORTANT: call processPhotoQueue() specifically
			// to ensure photo uploads are triggered immediately, not just mutation sync
			if (connectionStatus.isOnline) {
				syncEngine.processQueue();
				syncEngine.processPhotoQueue();
			}

			// Navigate back to chore list
			await goto(resolve('/'));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save photo';
			isSubmitting = false;
		}
	}

	function handleCancel() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		goto(resolve('/'));
	}

	// Auto-trigger capture on mount
	$effect(() => {
		if (!previewUrl && !isCapturing && !error) {
			handleCapture();
		}
	});
</script>

<main class="capture-container">
	<header class="capture-header">
		<button class="cancel-button" onclick={handleCancel} disabled={isSubmitting}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
		<h1 class="capture-title">{isReplaceMode ? 'Replace Photo' : (chore?.text || 'Capture Photo')}</h1>
	</header>

	{#if error}
		<div class="error-container">
			<p class="error-message">{error}</p>
			<button class="retry-button" onclick={handleCapture}>Try Again</button>
		</div>
	{:else if isCapturing}
		<div class="loading-container">
			<div class="spinner"></div>
			<p>Opening camera...</p>
		</div>
	{:else if previewUrl}
		<div class="preview-container">
			<img src={previewUrl} alt="Captured photo preview" class="preview-image" />
		</div>

		<div class="button-row">
			<button class="button button-secondary" onclick={handleRetake} disabled={isSubmitting}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M1 4v6h6"></path>
					<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
				</svg>
				Retake
			</button>
			<button class="button button-primary" onclick={handleAccept} disabled={isSubmitting}>
				{#if isSubmitting}
					<div class="button-spinner"></div>
					Saving...
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
					Accept
				{/if}
			</button>
		</div>
	{:else}
		<div class="loading-container">
			<p>Ready to capture</p>
		</div>
	{/if}
</main>

<style>
	.capture-container {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		background: #000;
		color: white;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.capture-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.8);
		z-index: 10;
	}

	.cancel-button {
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

	.cancel-button:disabled {
		opacity: 0.5;
	}

	.cancel-button svg {
		width: 1.25rem;
		height: 1.25rem;
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

	.loading-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: rgba(255, 255, 255, 0.7);
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

	.error-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding: 2rem;
	}

	.error-message {
		color: #f87171;
		text-align: center;
		font-size: 1rem;
	}

	.retry-button {
		padding: 0.75rem 2rem;
		border: none;
		border-radius: 0.5rem;
		background: #3b82f6;
		color: white;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
	}

	.preview-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: #111;
	}

	.preview-image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.button-row {
		display: flex;
		gap: 1rem;
		padding: 1.5rem;
		background: rgba(0, 0, 0, 0.8);
	}

	.button {
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

	.button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.button-secondary {
		background: rgba(255, 255, 255, 0.15);
		color: white;
	}

	.button-primary {
		background: #22c55e;
		color: white;
	}

	.button-spinner {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
</style>
