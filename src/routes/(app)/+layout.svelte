<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
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
	import { getTodayDateString } from '$lib/utils/date';
	import { adminAuth } from '$lib/auth/admin.svelte';
	import { setCurrentUser } from '$lib/auth/user-context.svelte';
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
	let manualKey = $state('');
	let isSubmittingKey = $state(false);
	let keyError = $state<string | null>(null);

	// Server chores subscription (only active when hasAccess and online)
	const serverChores = browser
		? useQuery(api.chores.list, () => ({ accessKey: getStoredAccessKey() ?? undefined }))
		: null;

	// Daily chores subscription — pass local timezone date so server doesn't use UTC
	const dailyChoresQuery = browser
		? useQuery(api.dailyChores.getOrCreateDailyList, () => ({
				date: getTodayDateString(),
				accessKey: getStoredAccessKey() ?? undefined
			}))
		: null;

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
				client.mutation(api.dailyChores.cloneMasterToDaily, {
					date: data.date,
					accessKey: getStoredAccessKey() ?? undefined
				});
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

	// Keep user context in sync with layout's userName state
	$effect(() => {
		if (browser && hasAccess && userName) {
			setCurrentUser(userName);
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
		const urlKey = extractKeyFromUrl(page.url);
		if (urlKey) {
			// Clean URL immediately (remove ?key= from address bar)
			const cleanUrl = new URL(page.url);
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

	async function handleSubmitKey() {
		const key = manualKey.trim();
		if (!key) {
			keyError = 'Please enter an access key';
			return;
		}

		isSubmittingKey = true;
		keyError = null;

		const result = await validateAccessKey(key, convexClient);
		if (result.valid) {
			storeAccessKey(key);
			hasAccess = true;
			userName = result.displayName ?? null;
			error = null;
			await initializeApp();
		} else {
			keyError =
				result.reason === 'revoked'
					? 'This access key has been revoked.'
					: 'Invalid access key. Please check and try again.';
		}

		isSubmittingKey = false;
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
	{@render children?.()}
{:else}
	<div class="error-container">
		<div class="error-card">
			<h1 class="error-title">Access Required</h1>
			<p class="error-message">
				{error ?? 'You need an access key to use this app.'}
			</p>

			<form
				class="key-form"
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmitKey();
				}}
			>
				<label for="access-key" class="key-label">Enter Access Key</label>
				<input
					id="access-key"
					type="text"
					bind:value={manualKey}
					placeholder="e.g. abc123"
					class="key-input"
					disabled={isSubmittingKey}
					autocapitalize="none"
					autocorrect="off"
				/>
				{#if keyError}
					<p class="key-error">{keyError}</p>
				{/if}
				<button type="submit" class="btn-primary" disabled={isSubmittingKey}>
					{#if isSubmittingKey}
						Checking...
					{:else}
						Submit Key
					{/if}
				</button>
			</form>

			<div class="divider">
				<span>or</span>
			</div>

			<a href={resolve('/admin/login')} class="btn-secondary"> Admin Login </a>
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
		border-top-color: #22c55e;
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
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		padding: 2rem;
	}

	.error-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	.error-message {
		color: #6b7280;
		margin: 0 0 1.5rem 0;
		line-height: 1.5;
	}

	.error-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.btn-primary {
		width: 100%;
		padding: 0.75rem 1rem;
		min-height: 48px;
		background-color: #22c55e;
		color: white;
		font-weight: 500;
		border: none;
		border-radius: 0.375rem;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.btn-primary:hover {
		background-color: #16a34a;
	}

	.btn-secondary {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 0.75rem 1rem;
		min-height: 48px;
		background-color: white;
		border: 1px solid #d1d5db;
		color: #374151;
		font-weight: 500;
		border-radius: 0.375rem;
		text-decoration: none;
		text-align: center;
		font-size: 1rem;
		transition:
			background-color 0.15s,
			border-color 0.15s;
	}

	.btn-secondary:hover {
		background-color: #f9fafb;
		border-color: #9ca3af;
	}

	.key-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.key-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		text-align: left;
	}

	.key-input {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 1rem;
		box-sizing: border-box;
		transition: border-color 0.15s;
	}

	.key-input:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
	}

	.key-input:disabled {
		background-color: #f9fafb;
		color: #9ca3af;
	}

	.key-error {
		color: #dc2626;
		font-size: 0.875rem;
		margin: 0;
		text-align: left;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 0.5rem 0;
		color: #9ca3af;
		font-size: 0.875rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background-color: #e5e7eb;
	}
</style>
