<script lang="ts">
	import { useQuery, useConvexClient } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api';
	import { adminAuth } from '$lib/auth/admin.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { masterChoreStore, type MasterChore } from '$lib/stores/masterChores.svelte';
	import { browser } from '$app/environment';

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
	let formTimeSlot = $state<TimeSlot>('morning');
	let formCategory = $state('');
	let formRequiresPhoto = $state(false);
	let isSubmitting = $state(false);
	let formError = $state<string | null>(null);

	// Edit state
	let editingChore = $state<MasterChore | null>(null);
	let editText = $state('');
	let editTimeSlot = $state<TimeSlot>('morning');
	let editCategory = $state('');
	let editRequiresPhoto = $state(false);

	// Category suggestions
	const categorySuggestions = ['Chickens', 'Goats', 'Pigs', 'Garden', 'General'];

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		if (!formText.trim() || !formCategory.trim() || isSubmitting || !client) return;

		isSubmitting = true;
		formError = null;

		try {
			await client.mutation(api.masterChores.create, {
				text: formText.trim(),
				timeSlot: formTimeSlot,
				animalCategory: formCategory.trim(),
				requiresPhoto: formRequiresPhoto
			});
			// Clear form
			formText = '';
			formCategory = '';
			formTimeSlot = 'morning';
			formRequiresPhoto = false;
		} catch (error) {
			formError = error instanceof Error ? error.message : 'Failed to create chore';
		} finally {
			isSubmitting = false;
		}
	}

	function startEdit(chore: MasterChore) {
		editingChore = chore;
		editText = chore.text;
		editTimeSlot = chore.timeSlot as TimeSlot;
		editCategory = chore.animalCategory;
		editRequiresPhoto = chore.requiresPhoto ?? false;
	}

	function cancelEdit() {
		editingChore = null;
		editText = '';
		editTimeSlot = 'morning';
		editCategory = '';
		editRequiresPhoto = false;
	}

	async function handleUpdate(e: SubmitEvent) {
		e.preventDefault();
		if (!editingChore || !editText.trim() || !editCategory.trim() || isSubmitting || !client) return;

		isSubmitting = true;
		formError = null;

		try {
			await client.mutation(api.masterChores.update, {
				id: editingChore._id,
				text: editText.trim(),
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

	function handleSignOut() {
		adminAuth.signOut();
		goto(resolve('/admin/login'));
	}

	function formatTimeSlot(slot: string): string {
		const labels: Record<string, string> = {
			morning: 'Morning',
			afternoon: 'Afternoon',
			evening: 'Evening'
		};
		return labels[slot] || slot;
	}
</script>

<svelte:head>
	<title>Master Chores - Kitchen Sink Farm Admin</title>
</svelte:head>

<div class="page">
	<!-- Header -->
	<header class="header">
		<div class="header-content">
			<h1>Master Chore List</h1>
			<div class="header-actions">
				<a href={resolve('/admin/keys')} class="nav-link">Access Keys</a>
				<button onclick={handleSignOut} class="sign-out-btn">Sign Out</button>
			</div>
		</div>
	</header>

	<main class="main">
		<!-- Add Chore Form -->
		<section class="card">
			<h2 class="card-title">Add New Chore</h2>
			<form onsubmit={handleCreate} class="form">
				<div class="form-row">
					<div class="form-group form-group-large">
						<label for="chore-text">Chore description</label>
						<input
							id="chore-text"
							type="text"
							bind:value={formText}
							placeholder="e.g., Collect eggs from coop"
							required
						/>
					</div>
				</div>

				<div class="form-row">
					<div class="form-group">
						<label for="time-slot">Time of day</label>
						<select id="time-slot" bind:value={formTimeSlot}>
							<option value="morning">Morning</option>
							<option value="afternoon">Afternoon</option>
							<option value="evening">Evening</option>
						</select>
					</div>

					<div class="form-group">
						<label for="category">Animal/Area</label>
						<input
							id="category"
							type="text"
							bind:value={formCategory}
							placeholder="e.g., Chickens"
							list="category-suggestions"
							required
						/>
						<datalist id="category-suggestions">
							{#each categorySuggestions as suggestion}
								<option value={suggestion}></option>
							{/each}
						</datalist>
					</div>

					<div class="form-group form-group-checkbox">
						<label class="checkbox-label">
							<input
								type="checkbox"
								bind:checked={formRequiresPhoto}
							/>
							<span>Requires Photo</span>
						</label>
					</div>

					<div class="form-group form-group-button">
						<button type="submit" class="btn btn-primary" disabled={isSubmitting || !formText.trim() || !formCategory.trim()}>
							{isSubmitting ? 'Adding...' : 'Add Chore'}
						</button>
					</div>
				</div>

				{#if formError}
					<p class="error-message">{formError}</p>
				{/if}
			</form>
		</section>

		<!-- Edit Modal -->
		{#if editingChore}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="modal-overlay" onclick={cancelEdit} role="presentation">
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_interactive_supports_focus -->
				<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="edit-title" aria-modal="true">
					<h2 id="edit-title" class="modal-title">Edit Chore</h2>
					<form onsubmit={handleUpdate} class="form">
						<div class="form-group">
							<label for="edit-text">Chore description</label>
							<input
								id="edit-text"
								type="text"
								bind:value={editText}
								required
							/>
						</div>

						<div class="form-group">
							<label for="edit-time-slot">Time of day</label>
							<select id="edit-time-slot" bind:value={editTimeSlot}>
								<option value="morning">Morning</option>
								<option value="afternoon">Afternoon</option>
								<option value="evening">Evening</option>
							</select>
						</div>

						<div class="form-group">
							<label for="edit-category">Animal/Area</label>
							<input
								id="edit-category"
								type="text"
								bind:value={editCategory}
								list="edit-category-suggestions"
								required
							/>
							<datalist id="edit-category-suggestions">
								{#each categorySuggestions as suggestion}
									<option value={suggestion}></option>
								{/each}
							</datalist>
						</div>

						<div class="form-group form-group-checkbox">
							<label class="checkbox-label">
								<input
									type="checkbox"
									bind:checked={editRequiresPhoto}
								/>
								<span>Requires Photo</span>
							</label>
						</div>

						<div class="modal-actions">
							<button type="button" class="btn btn-secondary" onclick={cancelEdit}>
								Cancel
							</button>
							<button type="submit" class="btn btn-primary" disabled={isSubmitting || !editText.trim() || !editCategory.trim()}>
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
					<p>No chores yet. Add your first chore above to get started.</p>
				</div>
			{:else}
				{#each masterChoreStore.grouped as group}
					<div class="time-slot-group">
						<h3 class="time-slot-header">{group.label}</h3>
						<ul class="chore-list">
							{#each group.chores as chore (chore._id)}
								<li class="chore-item">
									<div class="chore-info">
										<div class="chore-text-row">
											<span class="chore-text">{chore.text}</span>
											{#if chore.requiresPhoto}
												<span class="photo-badge" title="Requires photo">
													<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
														<circle cx="12" cy="13" r="4"></circle>
													</svg>
												</span>
											{/if}
										</div>
										<span class="chore-category">{chore.animalCategory}</span>
									</div>
									<div class="chore-actions">
										<button
											class="btn-icon"
											onclick={() => startEdit(chore)}
											aria-label="Edit chore"
										>
											<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
												<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
											</svg>
										</button>
										<button
											class="btn-icon btn-danger"
											onclick={() => handleDelete(chore._id, chore.text)}
											aria-label="Delete chore"
										>
											<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<polyline points="3 6 5 6 21 6"></polyline>
												<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
											</svg>
										</button>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			{/if}
		</section>

		<!-- Back to App -->
		<div class="back-link">
			<a href={resolve('/')}>Back to app</a>
		</div>
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		background-color: #f9fafb;
	}

	.header {
		background-color: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.header-content {
		max-width: 56rem;
		margin: 0 auto;
		padding: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header h1 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
		margin: 0;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.nav-link {
		font-size: 0.875rem;
		color: #2563eb;
		text-decoration: none;
	}

	.nav-link:hover {
		text-decoration: underline;
	}

	.sign-out-btn {
		font-size: 0.875rem;
		color: #6b7280;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.sign-out-btn:hover {
		color: #111827;
	}

	.main {
		max-width: 56rem;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.card {
		background-color: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.card-title {
		font-size: 1.125rem;
		font-weight: 500;
		color: #111827;
		margin: 0 0 1rem 0;
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

	.form-group-large {
		flex: 2;
		min-width: 250px;
	}

	.form-group-button {
		flex: 0;
		min-width: auto;
		justify-content: flex-end;
		align-self: flex-end;
	}

	.form-group-checkbox {
		flex: 0;
		min-width: auto;
		justify-content: center;
		align-self: center;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.checkbox-label input[type="checkbox"] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input,
	.form-group select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 1rem;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
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
		background-color: #2563eb;
		color: white;
		border: none;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #1d4ed8;
	}

	.btn-primary:disabled {
		background-color: #93c5fd;
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
		margin-top: 1.5rem;
	}

	.time-slot-group {
		background-color: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		margin-bottom: 1rem;
		overflow: hidden;
	}

	.time-slot-header {
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
		padding: 0.75rem 1rem;
		background-color: #f3f4f6;
		margin: 0;
		border-bottom: 1px solid #e5e7eb;
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

	.photo-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.125rem 0.25rem;
		background-color: #dbeafe;
		color: #2563eb;
		border-radius: 0.25rem;
	}

	.chore-category {
		font-size: 0.75rem;
		color: #6b7280;
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

	.back-link a {
		font-size: 0.875rem;
		color: #6b7280;
		text-decoration: none;
	}

	.back-link a:hover {
		color: #111827;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.form-row {
			flex-direction: column;
		}

		.form-group {
			min-width: 100%;
		}

		.form-group-button {
			min-width: 100%;
		}

		.form-group-button .btn {
			width: 100%;
		}

		.header-content {
			flex-direction: column;
			gap: 0.75rem;
			align-items: flex-start;
		}
	}
</style>
