<script lang="ts">
	import { useQuery, useConvexClient } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { getStoredAccessKey } from '$lib/auth/access-key';
	import { generateThumbnail } from '$lib/photo/capture';
	import { browser } from '$app/environment';

	const client = browser ? useConvexClient() : null;
	const accessKey = getStoredAccessKey() ?? undefined;

	const choresQuery = browser
		? useQuery(api.photos.getChoresNeedingThumbnails, { accessKey })
		: null;

	const chores = $derived(choresQuery?.data ?? []);

	let isRunning = $state(false);
	let processed = $state(0);
	let succeeded = $state(0);
	let failed = $state(0);
	let currentChore = $state<string | null>(null);
	let errors = $state<string[]>([]);

	async function runBackfill() {
		if (!client || isRunning || chores.length === 0) return;

		isRunning = true;
		processed = 0;
		succeeded = 0;
		failed = 0;
		errors = [];

		for (const chore of chores) {
			currentChore = `${chore.date} — ${chore.text}`;

			try {
				// Step 1: Get the full photo URL
				const photoUrl = await client.query(api.photos.getPhotoUrl, {
					storageId: chore.photoStorageId as Id<'_storage'>,
					accessKey
				});

				if (!photoUrl) {
					throw new Error('Could not get photo URL');
				}

				// Step 2: Download the full image
				const response = await fetch(photoUrl);
				if (!response.ok) {
					throw new Error(`Download failed: ${response.status}`);
				}
				const blob = await response.blob();

				// Step 3: Generate JPEG thumbnail client-side (throwOnError to surface real errors)
				const thumbnail = await generateThumbnail(blob, { throwOnError: true });
				if (!thumbnail) {
					throw new Error('Thumbnail generation returned undefined');
				}

				// Step 4: Upload thumbnail to Convex storage
				const uploadUrl = await client.mutation(api.photos.generateUploadUrl, { accessKey });
				const uploadResponse = await fetch(uploadUrl, {
					method: 'POST',
					headers: { 'Content-Type': thumbnail.type },
					body: thumbnail
				});

				if (!uploadResponse.ok) {
					throw new Error(`Thumbnail upload failed: ${uploadResponse.status}`);
				}

				const { storageId: thumbnailStorageId } = (await uploadResponse.json()) as {
					storageId: Id<'_storage'>;
				};

				// Step 5: Attach thumbnail to chore
				await client.mutation(api.photos.attachThumbnail, {
					dailyChoreClientId: chore.clientId,
					thumbnailStorageId,
					accessKey
				});

				succeeded += 1;
			} catch (e) {
				failed += 1;
				const msg = e instanceof Error ? e.message : String(e);
				errors = [...errors, `${chore.date} ${chore.text}: ${msg}`];
			}

			processed += 1;
		}

		currentChore = null;
		isRunning = false;
	}
</script>

<div class="page">
	<main class="container">
		<h1 class="title">Backfill Thumbnails</h1>
		<p class="description">
			Generate WebP thumbnails for existing photos that don't have them.
			This reduces bandwidth by ~60x on the chore list.
		</p>

		{#if choresQuery?.isLoading}
			<div class="status-box">
				<div class="spinner"></div>
				<p>Loading chores...</p>
			</div>
		{:else if chores.length === 0 && !isRunning}
			<div class="status-box success">
				<p>All photos already have thumbnails. Nothing to do.</p>
			</div>
		{:else}
			<div class="stats">
				<div class="stat">
					<span class="stat-value">{chores.length}</span>
					<span class="stat-label">need thumbnails</span>
				</div>
				{#if isRunning || processed > 0}
					<div class="stat">
						<span class="stat-value">{processed}/{chores.length}</span>
						<span class="stat-label">processed</span>
					</div>
					<div class="stat success">
						<span class="stat-value">{succeeded}</span>
						<span class="stat-label">succeeded</span>
					</div>
					{#if failed > 0}
						<div class="stat error">
							<span class="stat-value">{failed}</span>
							<span class="stat-label">failed</span>
						</div>
					{/if}
				{/if}
			</div>

			{#if isRunning}
				<div class="progress-section">
					<div class="progress-bar">
						<div
							class="progress-fill"
							style="width: {(processed / chores.length) * 100}%"
						></div>
					</div>
					{#if currentChore}
						<p class="current-item">{currentChore}</p>
					{/if}
				</div>
			{/if}

			<button
				class="run-button"
				onclick={runBackfill}
				disabled={isRunning || chores.length === 0}
			>
				{#if isRunning}
					<div class="btn-spinner"></div>
					Processing...
				{:else if processed > 0 && processed === chores.length}
					Done
				{:else}
					Run Backfill ({chores.length} photos)
				{/if}
			</button>

			{#if errors.length > 0}
				<div class="error-list">
					<h3>Errors</h3>
					{#each errors as err}
						<p class="error-item">{err}</p>
					{/each}
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100%;
		background-color: #f9fafb;
	}

	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	.description {
		color: #6b7280;
		font-size: 0.875rem;
		margin: 0 0 2rem 0;
		line-height: 1.5;
	}

	.status-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		border-radius: 0.75rem;
		background: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		text-align: center;
		color: #6b7280;
	}

	.status-box.success {
		background: #f0fdf4;
		color: #16a34a;
	}

	.status-box p {
		margin: 0;
	}

	.stats {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.stat {
		flex: 1;
		min-width: 80px;
		padding: 1rem;
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.stat.success {
		background: #f0fdf4;
	}

	.stat.error {
		background: #fef2f2;
	}

	.stat-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
	}

	.stat.success .stat-value {
		color: #16a34a;
	}

	.stat.error .stat-value {
		color: #dc2626;
	}

	.stat-label {
		display: block;
		font-size: 0.75rem;
		color: #6b7280;
		margin-top: 0.25rem;
	}

	.progress-section {
		margin-bottom: 1.5rem;
	}

	.progress-bar {
		height: 0.5rem;
		background: #e5e7eb;
		border-radius: 9999px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #22c55e;
		border-radius: 9999px;
		transition: width 0.3s ease;
	}

	.current-item {
		font-size: 0.8125rem;
		color: #6b7280;
		margin: 0.5rem 0 0 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.run-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 1rem;
		border: none;
		border-radius: 0.75rem;
		background: #22c55e;
		color: white;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		min-height: 3.5rem;
	}

	.run-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-spinner {
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid #e5e7eb;
		border-top-color: #22c55e;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-list {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #fef2f2;
		border-radius: 0.5rem;
	}

	.error-list h3 {
		font-size: 0.875rem;
		font-weight: 600;
		color: #dc2626;
		margin: 0 0 0.5rem 0;
	}

	.error-item {
		font-size: 0.8125rem;
		color: #991b1b;
		margin: 0.25rem 0;
		line-height: 1.4;
	}
</style>
