<script lang="ts">
  import { goto } from '$app/navigation';
  import { adminAuth } from '$lib/auth/admin.svelte';

  let email = $state('');
  let password = $state('');
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let mode = $state<'signIn' | 'signUp'>('signIn');

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    isSubmitting = true;
    error = null;

    try {
      let result;
      if (mode === 'signIn') {
        result = await adminAuth.signIn(email, password);
      } else {
        result = await adminAuth.signUp(email, password);
      }

      if (result.success) {
        // Redirect to keys management page
        goto('/admin/keys');
      } else {
        error = result.error ?? 'Authentication failed';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      isSubmitting = false;
    }
  }

  function toggleMode() {
    mode = mode === 'signIn' ? 'signUp' : 'signIn';
    error = null;
  }
</script>

<svelte:head>
  <title>Admin Login - Kitchen Sink Farm</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
  <div class="max-w-md w-full">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Kitchen Sink Farm</h1>
      <p class="text-gray-600 mt-2">Admin {mode === 'signIn' ? 'Login' : 'Sign Up'}</p>
    </div>

    <form onsubmit={handleSubmit} class="bg-white shadow-md rounded-lg p-8">
      {#if error}
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      {/if}

      <div class="mb-4">
        <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          autocomplete="email"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="admin@example.com"
        />
      </div>

      <div class="mb-6">
        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          autocomplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          minlength="8"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="********"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
      >
        {#if isSubmitting}
          {mode === 'signIn' ? 'Signing in...' : 'Creating account...'}
        {:else}
          {mode === 'signIn' ? 'Sign In' : 'Create Account'}
        {/if}
      </button>

      <div class="mt-4 text-center">
        <button
          type="button"
          onclick={toggleMode}
          class="text-sm text-blue-600 hover:text-blue-800"
        >
          {mode === 'signIn'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </div>

      {#if mode === 'signUp'}
        <p class="mt-4 text-xs text-gray-500 text-center">
          First account created will be the admin.
        </p>
      {/if}
    </form>

    <div class="mt-6 text-center">
      <a href="/" class="text-sm text-gray-500 hover:text-gray-700">
        Back to app
      </a>
    </div>
  </div>
</div>
