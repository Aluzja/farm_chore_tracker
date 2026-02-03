import { browser } from '$app/environment';
import type { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';

const TOKEN_STORAGE_KEY = 'convex_auth_token';
const REFRESH_TOKEN_KEY = 'convex_auth_refresh_token';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

// Store tokens in localStorage
function storeTokens(token: string, refreshToken: string): void {
	if (!browser) return;
	localStorage.setItem(TOKEN_STORAGE_KEY, token);
	localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

// Get stored token
function getStoredToken(): string | null {
	if (!browser) return null;
	return localStorage.getItem(TOKEN_STORAGE_KEY);
}

// Get stored refresh token
function getStoredRefreshToken(): string | null {
	if (!browser) return null;
	return localStorage.getItem(REFRESH_TOKEN_KEY);
}

// Clear stored tokens
function clearTokens(): void {
	if (!browser) return;
	localStorage.removeItem(TOKEN_STORAGE_KEY);
	localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Token provider function for Convex client
export function getAuthToken(): string | null {
	return getStoredToken();
}

class AdminAuth {
	state = $state<AuthState>('loading');
	userId = $state<string | null>(null);
	isAdmin = $state(false);
	error = $state<string | null>(null);
	private client: ConvexClient | null = null;

	get isAuthenticated() {
		return this.state === 'authenticated';
	}

	get isLoading() {
		return this.state === 'loading';
	}

	// Set the Convex client and configure auth
	async setClient(convexClient: ConvexClient): Promise<void> {
		this.client = convexClient;

		// Set up auth token provider and wait for auth to be established
		const token = getStoredToken();
		if (token && this.client) {
			// Create a promise that resolves when auth state changes
			await new Promise<void>((resolve) => {
				let resolved = false;
				this.client!.setAuth(
					async () => token,
					() => {
						if (!resolved) {
							resolved = true;
							resolve();
						}
					}
				);
				// Also resolve after a timeout in case onChange doesn't fire
				setTimeout(() => {
					if (!resolved) {
						resolved = true;
						resolve();
					}
				}, 2000);
			});
		}
	}

	async checkAuth(): Promise<void> {
		if (!browser || !this.client) {
			this.state = 'unauthenticated';
			return;
		}

		// Check if we have a stored token
		const token = getStoredToken();
		if (!token) {
			this.state = 'unauthenticated';
			return;
		}

		// Set the auth token on the client
		this.client.setAuth(async () => token);

		try {
			const user = await this.client.query(api.users.currentUser, {});
			if (user) {
				this.userId = user._id;
				this.isAdmin = user.isAdmin ?? false;
				this.state = 'authenticated';

				// If authenticated but not admin, try to become admin (first user case)
				if (!this.isAdmin) {
					try {
						await this.client.mutation(api.users.forceSetAdmin, {});
						this.isAdmin = true;
					} catch {
						// Expected if admin already exists
					}
				}
			} else {
				// Token might be expired, try to refresh
				const refreshed = await this.refreshToken();
				if (!refreshed) {
					clearTokens();
					this.state = 'unauthenticated';
					this.userId = null;
					this.isAdmin = false;
				}
			}
		} catch (error) {
			console.error('[AdminAuth] Check failed:', error);
			// Try to refresh token on error
			const refreshed = await this.refreshToken();
			if (!refreshed) {
				clearTokens();
				this.state = 'unauthenticated';
				this.error = error instanceof Error ? error.message : 'Auth check failed';
			}
		}
	}

	private async refreshToken(): Promise<boolean> {
		const refreshToken = getStoredRefreshToken();
		if (!refreshToken || !this.client) return false;

		try {
			const result = await this.client.action(api.auth.signIn, {
				refreshToken
			});

			const tokens = result?.tokens;
			if (tokens?.token) {
				storeTokens(tokens.token, tokens.refreshToken);
				const token = tokens.token;
				this.client.setAuth(async () => token);

				// Re-check the user
				const user = await this.client.query(api.users.currentUser, {});
				if (user) {
					this.userId = user._id;
					this.isAdmin = user.isAdmin ?? false;
					this.state = 'authenticated';
					return true;
				}
			}
		} catch (error) {
			console.error('[AdminAuth] Token refresh failed:', error);
		}
		return false;
	}

	async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
		if (!browser) return { success: false, error: 'Not in browser' };
		if (!this.client) return { success: false, error: 'Convex client not available' };

		this.error = null;

		try {
			// Call Convex Auth signIn action
			const result = await this.client.action(api.auth.signIn, {
				provider: 'password',
				params: { email, password, flow: 'signIn' }
			});

			const tokens = result?.tokens;
			if (tokens?.token) {
				// Store tokens
				storeTokens(tokens.token, tokens.refreshToken);

				// Set auth on client
				const token = tokens.token;
				this.client.setAuth(async () => token);

				// Refresh auth state
				await this.checkAuth();
				return { success: true };
			} else {
				return { success: false, error: 'No token received' };
			}
		} catch (error) {
			console.error('[AdminAuth] signIn error:', error);
			const message = error instanceof Error ? error.message : 'Sign in failed';
			this.error = message;
			return { success: false, error: message };
		}
	}

	async signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
		if (!browser) return { success: false, error: 'Not in browser' };
		if (!this.client) return { success: false, error: 'Convex client not available' };

		this.error = null;

		try {
			// Call Convex Auth signIn action with signUp flow
			const result = await this.client.action(api.auth.signIn, {
				provider: 'password',
				params: { email, password, flow: 'signUp' }
			});

			const tokens = result?.tokens;
			if (tokens?.token) {
				// Store tokens
				storeTokens(tokens.token, tokens.refreshToken);

				// Set auth on client
				const token = tokens.token;
				this.client.setAuth(async () => token);

				// First user automatically becomes admin via auth callback
				// Refresh auth state
				await this.checkAuth();
				return { success: true };
			} else {
				return { success: false, error: 'No token received' };
			}
		} catch (error) {
			console.error('[AdminAuth] signUp error:', error);
			const message = error instanceof Error ? error.message : 'Sign up failed';
			this.error = message;
			return { success: false, error: message };
		}
	}

	async signOut(): Promise<void> {
		if (!browser) return;

		try {
			if (this.client) {
				await this.client.action(api.auth.signOut, {});
			}
		} catch (error) {
			console.error('[AdminAuth] Sign out error:', error);
		} finally {
			clearTokens();
			if (this.client) {
				// Clear auth by providing a fetcher that returns null
				this.client.setAuth(async () => null);
			}
			this.state = 'unauthenticated';
			this.userId = null;
			this.isAdmin = false;
		}
	}
}

export const adminAuth = new AdminAuth();
