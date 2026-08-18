<script lang="ts">
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api';
	import { browser } from '$app/environment';
	import type { MasterChore } from '$lib/stores/masterChores.svelte';

	const masterChoresQuery = browser ? useQuery(api.masterChores.list, {}) : null;

	// Bag sizes are hardcoded defaults here but editable per feed in the table
	const DEFAULT_BAG_LB = 44;
	const CUBE_BAG_LB = 50;

	let days = $state(7);
	let bagSizeOverrides = $state<Record<string, number>>({});

	function defaultBagSize(feed: string): number {
		return feed.toLowerCase().includes('cube') ? CUBE_BAG_LB : DEFAULT_BAG_LB;
	}

	function bagSize(feed: string): number {
		return bagSizeOverrides[feed] ?? defaultBagSize(feed);
	}

	interface FeedRow {
		feed: string;
		lbPerDay: number;
		otherUnits: { unit: string; amount: number }[]; // hands, scoops, cups - no lb conversion
	}

	// Sum feedItems across all active master chores (all time slots = one day)
	const rows = $derived.by(() => {
		const chores = (masterChoresQuery?.data ?? []) as MasterChore[];
		const byFeed = new Map<string, Map<string, number>>();

		for (const chore of chores) {
			if (!chore.isActive) continue;
			for (const item of chore.feedItems ?? []) {
				let units = byFeed.get(item.feed);
				if (!units) {
					units = new Map();
					byFeed.set(item.feed, units);
				}
				units.set(item.unit, (units.get(item.unit) ?? 0) + item.amount);
			}
		}

		const result: FeedRow[] = Array.from(byFeed.entries()).map(([feed, units]) => ({
			feed,
			lbPerDay: units.get('lb') ?? 0,
			otherUnits: Array.from(units.entries())
				.filter(([unit]) => unit !== 'lb')
				.map(([unit, amount]) => ({ unit, amount }))
		}));

		// Heaviest users first
		return result.sort((a, b) => b.lbPerDay - a.lbPerDay || a.feed.localeCompare(b.feed));
	});

	const totalLbPerDay = $derived(rows.reduce((sum, r) => sum + r.lbPerDay, 0));
	const totalBags = $derived(
		rows.reduce(
			(sum, r) =>
				r.lbPerDay > 0 ? sum + Math.ceil((r.lbPerDay * Math.max(days, 0)) / bagSize(r.feed)) : sum,
			0
		)
	);

	function fmt(n: number): string {
		return Number(n.toFixed(2)).toString();
	}

	function fmtUnits(row: FeedRow, multiplier: number): string {
		const parts: string[] = [];
		if (row.lbPerDay > 0) parts.push(`${fmt(row.lbPerDay * multiplier)} lb`);
		for (const other of row.otherUnits) {
			parts.push(`${fmt(other.amount * multiplier)} ${other.unit}`);
		}
		return parts.join(' + ');
	}

	function setBagSize(feed: string, value: string) {
		const parsed = Number(value);
		if (parsed > 0) {
			bagSizeOverrides = { ...bagSizeOverrides, [feed]: parsed };
		}
	}
</script>

<svelte:head>
	<title>Daily Total - Kitchen Sink Farm Admin</title>
</svelte:head>

<div class="page">
	<main class="main">
		<div class="page-header">
			<h1 class="page-title">Daily Feed Total</h1>
			<label class="days-control">
				Days
				<input class="days-input" type="number" inputmode="numeric" min="1" bind:value={days} />
			</label>
		</div>

		{#if masterChoresQuery?.isLoading}
			<div class="loading">Loading...</div>
		{:else if masterChoresQuery?.error}
			<div class="error">Failed to load chores</div>
		{:else if rows.length === 0}
			<div class="empty-state">
				<p>No chores have feed amounts yet. Add feed to chores on the Chores tab.</p>
			</div>
		{:else}
			<div class="table-card">
				<table>
					<thead>
						<tr>
							<th>Feed</th>
							<th class="num">Per day</th>
							<th class="num">For {days > 0 ? days : 0} day{days === 1 ? '' : 's'}</th>
							<th class="num">Bag (lb)</th>
							<th class="num">Bags</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.feed)}
							{@const spanLb = row.lbPerDay * Math.max(days, 0)}
							{@const bags = row.lbPerDay > 0 ? Math.ceil(spanLb / bagSize(row.feed)) : null}
							<tr>
								<td class="feed-name">{row.feed}</td>
								<td class="num">{fmtUnits(row, 1)}</td>
								<td class="num strong">{fmtUnits(row, Math.max(days, 0))}</td>
								<td class="num">
									{#if row.lbPerDay > 0}
										<input
											class="bag-input"
											type="number"
											inputmode="numeric"
											min="1"
											value={bagSize(row.feed)}
											oninput={(e) => setBagSize(row.feed, e.currentTarget.value)}
											aria-label="Bag size for {row.feed}"
										/>
									{:else}
										—
									{/if}
								</td>
								<td class="num bags">{bags ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td>Total</td>
							<td class="num">{fmt(totalLbPerDay)} lb</td>
							<td class="num strong">{fmt(totalLbPerDay * Math.max(days, 0))} lb</td>
							<td></td>
							<td class="num bags">{totalBags}</td>
						</tr>
					</tfoot>
				</table>
			</div>
			<p class="footnote">
				Per day = every active chore's feed added up (all time slots). Hands/scoops aren't counted
				toward bags. Bag sizes default to {DEFAULT_BAG_LB} lb ({CUBE_BAG_LB} lb for cubes) — tap to adjust.
			</p>
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100%;
		background-color: #f9fafb;
	}

	.main {
		max-width: 56rem;
		width: 100%;
		margin: 0 auto;
		padding: 1.5rem 1rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		gap: 1rem;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
		margin: 0;
	}

	.days-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.days-input {
		width: 4.5rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		background-color: white;
		color: #111827;
	}

	.days-input:focus,
	.bag-input:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
	}

	.table-card {
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}

	th {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		text-align: left;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e5e7eb;
		white-space: nowrap;
	}

	td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f3f4f6;
		color: #111827;
	}

	tbody tr:last-child td {
		border-bottom: 1px solid #e5e7eb;
	}

	.num {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.feed-name {
		font-weight: 500;
	}

	.strong {
		font-weight: 600;
	}

	.bags {
		font-weight: 700;
		color: #16a34a;
	}

	.bag-input {
		width: 3.75rem;
		padding: 0.375rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		text-align: right;
		background-color: white;
		color: #111827;
	}

	tfoot td {
		font-weight: 600;
		border-bottom: none;
		background: #f9fafb;
	}

	.footnote {
		font-size: 0.8125rem;
		color: #6b7280;
		margin-top: 0.75rem;
		line-height: 1.5;
	}

	.loading,
	.error,
	.empty-state {
		text-align: center;
		padding: 2rem;
		color: #6b7280;
	}

	.error {
		color: #dc2626;
	}
</style>
