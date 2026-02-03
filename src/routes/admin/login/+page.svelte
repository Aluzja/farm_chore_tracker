<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { browser } from '$app/environment';
  import { useConvexClient } from 'convex-svelte';
  import { adminAuth } from '$lib/auth/admin.svelte';

  let email = $state('');
  let password = $state('');
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let mode = $state<'signIn' | 'signUp'>('signIn');

  // Get Convex client at component level
  const client = browser ? useConvexClient() : null;

  // Ensure client is set on adminAuth
  onMount(() => {
    if (client) {
      adminAuth.setClient(client);
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    // Ensure client is set
    if (client && !adminAuth.isAuthenticated) {
      adminAuth.setClient(client);
    }

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
        // Full page reload to reinitialize Convex client with auth token
        // Redirect to Today view (main app) as the default admin landing page
        window.location.href = resolve('/');
        return;
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

<div class="login-page">
  <div class="login-container">
    <div class="login-header">
      <h1>Kitchen Sink Farm</h1>
      <p>Admin {mode === 'signIn' ? 'Login' : 'Sign Up'}</p>
    </div>

    <form onsubmit={handleSubmit} class="login-card">
      {#if error}
        <div class="error-alert">
          {error}
        </div>
      {/if}

      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          autocomplete="email"
          placeholder="admin@example.com"
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          autocomplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          minlength="8"
          placeholder="********"
        />
      </div>

      <button type="submit" class="btn-primary" disabled={isSubmitting}>
        {#if isSubmitting}
          {mode === 'signIn' ? 'Signing in...' : 'Creating account...'}
        {:else}
          {mode === 'signIn' ? 'Sign In' : 'Create Account'}
        {/if}
      </button>

      <div class="mode-toggle">
        <button type="button" onclick={toggleMode} class="btn-link">
          {mode === 'signIn'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </div>

      {#if mode === 'signUp'}
        <p class="signup-hint">
          First account created will be the admin.
        </p>
      {/if}
    </form>

    <div class="back-link">
      <a href={resolve('/')}>Back to app</a>
    </div>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f9fafb;
    padding: 1rem;
  }

  .login-container {
    width: 100%;
    max-width: 24rem;
  }

  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .login-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .login-header p {
    color: #6b7280;
    margin: 0.5rem 0 0 0;
  }

  .login-card {
    background-color: white;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    padding: 2rem;
  }

  .error-alert {
    margin-bottom: 1rem;
    padding: 0.75rem;
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
    color: #dc2626;
    font-size: 0.875rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group:last-of-type {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .form-group input:focus {
    outline: none;
    border-color: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  .form-group input::placeholder {
    color: #9ca3af;
  }

  .btn-primary {
    width: 100%;
    padding: 0.625rem 1rem;
    background-color: #22c55e;
    color: white;
    font-weight: 500;
    border: none;
    border-radius: 0.375rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.15s;
    min-height: 44px;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #16a34a;
  }

  .btn-primary:disabled {
    background-color: #86efac;
    cursor: not-allowed;
  }

  .mode-toggle {
    margin-top: 1rem;
    text-align: center;
  }

  .btn-link {
    background: none;
    border: none;
    color: #22c55e;
    font-size: 0.875rem;
    cursor: pointer;
    padding: 0;
  }

  .btn-link:hover {
    color: #16a34a;
    text-decoration: underline;
  }

  .signup-hint {
    margin-top: 1rem;
    font-size: 0.75rem;
    color: #6b7280;
    text-align: center;
  }

  .back-link {
    margin-top: 1.5rem;
    text-align: center;
  }

  .back-link a {
    font-size: 0.875rem;
    color: #6b7280;
    text-decoration: none;
  }

  .back-link a:hover {
    color: #111827;
  }
</style>
