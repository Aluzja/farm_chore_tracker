<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { useConvexClient } from 'convex-svelte';
	import { adminAuth } from '$lib/auth/admin.svelte';

	let { children } = $props();

	// Get Convex client at component level (must be at top level, not in onMount)
	const client = browser ? useConvexClient() : null;

	// Check auth on mount
	onMount(async () => {
		if (!client) {
			adminAuth.state = 'unauthenticated';
			return;
		}

		// Pass client to adminAuth and wait for auth to be set
		await adminAuth.setClient(client);

		// Check authentication
		await adminAuth.checkAuth();

		// If on login page, don't redirect
		if (page.url.pathname.startsWith('/admin/login')) {
			return;
		}

		// If not authenticated, redirect to login
		if (!adminAuth.isAuthenticated) {
			goto(resolve('/admin/login'));
			return;
		}

		// If authenticated but not admin, redirect to home
		if (!adminAuth.isAdmin) {
			goto(resolve('/'));
			return;
		}
	});

	// Derived state for showing content
	let showContent = $derived(
		page.url.pathname.startsWith('/admin/login') || (adminAuth.isAuthenticated && adminAuth.isAdmin)
	);
</script>

{#if adminAuth.isLoading}
	<div class="admin-loading">
		<div class="spinner"></div>
		<p>Loading...</p>
	</div>
{:else if showContent}
	{@render children?.()}
{:else}
	<div class="admin-loading">
		<div class="spinner"></div>
		<p>Checking authorization...</p>
	</div>
{/if}

<style>
	.admin-loading {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		background-color: #f9fafb;
	}

	.admin-loading p {
		font-size: 1rem;
		color: #6b7280;
		margin: 0;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid #e5e7eb;
		border-top-color: #22c55e;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
