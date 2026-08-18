<script lang="ts">
	import type { FeedItem } from '$lib/db/schema';

	interface Props {
		items: FeedItem[];
	}

	let { items }: Props = $props();
</script>

{#if items.length > 0}
	<div class="feed-table">
		{#each items as item, index (index)}
			<div class="feed-row">
				<span class="feed-name">{item.feed}</span>
				<span class="feed-amount">{item.amount} {item.unit}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.feed-table {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		width: max-content;
		min-width: 60%;
		max-width: 100%;
		margin-top: 0.375rem;
	}

	.feed-row {
		display: flex;
		justify-content: space-between;
		gap: 1.5rem;
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.feed-name {
		color: #6b7280;
	}

	.feed-amount {
		color: #111827;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
