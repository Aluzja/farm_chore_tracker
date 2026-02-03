<script lang="ts">
	/// <reference types="@vite-pwa/sveltekit" />
	import { onMount } from 'svelte';
	import { setupConvex, useConvexClient } from 'convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { browser } from '$app/environment';
	import { pwaInfo } from 'virtual:pwa-info';
	import { setConvexClient } from '$lib/sync/engine.svelte';
	import { connectionStatus } from '$lib/sync/status.svelte';
	import { requestPersistentStorage } from '$lib/db/storage';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	// Only initialize on client side
	if (browser) {
		setupConvex(PUBLIC_CONVEX_URL);
	}

	// Get Convex client at component init (must be called at top level, not in onMount)
	const convexClient = browser ? useConvexClient() : null;

	// Set up auth - read token from the namespaced localStorage key that @convex-dev/auth uses
	if (browser && convexClient) {
		const escapedNamespace = PUBLIC_CONVEX_URL.replace(/[^a-zA-Z0-9]/g, '');
		const tokenKey = `convexAuthJwt_${escapedNamespace}`;

		convexClient.setAuth(async () => {
			return localStorage.getItem(tokenKey);
		});
	}

	onMount(async () => {
		// Initialize connection status (must happen in browser)
		connectionStatus.init();

		// Request persistent storage for IndexedDB
		await requestPersistentStorage();

		// Share Convex client with sync engine (client was obtained at top level)
		if (convexClient) {
			setConvexClient(convexClient);
		}

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
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- webManifestLink is a static trusted string -->
	{@html webManifestLink}
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
