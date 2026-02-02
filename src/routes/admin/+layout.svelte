<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { adminAuth } from '$lib/auth/admin.svelte';

  let { children } = $props();

  // Check auth on mount
  onMount(async () => {
    await adminAuth.checkAuth();

    // If on login page, don't redirect
    if ($page.url.pathname.startsWith('/admin/login')) {
      return;
    }

    // If not authenticated, redirect to login
    if (!adminAuth.isAuthenticated) {
      goto('/admin/login');
      return;
    }

    // If authenticated but not admin, redirect to home
    if (!adminAuth.isAdmin) {
      goto('/');
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
