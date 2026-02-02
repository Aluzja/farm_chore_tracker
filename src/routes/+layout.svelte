<script lang="ts">
	import { onMount } from 'svelte';
	import { setupConvex } from 'convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { browser } from '$app/environment';
	import { pwaInfo } from 'virtual:pwa-info';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	// Only initialize Convex on client side (uses WebSocket)
	if (browser) {
		setupConvex(PUBLIC_CONVEX_URL);
	}

	onMount(async () => {
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegistered(registration) {
					console.log('[PWA] Service worker registered:', registration?.scope);
				},
				onRegisterError(error) {
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
