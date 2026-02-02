<script lang="ts">
	/// <reference types="@vite-pwa/sveltekit" />
	import { onMount } from 'svelte';
	import { setupConvex, useQuery, useConvexClient } from 'convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { browser } from '$app/environment';
	import { pwaInfo } from 'virtual:pwa-info';
	import { syncEngine, setConvexClient } from '$lib/sync/engine.svelte';
	import { choreStore } from '$lib/stores/chores.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';
	import { requestPersistentStorage } from '$lib/db/storage';
	import { api } from '../convex/_generated/api';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	// Only initialize on client side
	if (browser) {
		setupConvex(PUBLIC_CONVEX_URL);
	}

	// Get Convex client at component init (must be called at top level, not in onMount)
	const convexClient = browser ? useConvexClient() : null;

	// Server chores subscription (only active when online)
	const serverChores = browser ? useQuery(api.chores.list, {}) : null;

	// Hydrate from server when data arrives
	$effect(() => {
		if (browser && serverChores?.data && connectionStatus.isOnline) {
			choreStore.hydrateFromServer(serverChores.data);
		}
	});

	onMount(async () => {
		// Request persistent storage for IndexedDB
		await requestPersistentStorage();

		// Load local data first (instant)
		await choreStore.load();

		// Share Convex client with sync engine (client was obtained at top level)
		if (convexClient) {
			setConvexClient(convexClient);
		}

		// Initialize sync engine (will process queue if online)
		await syncEngine.init();

		// Register service worker
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegistered(registration: ServiceWorkerRegistration | undefined) {
					console.log('[PWA] Service worker registered:', registration?.scope);
				},
				onRegisterError(error: Error) {
					console.error('[PWA] Service worker registration error:', error);
				}
			});
		}
	});
</script>

<svelte:head>
	{@html webManifestLink}
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
