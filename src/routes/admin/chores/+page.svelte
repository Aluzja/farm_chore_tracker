<script lang="ts">
	import { useQuery, useConvexClient } from 'convex-svelte';
	import { slide } from 'svelte/transition';
	import { api } from '../../../convex/_generated/api';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { masterChoreStore, type MasterChore } from '$lib/stores/masterChores.svelte';
	import { browser } from '$app/environment';
	import { getTodayDateString } from '$lib/utils/date';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	// Get Convex client for mutations
	const client = browser ? useConvexClient() : null;

	// Query for listing master chores
	const masterChoresQuery = browser ? useQuery(api.masterChores.list, {}) : null;

	// Hydrate store when query data changes
	$effect(() => {
		if (masterChoresQuery?.data) {
			masterChoreStore.hydrateFromServer(masterChoresQuery.data as MasterChore[]);
		}
	});

	// Form state
	type TimeSlot = 'morning' | 'afternoon' | 'evening';
	let formText = $state('');
	let formDescription = $state('');
	let formTimeSlot = $state<TimeSlot>('morning');
	let formCategory = $state('');
	let formRequiresPhoto = $state(false);
	let formTodayOnly = $state(false);
	let isSubmitting = $state(false);
	let formError = $state<string | null>(null);

	// Add modal state
	let showAddModal = $state(false);

	// Edit state
	let editingChore = $state<MasterChore | null>(null);
	let editText = $state('');
	let editDescription = $state('');
	let editTimeSlot = $state<TimeSlot>('morning');
	let editCategory = $state('');
	let editRequiresPhoto = $state(false);

	// Collapsed state for time slot panels - persisted to localStorage
	const STORAGE_KEY = 'ksf-collapsed-master';

	function loadCollapsedSlots(): Set<string> {
		if (!browser) return new Set();
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) return new SvelteSet(JSON.parse(saved));
		} catch {}
		return new SvelteSet();
	}

	function saveCollapsedSlots(slots: Set<string>) {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...slots]));
		} catch {}
	}

	let collapsedSlots = $state<Set<string>>(loadCollapsedSlots());

	function toggleSlotCollapse(timeSlot: string) {
		if (collapsedSlots.has(timeSlot)) {
			collapsedSlots.delete(timeSlot);
		} else {
			collapsedSlots.add(timeSlot);
		}
		collapsedSlots = new SvelteSet(collapsedSlots);
		saveCollapsedSlots(collapsedSlots);
	}

	function isSlotCollapsed(timeSlot: string): boolean {
		return collapsedSlots.has(timeSlot);
	}

	function openAddModal() {
		showAddModal = true;
	}

	function closeAddModal() {
		showAddModal = false;
		// Reset form
		formText = '';
		formDescription = '';
		formCategory = '';
		formTimeSlot = 'morning';
		formRequiresPhoto = false;
		formTodayOnly = false;
		formError = null;
	}

	// Dropdown options
	const timeSlotOptions = [
		{ value: 'morning', label: 'Morning' },
		{ value: 'afternoon', label: 'Afternoon' },
		{ value: 'evening', label: 'Evening' }
	];

	const categoryOptions = [
		{ value: 'General', label: 'General' },
		{ value: 'Sheep', label: 'Sheep' },
		{ value: 'Chickens', label: 'Chickens' },
		{ value: 'Ducks', label: 'Ducks' },
		{ value: 'Geese', label: 'Geese' },
		{ value: 'Cats', label: 'Cats' },
		{ value: 'Garden', label: 'Garden' }
	];

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		if (!formText.trim() || !formCategory.trim() || isSubmitting || !client) return;

		isSubmitting = true;
		formError = null;

		try {
			if (formTodayOnly) {
				// Add as ad-hoc chore for today only
				await client.mutation(api.dailyChores.addAdHocAdmin, {
					text: formText.trim(),
					description: formDescription.trim() || undefined,
					timeSlot: formTimeSlot,
					animalCategory: formCategory.trim(),
					date: getTodayDateString(),
					requiresPhoto: formRequiresPhoto
				});
			} else {
				// Add to master chore list
				await client.mutation(api.masterChores.create, {
					text: formText.trim(),
					description: formDescription.trim() || undefined,
					timeSlot: formTimeSlot,
					animalCategory: formCategory.trim(),
					requiresPhoto: formRequiresPhoto
				});
			}
			// Close modal and reset form
			closeAddModal();
		} catch (error) {
			formError = error instanceof Error ? error.message : 'Failed to create chore';
		} finally {
			isSubmitting = false;
		}
	}

	function startEdit(chore: MasterChore) {
		editingChore = chore;
		editText = chore.text;
		editDescription = chore.description ?? '';
		editTimeSlot = chore.timeSlot as TimeSlot;
		editCategory = chore.animalCategory;
		editRequiresPhoto = chore.requiresPhoto ?? false;
	}

	function cancelEdit() {
		editingChore = null;
		editText = '';
		editDescription = '';
		editTimeSlot = 'morning';
		editCategory = '';
		editRequiresPhoto = false;
	}

	async function handleUpdate(e: SubmitEvent) {
		e.preventDefault();
		if (!editingChore || !editText.trim() || !editCategory.trim() || isSubmitting || !client)
			return;

		isSubmitting = true;
		formError = null;

		try {
			await client.mutation(api.masterChores.update, {
				id: editingChore._id,
				text: editText.trim(),
				description: editDescription.trim() || undefined,
				timeSlot: editTimeSlot,
				animalCategory: editCategory.trim(),
				requiresPhoto: editRequiresPhoto
			});
			cancelEdit();
		} catch (error) {
			formError = error instanceof Error ? error.message : 'Failed to update chore';
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete(id: Id<'masterChores'>, text: string) {
		if (!confirm(`Delete chore "${text}"? This will remove it from future daily lists.`)) return;
		if (!client) return;

		try {
			await client.mutation(api.masterChores.remove, { id });
		} catch (error) {
			console.error('Failed to delete chore:', error);
			alert('Failed to delete chore');
		}
	}
</script>

<svelte:head>
	<title>Master Chores - Kitchen Sink Farm Admin</title>
</svelte:head>

<div class="page">
	<main class="main">
		<!-- Page Header with Add Button -->
		<div class="page-header">
			<h1 class="page-title">Master Chores</h1>
			<button class="btn btn-primary btn-add" onclick={openAddModal}>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				Add Chore
			</button>
		</div>

		<!-- Add Chore Modal -->
		{#if showAddModal}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="modal-overlay" onclick={closeAddModal} role="presentation">
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<div
					class="modal"
					onclick={(e) => e.stopPropagation()}
					role="dialog"
					aria-labelledby="add-title"
					aria-modal="true"
				>
					<h2 id="add-title" class="modal-title">Add New Chore</h2>
					<form onsubmit={handleCreate} class="form">
						<div class="form-group">
							<label for="chore-text">Chore name</label>
							<input
								id="chore-text"
								type="text"
								bind:value={formText}
								placeholder="e.g., Chicken Food"
								required
							/>
						</div>

						<div class="form-group">
							<label for="chore-description">Details (optional)</label>
							<input
								id="chore-description"
								type="text"
								bind:value={formDescription}
								placeholder="e.g., 2 scoops of feed per coop"
							/>
						</div>

						<div class="form-group">
							<label for="time-slot">Time of day</label>
							<Dropdown
								id="time-slot"
								bind:value={formTimeSlot}
								options={timeSlotOptions}
								placeholder="Select time..."
							/>
						</div>

						<div class="form-group">
							<label for="category">Animal/Area</label>
							<Dropdown
								id="category"
								bind:value={formCategory}
								options={categoryOptions}
								placeholder="e.g., Chickens"
								allowCustom={true}
								required={true}
							/>
						</div>

						<div class="toggle-row">
							<label class="photo-toggle">
								<span class="toggle-track" class:active={formRequiresPhoto}>
									<span class="toggle-thumb"></span>
								</span>
								<input type="checkbox" bind:checked={formRequiresPhoto} class="sr-only" />
								<span class="toggle-label">
									<svg
										class="toggle-icon"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
										></path>
										<circle cx="12" cy="13" r="4"></circle>
									</svg>
									Require photo
								</span>
							</label>

							<label class="photo-toggle today-only-toggle" class:active={formTodayOnly}>
								<span class="toggle-track" class:active={formTodayOnly}>
									<span class="toggle-thumb"></span>
								</span>
								<input type="checkbox" bind:checked={formTodayOnly} class="sr-only" />
								<span class="toggle-label">
									<svg
										class="toggle-icon"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
										<line x1="16" y1="2" x2="16" y2="6"></line>
										<line x1="8" y1="2" x2="8" y2="6"></line>
										<line x1="3" y1="10" x2="21" y2="10"></line>
									</svg>
									Today only
								</span>
							</label>
						</div>

						{#if formError}
							<p class="error-message">{formError}</p>
						{/if}

						<div class="modal-actions">
							<button type="button" class="btn btn-secondary" onclick={closeAddModal}>
								Cancel
							</button>
							<button
								type="submit"
								class="btn btn-primary"
								disabled={isSubmitting || !formText.trim() || !formCategory.trim()}
							>
								{isSubmitting ? 'Adding...' : formTodayOnly ? 'Add to Today' : 'Add Chore'}
							</button>
						</div>
					</form>
				</div>
			</div>
		{/if}

		<!-- Edit Modal -->
		{#if editingChore}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="modal-overlay" onclick={cancelEdit} role="presentation">
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<div
					class="modal"
					onclick={(e) => e.stopPropagation()}
					role="dialog"
					aria-labelledby="edit-title"
					aria-modal="true"
				>
					<h2 id="edit-title" class="modal-title">Edit Chore</h2>
					<form onsubmit={handleUpdate} class="form">
						<div class="form-group">
							<label for="edit-text">Chore name</label>
							<input id="edit-text" type="text" bind:value={editText} required />
						</div>

						<div class="form-group">
							<label for="edit-description">Details (optional)</label>
							<input
								id="edit-description"
								type="text"
								bind:value={editDescription}
								placeholder="e.g., 2 scoops of feed per coop"
							/>
						</div>

						<div class="form-group">
							<label for="edit-time-slot">Time of day</label>
							<Dropdown
								id="edit-time-slot"
								bind:value={editTimeSlot}
								options={timeSlotOptions}
								placeholder="Select time..."
							/>
						</div>

						<div class="form-group">
							<label for="edit-category">Animal/Area</label>
							<Dropdown
								id="edit-category"
								bind:value={editCategory}
								options={categoryOptions}
								placeholder="e.g., Chickens"
								allowCustom={true}
								required={true}
							/>
						</div>

						<label class="photo-toggle">
							<span class="toggle-track" class:active={editRequiresPhoto}>
								<span class="toggle-thumb"></span>
							</span>
							<input type="checkbox" bind:checked={editRequiresPhoto} class="sr-only" />
							<span class="toggle-label">
								<svg
									class="toggle-icon"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
									></path>
									<circle cx="12" cy="13" r="4"></circle>
								</svg>
								Require photo for completion
							</span>
						</label>

						<div class="modal-actions">
							<button type="button" class="btn btn-secondary" onclick={cancelEdit}> Cancel </button>
							<button
								type="submit"
								class="btn btn-primary"
								disabled={isSubmitting || !editText.trim() || !editCategory.trim()}
							>
								{isSubmitting ? 'Saving...' : 'Save Changes'}
							</button>
						</div>
					</form>
				</div>
			</div>
		{/if}

		<!-- Chores List Grouped by Time Slot -->
		<section class="chores-section">
			{#if masterChoresQuery?.isLoading}
				<div class="loading">Loading chores...</div>
			{:else if masterChoresQuery?.error}
				<div class="error">Failed to load chores</div>
			{:else if masterChoreStore.grouped.length === 0}
				<div class="empty-state">
					<p>No chores yet. Click "Add Chore" to get started.</p>
				</div>
			{:else}
				{#each masterChoreStore.grouped as group (group.timeSlot)}
					{@const isCollapsed = isSlotCollapsed(group.timeSlot)}
					<div class="time-slot-group" class:collapsed={isCollapsed}>
						<button
							class="time-slot-header time-slot-{group.timeSlot}"
							onclick={() => toggleSlotCollapse(group.timeSlot)}
							aria-expanded={!isCollapsed}
						>
							<span class="time-slot-title">{group.label}</span>
							<span class="time-slot-count"
								>{group.totalChores} chore{group.totalChores !== 1 ? 's' : ''}</span
							>
							<svg
								class="chevron"
								class:rotated={isCollapsed}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<polyline points="6 9 12 15 18 9"></polyline>
							</svg>
						</button>

						{#if !isCollapsed}
							<div class="time-slot-content" transition:slide={{ duration: 200 }}>
								{#each group.categories as category, categoryIndex (category.name)}
									<div class="category-group category-color-{categoryIndex % 6}">
										<h4 class="category-header">{category.name}</h4>
										<ul class="chore-list">
											{#each category.chores as chore (chore._id)}
												<li class="chore-item">
													<div class="chore-info">
														<div class="chore-text-row">
															<span class="chore-text">{chore.text}</span>
															{#if chore.requiresPhoto}
																<span class="photo-badge" title="Requires photo">
																	<svg
																		xmlns="http://www.w3.org/2000/svg"
																		width="14"
																		height="14"
																		viewBox="0 0 24 24"
																		fill="none"
																		stroke="currentColor"
																		stroke-width="2"
																		stroke-linecap="round"
																		stroke-linejoin="round"
																	>
																		<path
																			d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
																		></path>
																		<circle cx="12" cy="13" r="4"></circle>
																	</svg>
																</span>
															{/if}
														</div>
														{#if chore.description}
															<span class="chore-description">{chore.description}</span>
														{/if}
													</div>
													<div class="chore-actions">
														<button
															class="btn-icon"
															onclick={() => startEdit(chore)}
															aria-label="Edit chore"
														>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																width="18"
																height="18"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
																stroke-linecap="round"
																stroke-linejoin="round"
															>
																<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
																></path>
																<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
																></path>
															</svg>
														</button>
														<button
															class="btn-icon btn-danger"
															onclick={() => handleDelete(chore._id, chore.text)}
															aria-label="Delete chore"
														>
															<svg
																xmlns="http://www.w3.org/2000/svg"
																width="18"
																height="18"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
																stroke-linecap="round"
																stroke-linejoin="round"
															>
																<polyline points="3 6 5 6 21 6"></polyline>
																<path
																	d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
																></path>
															</svg>
														</button>
													</div>
												</li>
											{/each}
										</ul>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</section>
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
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
		margin: 0;
	}

	.btn-add {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
	}

	.btn-add svg {
		width: 1.125rem;
		height: 1.125rem;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-row {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 150px;
		flex: 1;
	}

	.toggle-row {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.photo-toggle {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		padding: 0.75rem;
		margin-top: 0.5rem;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		transition:
			border-color 0.15s,
			background-color 0.15s;
	}

	.photo-toggle:hover {
		border-color: #d1d5db;
		background: #f3f4f6;
	}

	.photo-toggle:has(input:checked) {
		border-color: #22c55e;
		background: #f0fdf4;
	}

	.today-only-toggle:has(input:checked) {
		border-color: #f59e0b;
		background: #fffbeb;
	}

	.today-only-toggle:has(input:checked) .toggle-track.active {
		background: #f59e0b;
	}

	.today-only-toggle:has(input:checked) .toggle-icon {
		color: #f59e0b;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.toggle-track {
		position: relative;
		width: 2.75rem;
		height: 1.5rem;
		background: #d1d5db;
		border-radius: 9999px;
		transition: background-color 0.2s;
		flex-shrink: 0;
	}

	.toggle-track.active {
		background: #22c55e;
	}

	.toggle-thumb {
		position: absolute;
		top: 0.125rem;
		left: 0.125rem;
		width: 1.25rem;
		height: 1.25rem;
		background: white;
		border-radius: 50%;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 0.2s;
	}

	.toggle-track.active .toggle-thumb {
		transform: translateX(1.25rem);
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.toggle-icon {
		width: 1.125rem;
		height: 1.125rem;
		color: #6b7280;
	}

	.photo-toggle:has(input:checked) .toggle-icon {
		color: #22c55e;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input {
		padding: 0.625rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		background-color: white;
		color: #111827;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.form-group input:hover {
		border-color: #9ca3af;
	}

	.form-group input:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.btn-primary {
		background-color: #22c55e;
		color: white;
		border: none;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #16a34a;
	}

	.btn-primary:disabled {
		background-color: #86efac;
		cursor: not-allowed;
	}

	.btn-secondary {
		background-color: white;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.btn-secondary:hover {
		background-color: #f9fafb;
	}

	.error-message {
		color: #dc2626;
		font-size: 0.875rem;
		margin: 0;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 50;
	}

	.modal {
		background-color: white;
		border-radius: 0.5rem;
		padding: 1.5rem;
		width: 100%;
		max-width: 28rem;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
		margin: 0 0 1rem 0;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	/* Chores Section */
	.chores-section {
		margin-top: 0;
	}

	.time-slot-group {
		background-color: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		margin-bottom: 1rem;
		overflow: hidden;
	}

	.time-slot-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		font-size: 1rem;
		font-weight: 600;
		color: white;
		padding: 0.75rem 1rem;
		margin: 0;
		border: none;
		cursor: pointer;
		text-align: left;
		-webkit-tap-highlight-color: transparent;
	}

	.time-slot-header:active {
		filter: brightness(0.95);
	}

	.time-slot-title {
		flex: 1;
	}

	.time-slot-count {
		font-size: 0.875rem;
		font-weight: 500;
		opacity: 0.9;
	}

	.chevron {
		width: 1.25rem;
		height: 1.25rem;
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.chevron.rotated {
		transform: rotate(-90deg);
	}

	.time-slot-morning {
		background-color: #f59e0b;
	}

	.time-slot-afternoon {
		background-color: #3b82f6;
	}

	.time-slot-evening {
		background-color: #8b5cf6;
	}

	.time-slot-group.collapsed {
		border-radius: 0.5rem;
	}

	.time-slot-content {
		overflow: hidden;
	}

	.category-group {
		border-bottom: 1px solid #e5e7eb;
	}

	.category-group:last-child {
		border-bottom: none;
	}

	.category-header {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		padding: 0.5rem 1rem;
		margin: 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
	}

	/* Category color highlights - very faint backgrounds */
	.category-color-0 {
		background-color: rgba(239, 68, 68, 0.04);
	}
	.category-color-0 .category-header {
		background-color: rgba(239, 68, 68, 0.08);
		color: #b91c1c;
	}

	.category-color-1 {
		background-color: rgba(34, 197, 94, 0.04);
	}
	.category-color-1 .category-header {
		background-color: rgba(34, 197, 94, 0.08);
		color: #15803d;
	}

	.category-color-2 {
		background-color: rgba(59, 130, 246, 0.04);
	}
	.category-color-2 .category-header {
		background-color: rgba(59, 130, 246, 0.08);
		color: #1d4ed8;
	}

	.category-color-3 {
		background-color: rgba(168, 85, 247, 0.04);
	}
	.category-color-3 .category-header {
		background-color: rgba(168, 85, 247, 0.08);
		color: #7c3aed;
	}

	.category-color-4 {
		background-color: rgba(245, 158, 11, 0.04);
	}
	.category-color-4 .category-header {
		background-color: rgba(245, 158, 11, 0.08);
		color: #b45309;
	}

	.category-color-5 {
		background-color: rgba(20, 184, 166, 0.04);
	}
	.category-color-5 .category-header {
		background-color: rgba(20, 184, 166, 0.08);
		color: #0f766e;
	}

	.chore-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.chore-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.chore-item:last-child {
		border-bottom: none;
	}

	.chore-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.chore-text-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.chore-text {
		font-size: 0.9375rem;
		color: #111827;
	}

	.chore-description {
		font-size: 0.8125rem;
		color: #6b7280;
		font-style: italic;
	}

	.photo-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.125rem 0.25rem;
		background-color: #dcfce7;
		color: #22c55e;
		border-radius: 0.25rem;
	}

	.chore-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-icon {
		padding: 0.375rem;
		background: none;
		border: none;
		cursor: pointer;
		color: #6b7280;
		border-radius: 0.25rem;
	}

	.btn-icon:hover {
		background-color: #f3f4f6;
		color: #111827;
	}

	.btn-danger:hover {
		background-color: #fef2f2;
		color: #dc2626;
	}

	/* Empty and Loading States */
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

	.empty-state p {
		margin: 0;
	}

	.back-link {
		margin-top: 1.5rem;
		text-align: center;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.form-row {
			flex-direction: column;
		}

		.form-group {
			min-width: 100%;
		}
	}
</style>
