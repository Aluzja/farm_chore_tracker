<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../../convex/_generated/api';
	import AdminNav from '$lib/components/AdminNav.svelte';
	import PhotoThumbnail from '$lib/components/PhotoThumbnail.svelte';

	const dateParam = $derived(page.params.date);

	const history = useQuery(api.dailyChores.getHistory, { daysBack: 7 });

	// Format date for display: "Today", "Yesterday", or "Monday, February 3"
	function formatDisplayDate(dateStr: string): string {
		const date = new Date(dateStr + 'T12:00:00');
		const today = new Date();
		today.setHours(12, 0, 0, 0);
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		const dateOnly = date.toDateString();
		if (dateOnly === today.toDateString()) return 'Today';
		if (dateOnly === yesterday.toDateString()) return 'Yesterday';

		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
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

	// Get chores for this specific date
	const dayChores = $derived.by(() => {
		if (!history.data) return [];
		return history.data.filter((c) => c.date === dateParam);
	});

	// Group by time slot
	const grouped = $derived.by(() => {
		const slots = new Map<string, typeof dayChores>();
		for (const chore of dayChores) {
			if (!slots.has(chore.timeSlot)) slots.set(chore.timeSlot, []);
			slots.get(chore.timeSlot)!.push(chore);
		}
		const order = ['morning', 'afternoon', 'evening'];
		return order
			.filter((slot) => slots.has(slot))
			.map((slot) => ({
				slot,
				label: slot.charAt(0).toUpperCase() + slot.slice(1),
				chores: slots.get(slot)!
			}));
	});

	// Summary stats
	const stats = $derived.by(() => {
		const completed = dayChores.filter((c) => c.isCompleted).length;
		const total = dayChores.length;
		return {
			completed,
			total,
			percentage: total > 0 ? Math.round((completed / total) * 100) : 0
		};
	});

	function handleBack() {
		goto(resolve('/history'));
	}
</script>

<AdminNav />

<div class="page">
	<main class="container">
		<button class="back-button" onclick={handleBack}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="15 18 9 12 15 6"></polyline>
			</svg>
			Back to History
		</button>

		<header class="day-header">
			<h1 class="title">{formatDisplayDate(dateParam ?? '')}</h1>
			<div class="summary">
				<span class="summary-text">{stats.completed} of {stats.total} completed</span>
				<span class="summary-percent">{stats.percentage}%</span>
			</div>
		</header>

		{#if history.isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading...</p>
			</div>
		{:else if dayChores.length === 0}
			<div class="empty-state">
				<p>No chores recorded for this day</p>
			</div>
		{:else}
			<div class="chore-sections">
				{#each grouped as group (group.slot)}
					<section class="time-slot-section">
						<h2 class="time-slot-header time-slot-{group.slot}">{group.label}</h2>
						<ul class="chore-list">
							{#each group.chores as chore (chore.clientId)}
								<li class="chore-item" class:completed={chore.isCompleted}>
									<div class="chore-status">
										{#if chore.isCompleted}
											<div class="status-icon completed">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
											</div>
										{:else}
											<div class="status-icon incomplete">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<line x1="18" y1="6" x2="6" y2="18"></line>
													<line x1="6" y1="6" x2="18" y2="18"></line>
												</svg>
											</div>
										{/if}
									</div>

									<div class="chore-content">
										<span class="chore-text">{chore.text}</span>
										{#if chore.animalCategory}
											<span class="chore-category">{chore.animalCategory}</span>
										{/if}
										{#if chore.isCompleted && chore.completedBy}
											<div class="completion-info">
												<span class="completed-by">{chore.completedBy}</span>
												{#if chore.completedAt}
													<span class="completed-at">at {formatTime(chore.completedAt)}</span>
												{/if}
											</div>
										{/if}
									</div>

									{#if chore.photoStorageId}
										<div class="chore-photo">
											<PhotoThumbnail choreId={chore.clientId} storageId={chore.photoStorageId} />
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		background-color: #f9fafb;
	}

	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 1rem;
		padding-bottom: calc(2rem + env(safe-area-inset-bottom, 0px));
	}

	.back-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: none;
		font-size: 0.875rem;
		color: #6b7280;
		cursor: pointer;
		padding: 0.5rem 0;
		margin-bottom: 1rem;
	}

	.back-button:hover {
		color: #111827;
	}

	.back-button svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.day-header {
		margin-bottom: 1.5rem;
	}

	.title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	.summary {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.summary-text {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.summary-percent {
		font-size: 0.875rem;
		font-weight: 600;
		color: #22c55e;
		background: #f0fdf4;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
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

	.chore-sections {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.time-slot-section {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.time-slot-header {
		font-size: 1rem;
		font-weight: 600;
		color: white;
		padding: 0.75rem 1rem;
		margin: 0;
	}

	.time-slot-morning {
		background: #f59e0b;
	}

	.time-slot-afternoon {
		background: #3b82f6;
	}

	.time-slot-evening {
		background: #8b5cf6;
	}

	.chore-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.chore-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid #f3f4f6;
	}

	.chore-item:last-child {
		border-bottom: none;
	}

	.chore-item.completed {
		background: #f0fdf4;
	}

	.chore-status {
		flex-shrink: 0;
	}

	.status-icon {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status-icon.completed {
		background: #22c55e;
		color: white;
	}

	.status-icon.completed svg {
		width: 1rem;
		height: 1rem;
	}

	.status-icon.incomplete {
		background: #fef2f2;
		color: #dc2626;
	}

	.status-icon.incomplete svg {
		width: 1rem;
		height: 1rem;
	}

	.chore-content {
		flex: 1;
		min-width: 0;
	}

	.chore-text {
		display: block;
		font-size: 1rem;
		color: #111827;
		line-height: 1.4;
	}

	.chore-item.completed .chore-text {
		color: #6b7280;
	}

	.chore-category {
		display: inline-block;
		font-size: 0.75rem;
		color: #6b7280;
		margin-top: 0.25rem;
	}

	.completion-info {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		margin-top: 0.25rem;
	}

	.completed-by {
		color: #16a34a;
		font-weight: 500;
	}

	.completed-at {
		color: #9ca3af;
	}

	.chore-photo {
		flex-shrink: 0;
	}
</style>
