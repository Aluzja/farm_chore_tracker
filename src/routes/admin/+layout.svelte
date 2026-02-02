<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
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

    // Pass client to adminAuth
    adminAuth.setClient(client);

    // Check authentication
    await adminAuth.checkAuth();

    // If on login page, don't redirect
    if ($page.url.pathname.startsWith('/admin/login')) {
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
    $page.url.pathname.startsWith('/admin/login') ||
    (adminAuth.isAuthenticated && adminAuth.isAdmin)
  );
</script>

{#if adminAuth.isLoading}
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-lg text-gray-500">Loading...</div>
  </div>
{:else if showContent}
  {@render children?.()}
{:else}
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-lg text-gray-500">Checking authorization...</div>
  </div>
{/if}
