<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity */
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api';
	import AdminNav from '$lib/components/AdminNav.svelte';

	const history = useQuery(api.dailyChores.getHistory, { daysBack: 7 });

	// Format date for display: "Today", "Yesterday", or "Monday, Feb 3"
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
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}

	// Group chores by date and compute summary stats
	const days = $derived.by(() => {
		if (!history.data) return [];
		const groups = new Map<string, typeof history.data>();
		for (const chore of history.data) {
			if (!groups.has(chore.date)) groups.set(chore.date, []);
			groups.get(chore.date)!.push(chore);
		}
		return Array.from(groups.entries()).map(([date, chores]) => {
			const completed = chores.filter((c) => c.isCompleted).length;
			const total = chores.length;
			return {
				date,
				displayDate: formatDisplayDate(date),
				completed,
				total,
				percentage: total > 0 ? Math.round((completed / total) * 100) : 0
			};
		});
	});
</script>

<AdminNav />

<div class="page">
	<main class="container">
		<h1 class="title">History</h1>
		<p class="subtitle">Last 7 days of chore activity</p>

		{#if history.isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading history...</p>
			</div>
		{:else if days.length === 0}
			<div class="empty-state">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					class="empty-icon"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
				<p class="empty-text">No chore activity in the past 7 days</p>
			</div>
		{:else}
			<ul class="day-list">
				{#each days as day (day.date)}
					<li>
						<a href={resolve(`/history/${day.date}`)} class="day-card">
							<div class="day-info">
								<span class="day-name">{day.displayDate}</span>
								<span class="day-stats">{day.completed} of {day.total} completed</span>
							</div>
							<div class="day-right">
								<div class="progress-ring" style="--progress: {day.percentage}">
									<span class="progress-text">{day.percentage}%</span>
								</div>
								<svg
									class="chevron"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<polyline points="9 18 15 12 9 6"></polyline>
								</svg>
							</div>
						</a>
					</li>
				{/each}
			</ul>
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
	}

	.title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
		margin: 0 0 0.25rem 0;
	}

	.subtitle {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0 0 1.5rem 0;
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

	.day-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.day-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: white;
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		text-decoration: none;
		transition:
			box-shadow 0.15s,
			transform 0.15s;
	}

	.day-card:hover {
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.day-card:active {
		transform: scale(0.99);
	}

	.day-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.day-name {
		font-size: 1rem;
		font-weight: 600;
		color: #111827;
	}

	.day-stats {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.day-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.progress-ring {
		position: relative;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: conic-gradient(
			#22c55e calc(var(--progress) * 1%),
			#e5e7eb calc(var(--progress) * 1%)
		);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.progress-ring::before {
		content: '';
		position: absolute;
		width: 2.25rem;
		height: 2.25rem;
		background: white;
		border-radius: 50%;
	}

	.progress-text {
		position: relative;
		font-size: 0.75rem;
		font-weight: 600;
		color: #374151;
	}

	.chevron {
		width: 1.25rem;
		height: 1.25rem;
		color: #9ca3af;
	}
</style>
