<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { useQuery } from 'convex-svelte';
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
	import { syncEngine } from '$lib/sync/engine.svelte';
	import { api } from '../../convex/_generated/api';

	let { children } = $props();

	let hasAccess = $state(false);
	let isValidating = $state(true);
	let error = $state<string | null>(null);
	let userName = $state<string | null>(null);
	let isInitialized = $state(false);

	// Server chores subscription (only active when hasAccess and online)
	const serverChores = browser ? useQuery(api.chores.list, {}) : null;

	// Hydrate from server when data arrives (only after access validated)
	$effect(() => {
		if (browser && hasAccess && serverChores?.data && connectionStatus.isOnline) {
			choreStore.hydrateFromServer(serverChores.data);
		}
	});

	async function initializeApp() {
		if (isInitialized) return;
		isInitialized = true;

		// Load local data first (instant)
		await choreStore.load();

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
			const result = await validateAccessKey(urlKey);
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
				const result = await validateAccessKey(storedKey);
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
	<div class="min-h-screen flex items-center justify-center bg-gray-50">
		<div class="text-center">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
			<p class="mt-4 text-gray-600">Checking access...</p>
		</div>
	</div>
{:else if hasAccess}
	<!-- Show user name in header if available -->
	{#if userName}
		<div
			class="fixed top-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded shadow-sm z-50"
		>
			{userName}
		</div>
	{/if}
	{@render children?.()}
{:else}
	<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
		<div class="max-w-md w-full text-center">
			<div class="bg-white rounded-lg shadow-md p-8">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 mx-auto text-gray-400 mb-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
					/>
				</svg>
				<h1 class="text-xl font-semibold text-gray-900 mb-2">Access Required</h1>
				<p class="text-gray-600 mb-6">
					{error ?? 'You need an access key to use this app.'}
				</p>
				<div class="space-y-3">
					<button
						onclick={handleRequestAccess}
						class="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
					>
						Request Access
					</button>
					<a
						href="/admin/login"
						class="block w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
					>
						Admin Login
					</a>
				</div>
			</div>
		</div>
	</div>
{/if}
