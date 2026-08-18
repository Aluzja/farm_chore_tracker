<script lang="ts">
	import Dropdown from '$lib/components/Dropdown.svelte';
	import type { FeedItem } from '$lib/db/schema';

	interface Props {
		items: FeedItem[];
		feedOptions: string[]; // Feed names from the db catalog
	}

	let { items = $bindable(), feedOptions }: Props = $props();

	const UNITS = ['lb', 'hand', 'scoop', 'cup'];

	const dropdownOptions = $derived(feedOptions.map((name) => ({ value: name, label: name })));

	function addRow() {
		items = [...items, { feed: '', amount: 1, unit: 'lb' }];
	}

	function removeRow(index: number) {
		items = items.filter((_, i) => i !== index);
	}
</script>

<div class="feed-editor">
	{#each items as item, index (index)}
		<div class="feed-row">
			<Dropdown
				bind:value={item.feed}
				options={dropdownOptions}
				placeholder="Feed type..."
				allowCustom={true}
			/>
			<input
				class="amount-input"
				type="number"
				inputmode="decimal"
				min="0"
				step="0.25"
				bind:value={item.amount}
				aria-label="Amount"
			/>
			<select class="unit-select" bind:value={item.unit} aria-label="Unit">
				{#each UNITS as unit (unit)}
					<option value={unit}>{unit}</option>
				{/each}
			</select>
			<button
				type="button"
				class="remove-btn"
				onclick={() => removeRow(index)}
				aria-label="Remove feed"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>
	{/each}
	<button type="button" class="add-btn" onclick={addRow}> + Add feed </button>
</div>

<style>
	.feed-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.feed-row {
		display: grid;
		grid-template-columns: 1fr 4.25rem 4.5rem 2rem;
		gap: 0.5rem;
		align-items: center;
	}

	.amount-input,
	.unit-select {
		padding: 0.625rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		background-color: white;
		color: #111827;
		width: 100%;
	}

	.amount-input:focus,
	.unit-select:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
	}

	.remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		background: none;
		border: none;
		border-radius: 0.375rem;
		color: #9ca3af;
		cursor: pointer;
	}

	.remove-btn:hover {
		background-color: #fef2f2;
		color: #dc2626;
	}

	.remove-btn svg {
		width: 1rem;
		height: 1rem;
	}

	.add-btn {
		padding: 0.5rem 0.75rem;
		background: none;
		border: 1.5px dashed #d1d5db;
		border-radius: 0.5rem;
		color: #16a34a;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background-color 0.15s;
	}

	.add-btn:hover {
		border-color: #86efac;
		background-color: #f0fdf4;
	}
</style>
