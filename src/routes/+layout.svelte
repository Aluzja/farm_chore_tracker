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
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import AdminNav from '$lib/components/AdminNav.svelte';
	import PhotoViewModal from '$lib/components/PhotoViewModal.svelte';

	let { children } = $props();

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	// Only initialize on client side
	if (browser) {
		setupConvex(PUBLIC_CONVEX_URL);
	}

	// Get Convex client at component init (must be called at top level, not in onMount)
	const convexClient = browser ? useConvexClient() : null;

	// Set up auth token provider
	if (browser && convexClient) {
		convexClient.setAuth(async () => {
			return localStorage.getItem('convex_auth_token');
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

<div class="app-shell">
	<AdminNav />
	<div class="app-content">
		{@render children?.()}
	</div>
</div>

{#if page.state.photoChoreId}
	<PhotoViewModal choreId={page.state.photoChoreId} onclose={() => history.back()} />
{/if}

<style>
	.app-shell {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
	}

	.app-content {
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		display: flex;
		flex-direction: column;
	}
</style>
