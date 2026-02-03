<script lang="ts">
	import { useQuery, useConvexClient } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api';
	import { resolve } from '$app/paths';
	import type { Id } from '../../../convex/_generated/dataModel';
	import AdminNav from '$lib/components/AdminNav.svelte';

	// Get Convex client for mutations
	const client = useConvexClient();

	// Query for listing keys
	const keysQuery = useQuery(api.accessKeys.list, {});

	// Form state
	let newKeyName = $state('');
	let isCreating = $state(false);
	let createError = $state<string | null>(null);

	// Created key display (shown after creation)
	let createdKey = $state<string | null>(null);

	// Revoked keys panel state
	let showRevoked = $state(false);

	// Split keys into active and revoked
	const activeKeys = $derived(keysQuery.data?.filter((k) => !k.isRevoked) ?? []);
	const revokedKeys = $derived(keysQuery.data?.filter((k) => k.isRevoked) ?? []);

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		if (!newKeyName.trim() || isCreating) return;

		isCreating = true;
		createError = null;

		try {
			const result = await client.mutation(api.accessKeys.create, {
				displayName: newKeyName.trim()
			});
			createdKey = result.key;
			newKeyName = '';
		} catch (error) {
			createError = error instanceof Error ? error.message : 'Failed to create key';
		} finally {
			isCreating = false;
		}
	}

	async function handleRevoke(id: Id<'accessKeys'>, displayName: string) {
		if (!confirm(`Revoke access key "${displayName}"? This cannot be undone.`)) return;

		try {
			await client.mutation(api.accessKeys.revoke, { id });
		} catch (error) {
			console.error('Failed to revoke key:', error);
			alert('Failed to revoke key');
		}
	}

	function copyKey() {
		if (createdKey) {
			navigator.clipboard.writeText(`${window.location.origin}/?key=${createdKey}`);
		}
	}

	function dismissCreatedKey() {
		createdKey = null;
	}

	// Format date for display
	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Access Keys - Kitchen Sink Farm Admin</title>
</svelte:head>

<div class="page">
	<AdminNav />

	<main class="main">
		<!-- Created Key Banner -->
		{#if createdKey}
			<div class="success-banner">
				<div class="success-content">
					<div class="success-info">
						<h3>Access Key Created!</h3>
						<p>Share this link with the worker. They only need to open it once.</p>
						<div class="key-display">
							<code>{window.location.origin}/?key={createdKey}</code>
							<button onclick={copyKey} class="btn-copy">Copy</button>
						</div>
					</div>
					<button onclick={dismissCreatedKey} class="btn-dismiss" aria-label="Dismiss">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="currentColor"
						>
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>
			</div>
		{/if}

		<!-- Create New Key Form -->
		<div class="card">
			<h2 class="card-title">Create New Access Key</h2>
			<form onsubmit={handleCreate} class="create-form">
				<input
					type="text"
					bind:value={newKeyName}
					placeholder="Display name (e.g., John's Phone)"
					required
					class="form-input"
				/>
				<button type="submit" disabled={isCreating || !newKeyName.trim()} class="btn-primary">
					{isCreating ? 'Creating...' : 'Create Key'}
				</button>
			</form>
			{#if createError}
				<p class="error-message">{createError}</p>
			{/if}
		</div>

		<!-- Active Keys List -->
		<div class="card">
			<div class="card-header">
				<h2 class="card-title">Active Keys</h2>
			</div>

			{#if keysQuery.isLoading}
				<div class="empty-state">Loading keys...</div>
			{:else if keysQuery.error}
				<div class="empty-state error">Failed to load keys</div>
			{:else if activeKeys.length === 0}
				<div class="empty-state">
					No active access keys. Create one above to share access with workers.
				</div>
			{:else}
				<ul class="keys-list">
					{#each activeKeys as key (key.id)}
						<li class="key-item">
							<span class="key-name">{key.displayName}</span>
							<span class="key-meta">
								{formatDate(key.createdAt)}
								{#if key.lastUsedAt}
									<span class="separator">&bull;</span>
									used {formatDate(key.lastUsedAt)}
								{/if}
							</span>
							<button
								onclick={() => handleRevoke(key.id, key.displayName)}
								class="btn-revoke"
								title="Revoke access"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"></circle>
									<line x1="15" y1="9" x2="9" y2="15"></line>
									<line x1="9" y1="9" x2="15" y2="15"></line>
								</svg>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Revoked Keys (collapsible) -->
		{#if revokedKeys.length > 0}
			<div class="card revoked-card">
				<button class="collapsible-header" onclick={() => (showRevoked = !showRevoked)}>
					<span class="collapsible-title">
						Revoked Keys
						<span class="revoked-count">{revokedKeys.length}</span>
					</span>
					<svg
						class="chevron"
						class:expanded={showRevoked}
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="6 9 12 15 18 9"></polyline>
					</svg>
				</button>

				{#if showRevoked}
					<ul class="keys-list revoked-list">
						{#each revokedKeys as key (key.id)}
							<li class="key-item revoked">
								<span class="key-name">{key.displayName}</span>
								<span class="key-meta">
									{formatDate(key.createdAt)}
									{#if key.lastUsedAt}
										<span class="separator">&bull;</span>
										used {formatDate(key.lastUsedAt)}
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100vh;
		background-color: #f9fafb;
	}

	/* Main Content */
	.main {
		max-width: 56rem;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	/* Success Banner */
	.success-banner {
		margin-bottom: 1.5rem;
		padding: 1rem;
		background-color: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 0.75rem;
	}

	.success-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.success-info h3 {
		font-weight: 500;
		color: #166534;
		margin: 0 0 0.25rem 0;
	}

	.success-info p {
		font-size: 0.875rem;
		color: #15803d;
		margin: 0 0 0.75rem 0;
	}

	.key-display {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.key-display code {
		padding: 0.375rem 0.5rem;
		background-color: white;
		border-radius: 0.25rem;
		font-size: 0.8125rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		word-break: break-all;
	}

	.btn-copy {
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		background-color: #22c55e;
		color: white;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-copy:hover {
		background-color: #16a34a;
	}

	.btn-dismiss {
		padding: 0.25rem;
		background: none;
		border: none;
		color: #22c55e;
		cursor: pointer;
		flex-shrink: 0;
	}

	.btn-dismiss:hover {
		color: #16a34a;
	}

	/* Cards */
	.card {
		background-color: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
		overflow: hidden;
	}

	.card-header {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.card-title {
		font-size: 1.125rem;
		font-weight: 500;
		color: #111827;
		margin: 0;
	}

	.card > .card-title {
		padding: 1.5rem 1.5rem 0;
	}

	/* Create Form */
	.create-form {
		display: flex;
		gap: 0.75rem;
		padding: 1rem 1.5rem 1.5rem;
	}

	.form-input {
		flex: 1;
		padding: 0.625rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 1rem;
		min-height: 44px;
		box-sizing: border-box;
	}

	.form-input:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
	}

	.form-input::placeholder {
		color: #9ca3af;
	}

	.btn-primary {
		padding: 0.625rem 1rem;
		background-color: #22c55e;
		color: white;
		font-weight: 500;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: background-color 0.15s;
		white-space: nowrap;
		min-height: 44px;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #16a34a;
	}

	.btn-primary:disabled {
		background-color: #86efac;
		cursor: not-allowed;
	}

	.error-message {
		padding: 0 1.5rem 1rem;
		color: #dc2626;
		font-size: 0.875rem;
		margin: 0;
	}

	/* Keys List */
	.keys-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.key-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.key-item:last-child {
		border-bottom: none;
	}

	.key-name {
		font-weight: 500;
		color: #111827;
		white-space: nowrap;
	}

	.key-meta {
		flex: 1;
		font-size: 0.8125rem;
		color: #9ca3af;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.separator {
		margin: 0 0.25rem;
	}

	.btn-revoke {
		color: #dc2626;
		background-color: #fef2f2;
		border: none;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 0.375rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			color 0.15s,
			background-color 0.15s;
		flex-shrink: 0;
		margin-left: auto;
	}

	.btn-revoke svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.btn-revoke:hover {
		color: #b91c1c;
		background-color: #fee2e2;
	}

	/* Revoked Keys Collapsible */
	.revoked-card {
		overflow: hidden;
	}

	.collapsible-header {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s;
	}

	.collapsible-header:hover {
		background-color: #f9fafb;
	}

	.collapsible-title {
		font-size: 1rem;
		font-weight: 500;
		color: #6b7280;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.revoked-count {
		font-size: 0.75rem;
		font-weight: 600;
		background-color: #f3f4f6;
		color: #6b7280;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
	}

	.chevron {
		width: 1.25rem;
		height: 1.25rem;
		color: #9ca3af;
		transition: transform 0.2s;
	}

	.chevron.expanded {
		transform: rotate(180deg);
	}

	.revoked-list {
		border-top: 1px solid #e5e7eb;
	}

	.key-item.revoked {
		background-color: #fafafa;
	}

	.key-item.revoked .key-name {
		color: #9ca3af;
	}

	.key-item.revoked .key-meta {
		color: #d1d5db;
	}

	/* Empty/Loading States */
	.empty-state {
		padding: 2rem 1.5rem;
		text-align: center;
		color: #6b7280;
	}

	.empty-state.error {
		color: #dc2626;
	}

	/* Back Link */
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
		.create-form {
			flex-direction: column;
		}

		.key-item {
			padding: 0.75rem 1rem;
			gap: 0.75rem;
		}

		.key-meta {
			display: none;
		}
	}
</style>
