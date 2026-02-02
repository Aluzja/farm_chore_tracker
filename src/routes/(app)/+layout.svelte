<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { useQuery, useConvexClient } from 'convex-svelte';
	import {
		getStoredAccessKey,
		storeAccessKey,
		clearAccessKey,
		validateAccessKey,
		getCachedValidation,
		extractKeyFromUrl
	} from '$lib/auth/access-key';
	import { adminAuth } from '$lib/auth/admin.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';
	import { choreStore } from '$lib/stores/chores.svelte';
	import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';
	import { syncEngine, getConvexClient } from '$lib/sync/engine.svelte';
	import { api } from '../../convex/_generated/api';

	let { children } = $props();

	// Get Convex client at component level for access key validation
	const convexClient = browser ? useConvexClient() : null;

	let hasAccess = $state(false);
	let isValidating = $state(true);
	let error = $state<string | null>(null);
	let userName = $state<string | null>(null);
	let isInitialized = $state(false);

	// Server chores subscription (only active when hasAccess and online)
	const serverChores = browser ? useQuery(api.chores.list, {}) : null;

	// Daily chores subscription
	const dailyChoresQuery = browser ? useQuery(api.dailyChores.getOrCreateDailyList, {}) : null;

	// Hydrate from server when data arrives (only after access validated)
	$effect(() => {
		if (browser && hasAccess && serverChores?.data && connectionStatus.isOnline) {
			choreStore.hydrateFromServer(serverChores.data);
		}
	});

	// Handle daily chores clone trigger
	$effect(() => {
		if (
			dailyChoresQuery?.data &&
			typeof dailyChoresQuery.data === 'object' &&
			'needsClone' in dailyChoresQuery.data
		) {
			const client = getConvexClient();
			if (client) {
				const data = dailyChoresQuery.data as { needsClone: boolean; date: string };
				client.mutation(api.dailyChores.cloneMasterToDaily, { date: data.date });
			}
		}
	});

	// Hydrate daily chores when data arrives
	$effect(() => {
		if (
			browser &&
			hasAccess &&
			dailyChoresQuery?.data &&
			Array.isArray(dailyChoresQuery.data) &&
			connectionStatus.isOnline
		) {
			dailyChoreStore.hydrateFromServer(dailyChoresQuery.data);
		}
	});

	async function initializeApp() {
		if (isInitialized) return;
		isInitialized = true;

		// Load local data first (instant)
		await choreStore.load();
		await dailyChoreStore.load();

		// Initialize sync engine (will process queue if online)
		await syncEngine.init();
	}

	onMount(async () => {
		// Check for key in URL first
		const urlKey = extractKeyFromUrl($page.url);
		if (urlKey) {
			// Clean URL immediately (remove ?key= from address bar)
			const cleanUrl = new URL($page.url);
			cleanUrl.searchParams.delete('key');
			window.history.replaceState({}, '', cleanUrl.toString());

			// Validate the URL key
			const result = await validateAccessKey(urlKey, convexClient);
			if (result.valid) {
				storeAccessKey(urlKey);
				hasAccess = true;
				userName = result.displayName ?? null;
				isValidating = false;
				await initializeApp();
				return;
			} else {
				error =
					result.reason === 'revoked'
						? 'This access key has been revoked. Please contact the admin for a new key.'
						: 'Invalid access key. Please check the link or contact the admin.';
				isValidating = false;
				return;
			}
		}

		// Check stored key
		const storedKey = getStoredAccessKey();
		if (storedKey) {
			// Try online validation first
			if (connectionStatus.isOnline) {
				const result = await validateAccessKey(storedKey, convexClient);
				if (result.valid) {
					hasAccess = true;
					userName = result.displayName ?? null;
					isValidating = false;
					await initializeApp();
					return;
				} else {
					// Key was revoked or invalid
					clearAccessKey();
					error =
						result.reason === 'revoked'
							? 'Your access key has been revoked. Please contact the admin for a new key.'
							: 'Your access key is no longer valid. Please request a new one.';
					isValidating = false;
					return;
				}
			} else {
				// Offline - use cached validation
				const cached = getCachedValidation();
				if (cached?.valid) {
					hasAccess = true;
					userName = cached.displayName ?? null;
					isValidating = false;
					await initializeApp();
					return;
				}
				// No valid cache, but we have a key - allow access (will revalidate online)
				hasAccess = true;
				isValidating = false;
				await initializeApp();
				return;
			}
		}

		// Check admin auth as fallback
		if (convexClient) {
			adminAuth.setClient(convexClient);
		}
		await adminAuth.checkAuth();
		if (adminAuth.isAuthenticated) {
			hasAccess = true;
			userName = 'Admin';
			isValidating = false;
			await initializeApp();
			return;
		}

		// No access - show error
		error = 'No access key found. Please use a link shared by the admin.';
		isValidating = false;
	});

	function handleRequestAccess() {
		// Could open a modal or redirect to a request page
		// For now, just show info about getting access
		alert('Please contact the farm administrator for an access key.');
	}
</script>

{#if isValidating}
	<div class="loading-container">
		<div class="loading-content">
			<div class="spinner"></div>
			<p class="loading-text">Checking access...</p>
		</div>
	</div>
{:else if hasAccess}
	{#if userName}
		<div class="user-badge">
			{userName}
		</div>
	{/if}
	{@render children?.()}
{:else}
	<div class="error-container">
		<div class="error-card">
			<h1 class="error-title">Access Required</h1>
			<p class="error-message">
				{error ?? 'You need an access key to use this app.'}
			</p>
			<div class="error-actions">
				<button onclick={handleRequestAccess} class="btn-primary">
					Request Access
				</button>
				<a href={resolve('/admin/login')} class="btn-secondary">
					Admin Login
				</a>
			</div>
		</div>
	</div>
{/if}

<style>
	.loading-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #f9fafb;
	}

	.loading-content {
		text-align: center;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid #e5e7eb;
		border-top-color: #2563eb;
		border-radius: 50%;
		margin: 0 auto;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text {
		margin-top: 1rem;
		color: #6b7280;
	}

	.user-badge {
		position: fixed;
		top: 0.5rem;
		right: 0.5rem;
		font-size: 0.75rem;
		color: #6b7280;
		background: rgba(255, 255, 255, 0.9);
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		z-index: 50;
	}

	.error-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #f9fafb;
		padding: 1rem;
	}

	.error-card {
		max-width: 24rem;
		width: 100%;
		text-align: center;
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		padding: 2rem;
	}

	.error-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
		margin-bottom: 0.5rem;
	}

	.error-message {
		color: #6b7280;
		margin-bottom: 1.5rem;
	}

	.error-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.btn-primary {
		width: 100%;
		padding: 0.5rem 1rem;
		background-color: #2563eb;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-primary:hover {
		background-color: #1d4ed8;
	}

	.btn-secondary {
		display: block;
		width: 100%;
		padding: 0.5rem 1rem;
		border: 1px solid #d1d5db;
		color: #374151;
		border-radius: 0.375rem;
		text-decoration: none;
		text-align: center;
		font-size: 1rem;
		transition: background-color 0.2s;
	}

	.btn-secondary:hover {
		background-color: #f9fafb;
	}
</style>
