<script lang="ts">
	import { setupConvex } from 'convex-svelte';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// Only initialize Convex on client side (uses WebSocket)
	if (browser) {
		setupConvex(PUBLIC_CONVEX_URL);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
