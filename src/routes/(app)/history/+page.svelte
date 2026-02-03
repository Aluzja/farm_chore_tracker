<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api';
	import PhotoThumbnail from '$lib/components/PhotoThumbnail.svelte';

	const history = useQuery(api.dailyChores.getHistory, { daysBack: 7 });

	// Format date for display: "Today", "Yesterday", or "Mon, Feb 1"
	function formatDisplayDate(dateStr: string): string {
		const date = new Date(dateStr + 'T12:00:00'); // Noon to avoid timezone issues
		const today = new Date();
		today.setHours(12, 0, 0, 0);
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		const dateOnly = date.toDateString();
		if (dateOnly === today.toDateString()) return 'Today';
		if (dateOnly === yesterday.toDateString()) return 'Yesterday';

		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	// Format ISO time string to readable time: "2:30 PM"
	function formatTime(isoString: string | undefined): string {
		if (!isoString) return '';
		const date = new Date(isoString);
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	// Group chores by date
	const grouped = $derived.by(() => {
		if (!history.data) return [];
		const groups = new Map<string, typeof history.data>();
		for (const chore of history.data) {
			if (!groups.has(chore.date)) groups.set(chore.date, []);
			groups.get(chore.date)!.push(chore);
		}
		return Array.from(groups.entries()).map(([date, chores]) => ({
			date,
			displayDate: formatDisplayDate(date),
			chores
		}));
	});

	function handleBack() {
		goto(resolve('/'));
	}
</script>

<div class="history-page">
	<header class="history-header">
		<button class="back-button" onclick={handleBack} aria-label="Go back">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="15 18 9 12 15 6"></polyline>
			</svg>
		</button>
		<h1>History</h1>
		<div class="header-spacer"></div>
	</header>

	<main class="history-content">
		{#if history.isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading history...</p>
			</div>
		{:else if !history.data || history.data.length === 0}
			<div class="empty-state">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
				<p class="empty-text">No completed chores in the past 7 days</p>
			</div>
		{:else}
			{#each grouped as group}
				<section class="date-group">
					<h2 class="date-header">{group.displayDate}</h2>
					<div class="chore-list">
						{#each group.chores as chore}
							<article class="chore-card">
								<div class="chore-content">
									<p class="chore-text">{chore.text}</p>
									<div class="chore-meta">
										<span class="meta-slot">{chore.timeSlot}</span>
										{#if chore.animalCategory}
											<span class="meta-separator">-</span>
											<span class="meta-category">{chore.animalCategory}</span>
										{/if}
									</div>
									<div class="completion-info">
										{#if chore.completedBy}
											<span class="completed-by">{chore.completedBy}</span>
										{/if}
										{#if chore.completedAt}
											<span class="completed-at">{formatTime(chore.completedAt)}</span>
										{/if}
									</div>
								</div>
								{#if chore.photoStorageId}
									<div class="chore-photo">
										<PhotoThumbnail
											choreId={chore.clientId}
											storageId={chore.photoStorageId}
										/>
									</div>
								{/if}
							</article>
						{/each}
					</div>
				</section>
			{/each}
		{/if}
	</main>
</div>

<style>
	.history-page {
		min-height: 100vh;
		background-color: #f3f4f6;
		-webkit-overflow-scrolling: touch;
	}

	.history-header {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: white;
		border-bottom: 1px solid #e5e7eb;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.history-header h1 {
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
		margin: 0;
	}

	.back-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		background: none;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		color: #374151;
	}

	.back-button:hover {
		background-color: #f3f4f6;
	}

	.back-button svg {
		width: 1.5rem;
		height: 1.5rem;
	}

	.header-spacer {
		width: 2.5rem;
	}

	.history-content {
		max-width: 600px;
		margin: 0 auto;
		padding-bottom: 2rem;
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 1rem;
		text-align: center;
		color: #6b7280;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid #e5e7eb;
		border-top-color: #2563eb;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.empty-icon {
		width: 4rem;
		height: 4rem;
		color: #9ca3af;
		margin-bottom: 1rem;
	}

	.empty-text {
		font-size: 1rem;
		color: #6b7280;
		margin: 0;
	}

	.date-group {
		margin-top: 1rem;
	}

	.date-header {
		position: sticky;
		top: 3.5rem; /* Below the header */
		z-index: 10;
		background: #f3f4f6;
		padding: 0.5rem 1rem;
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
		text-transform: capitalize;
	}

	.chore-list {
		display: flex;
		flex-direction: column;
	}

	.chore-card {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		background: white;
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
		min-height: 3.5rem; /* 56px touch-friendly height */
	}

	.chore-card:first-child {
		border-top: 1px solid #e5e7eb;
	}

	.chore-content {
		flex: 1;
		min-width: 0; /* Allow text truncation */
	}

	.chore-text {
		font-size: 1rem;
		font-weight: 500;
		color: #111827;
		margin: 0 0 0.25rem 0;
		line-height: 1.4;
	}

	.chore-meta {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8125rem;
		color: #6b7280;
		margin-bottom: 0.375rem;
	}

	.meta-slot {
		text-transform: capitalize;
	}

	.meta-separator {
		color: #9ca3af;
	}

	.meta-category {
		text-transform: capitalize;
	}

	.completion-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}

	.completed-by {
		color: #2563eb;
		font-weight: 500;
	}

	.completed-at {
		color: #9ca3af;
	}

	.chore-photo {
		flex-shrink: 0;
	}

	/* Mobile-specific adjustments */
	@media (max-width: 640px) {
		.history-content {
			max-width: none;
		}

		.chore-card {
			padding: 0.875rem 1rem;
		}
	}

	/* High contrast for outdoor visibility */
	@media (prefers-contrast: more) {
		.chore-text {
			color: #000;
		}

		.chore-meta,
		.completion-info {
			color: #374151;
		}
	}
</style>
