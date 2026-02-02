<script lang="ts">
  import { useQuery, useConvexClient } from 'convex-svelte';
  import { api } from '../../../convex/_generated/api';
  import { adminAuth } from '$lib/auth/admin.svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { Id } from '../../../convex/_generated/dataModel';

  // Get Convex client for mutations
  const client = useConvexClient();

  // Query for listing keys
  const keysQuery = useQuery(api.accessKeys.list, {});

  // Form state
  let newKeyName = $state('');
  let isCreating = $state(false);
  let createError = $state<string | null>(null);

  // Created key display (shown after creation)
  let createdKey = $state<string | null>(null);

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!newKeyName.trim() || isCreating) return;

    isCreating = true;
    createError = null;

    try {
      const result = await client.mutation(api.accessKeys.create, { displayName: newKeyName.trim() });
      createdKey = result.key;
      newKeyName = '';
    } catch (error) {
      createError = error instanceof Error ? error.message : 'Failed to create key';
    } finally {
      isCreating = false;
    }
  }

  async function handleRevoke(id: Id<"accessKeys">, displayName: string) {
    if (!confirm(`Revoke access key "${displayName}"? This cannot be undone.`)) return;

    try {
      await client.mutation(api.accessKeys.revoke, { id });
    } catch (error) {
      console.error('Failed to revoke key:', error);
      alert('Failed to revoke key');
    }
  }

  function copyKey() {
    if (createdKey) {
      navigator.clipboard.writeText(`${window.location.origin}/?key=${createdKey}`);
    }
  }

  function dismissCreatedKey() {
    createdKey = null;
  }

  function handleSignOut() {
    adminAuth.signOut();
    goto(resolve('/admin/login'));
  }

  // Format date for display
  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

<svelte:head>
  <title>Access Keys - Kitchen Sink Farm Admin</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="bg-white shadow-sm">
    <div class="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
      <h1 class="text-xl font-semibold text-gray-900">Access Keys</h1>
      <button
        onclick={handleSignOut}
        class="text-sm text-gray-600 hover:text-gray-900"
      >
        Sign Out
      </button>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 py-8">
    <!-- Created Key Banner -->
    {#if createdKey}
      <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-medium text-green-800">Access Key Created!</h3>
            <p class="text-sm text-green-700 mt-1">
              Share this link with the worker. They only need to open it once.
            </p>
            <div class="mt-2 flex items-center gap-2">
              <code class="px-2 py-1 bg-white rounded text-sm font-mono">
                {window.location.origin}/?key={createdKey}
              </code>
              <button
                onclick={copyKey}
                class="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Copy
              </button>
            </div>
          </div>
          <button
            onclick={dismissCreatedKey}
            class="text-green-600 hover:text-green-800"
            aria-label="Dismiss"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Create New Key Form -->
    <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Create New Access Key</h2>
      <form onsubmit={handleCreate} class="flex gap-3">
        <input
          type="text"
          bind:value={newKeyName}
          placeholder="Display name (e.g., John's Phone)"
          required
          class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isCreating || !newKeyName.trim()}
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          {isCreating ? 'Creating...' : 'Create Key'}
        </button>
      </form>
      {#if createError}
        <p class="mt-2 text-sm text-red-600">{createError}</p>
      {/if}
    </div>

    <!-- Keys List -->
    <div class="bg-white rounded-lg shadow-sm">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-medium text-gray-900">Existing Keys</h2>
      </div>

      {#if keysQuery.isLoading}
        <div class="p-6 text-center text-gray-500">Loading keys...</div>
      {:else if keysQuery.error}
        <div class="p-6 text-center text-red-600">Failed to load keys</div>
      {:else if !keysQuery.data?.length}
        <div class="p-6 text-center text-gray-500">
          No access keys yet. Create one above to share access with workers.
        </div>
      {:else}
        <ul class="divide-y divide-gray-200">
          {#each keysQuery.data as key}
            <li class="px-6 py-4 flex items-center justify-between">
              <div>
                <p class="font-medium text-gray-900">
                  {key.displayName}
                  {#if key.isRevoked}
                    <span class="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                      Revoked
                    </span>
                  {/if}
                </p>
                <p class="text-sm text-gray-500">
                  Created {formatDate(key.createdAt)}
                  {#if key.lastUsedAt}
                    <span class="mx-1">&bull;</span>
                    Last used {formatDate(key.lastUsedAt)}
                  {/if}
                </p>
              </div>
              {#if !key.isRevoked}
                <button
                  onclick={() => handleRevoke(key.id, key.displayName)}
                  class="text-sm text-red-600 hover:text-red-800"
                >
                  Revoke
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Back to App -->
    <div class="mt-6 text-center">
      <a href={resolve('/')} class="text-sm text-gray-500 hover:text-gray-700">
        Back to app
      </a>
    </div>
  </main>
</div>
