<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { capturePhoto, type CompressionProgress } from '$lib/photo/capture';
	import { enqueuePhoto } from '$lib/photo/queue';
	import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';
	import { getCurrentUser } from '$lib/auth/user-context.svelte';
	import { syncEngine } from '$lib/sync/engine.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';

	// Get chore ID from route param, replace flag from query param
	const choreId = $derived(page.params.choreId);
	const isReplaceMode = $derived(page.url.searchParams.get('replace') === 'true');

	let previewUrl = $state<string | null>(null);
	let capturedBlob = $state<Blob | null>(null);
	let originalSize = $state(0);
	let isCapturing = $state(false);
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let hasAttemptedCapture = $state(false);

	// Compression progress tracking
	let compressionProgress = $state(0);
	let usingMainThread = $state(false);

	// Find the chore to display its name
	const chore = $derived(dailyChoreStore.items.find((c) => c._id === choreId));

	function handleProgress(progress: CompressionProgress) {
		compressionProgress = Math.round(progress.percent);
		usingMainThread = progress.usingMainThread;
	}

	async function handleCapture() {
		isCapturing = true;
		hasAttemptedCapture = true;
		error = null;
		compressionProgress = 0;
		usingMainThread = false;

		try {
			const result = await capturePhoto(handleProgress);
			if (result) {
				previewUrl = result.previewUrl;
				capturedBlob = result.blob;
				originalSize = result.originalSize;
			} else {
				// User cancelled - stay on page so they can try again
				// (iOS Safari requires user gesture for file input)
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
		if (!capturedBlob || !choreId || !chore) return;

		isSubmitting = true;
		error = null;

		try {
			const user = getCurrentUser();
			const capturedAt = Date.now();

			// Queue photo for upload - local _id equals Convex clientId
			await enqueuePhoto({
				id: crypto.randomUUID(),
				dailyChoreClientId: chore._id,
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

	// Note: We do NOT auto-trigger capture on mount.
	// iOS Safari requires file input clicks to be triggered by a direct user gesture.
	// Calling input.click() from onMount() (not a user gesture) will silently fail on iOS.
</script>

<main class="capture-container">
	<header class="capture-header">
		<button
			class="cancel-button"
			onclick={handleCancel}
			disabled={isSubmitting}
			aria-label="Cancel"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
		<h1 class="capture-title">
			{isReplaceMode ? 'Replace Photo' : chore?.text || 'Capture Photo'}
		</h1>
	</header>

	{#if error}
		<div class="error-container">
			<p class="error-message">{error}</p>
			<button class="retry-button" onclick={handleCapture}>Try Again</button>
		</div>
	{:else if isCapturing}
		<div class="loading-container">
			<div class="progress-ring-container">
				<svg class="progress-ring" viewBox="0 0 100 100">
					<circle class="progress-ring-bg" cx="50" cy="50" r="45" />
					<circle
						class="progress-ring-fill"
						cx="50"
						cy="50"
						r="45"
						style="stroke-dashoffset: {283 - (283 * compressionProgress) / 100}"
					/>
				</svg>
				<span class="progress-percent">{compressionProgress}%</span>
			</div>
			<p class="progress-label">
				{#if usingMainThread}
					Processing (compatibility mode)...
				{:else}
					Processing...
				{/if}
			</p>
			{#if usingMainThread}
				<p class="progress-hint">This may take a moment on older devices</p>
			{/if}
		</div>
	{:else if previewUrl}
		<div class="preview-container">
			<img src={previewUrl} alt="Captured preview" class="preview-image" />
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
		<div class="ready-container">
			<button class="capture-button" onclick={handleCapture}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path
						d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
					></path>
					<circle cx="12" cy="13" r="4"></circle>
				</svg>
				{hasAttemptedCapture ? 'Try Again' : 'Take Photo'}
			</button>
			{#if hasAttemptedCapture}
				<p class="hint-text">Tap the button to open your camera</p>
			{/if}
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
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
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
	}

	.progress-hint {
		margin: 0;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.5);
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

	.ready-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		padding: 2rem;
	}

	.capture-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		width: 10rem;
		height: 10rem;
		border-radius: 50%;
		border: 3px solid rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.1);
		color: white;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.capture-button:active {
		transform: scale(0.95);
		background: rgba(255, 255, 255, 0.2);
	}

	.capture-button svg {
		width: 3rem;
		height: 3rem;
	}

	.hint-text {
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.9rem;
		text-align: center;
	}
</style>
