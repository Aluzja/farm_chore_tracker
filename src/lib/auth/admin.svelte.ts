import { browser } from '$app/environment';
import { getConvexClient } from '$lib/sync/engine.svelte';
import { api } from '../../convex/_generated/api';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

class AdminAuth {
  state = $state<AuthState>('loading');
  userId = $state<string | null>(null);
  isAdmin = $state(false);
  error = $state<string | null>(null);

  get isAuthenticated() {
    return this.state === 'authenticated';
  }

  get isLoading() {
    return this.state === 'loading';
  }

  async checkAuth(): Promise<void> {
    if (!browser) return;

    const client = getConvexClient();
    if (!client) {
      this.state = 'unauthenticated';
      return;
    }

    try {
      const user = await client.query(api.users.currentUser, {});
      if (user) {
        this.userId = user._id;
        this.isAdmin = user.isAdmin ?? false;
        this.state = 'authenticated';
      } else {
        this.state = 'unauthenticated';
        this.userId = null;
        this.isAdmin = false;
      }
    } catch (error) {
      console.error('[AdminAuth] Check failed:', error);
      this.state = 'unauthenticated';
      this.error = error instanceof Error ? error.message : 'Auth check failed';
    }
  }

  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!browser) return { success: false, error: 'Not in browser' };

    const client = getConvexClient();
    if (!client) return { success: false, error: 'Convex client not available' };

    this.error = null;

    try {
      // Call Convex Auth signIn action
      await client.action(api.auth.signIn, {
        provider: 'password',
        params: { email, password, flow: 'signIn' },
      });

      // Check if first user (auto-admin)
      await client.mutation(api.users.checkFirstUserAdmin, {});

      // Refresh auth state
      await this.checkAuth();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      this.error = message;
      return { success: false, error: message };
    }
  }

  async signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!browser) return { success: false, error: 'Not in browser' };

    const client = getConvexClient();
    if (!client) return { success: false, error: 'Convex client not available' };

    this.error = null;

    try {
      // Call Convex Auth signIn action with signUp flow
      await client.action(api.auth.signIn, {
        provider: 'password',
        params: { email, password, flow: 'signUp' },
      });

      // Check if first user (auto-admin)
      await client.mutation(api.users.checkFirstUserAdmin, {});

      // Refresh auth state
      await this.checkAuth();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      this.error = message;
      return { success: false, error: message };
    }
  }

  async signOut(): Promise<void> {
    if (!browser) return;

    const client = getConvexClient();
    if (!client) return;

    try {
      await client.action(api.auth.signOut, {});
    } catch (error) {
      console.error('[AdminAuth] Sign out error:', error);
    } finally {
      this.state = 'unauthenticated';
      this.userId = null;
      this.isAdmin = false;
    }
  }
}

export const adminAuth = new AdminAuth();
