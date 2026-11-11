import { browser } from '$app/environment';
import type { ConvexClient } from 'convex/browser';
import { getConvexClient } from '$lib/sync/engine.svelte';
import { api } from '../../convex/_generated/api';
import { withTimeout } from '$lib/utils/timeout';

const ACCESS_KEY_STORAGE = 'kitchen_sink_access_key';
const VALIDATION_CACHE_STORAGE = 'kitchen_sink_key_validation';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ValidationCache {
	key: string;
	valid: boolean;
	displayName?: string;
	validatedAt: number;
}

// Get stored access key from localStorage
export function getStoredAccessKey(): string | null {
	if (!browser) return null;
	return localStorage.getItem(ACCESS_KEY_STORAGE);
}

// Store access key in localStorage
export function storeAccessKey(key: string): void {
	if (!browser) return;
	localStorage.setItem(ACCESS_KEY_STORAGE, key);
}

// Clear stored access key
export function clearAccessKey(): void {
	if (!browser) return;
	localStorage.removeItem(ACCESS_KEY_STORAGE);
	localStorage.removeItem(VALIDATION_CACHE_STORAGE);
}

// Get cached validation result for this key (for offline use)
export function getCachedValidation(key: string): ValidationCache | null {
	if (!browser) return null;
	const cached = localStorage.getItem(VALIDATION_CACHE_STORAGE);
	if (!cached) return null;

	try {
		const parsed = JSON.parse(cached) as ValidationCache;
		// Ignore results cached for a different key (e.g. an earlier typo)
		if (parsed.key !== key) return null;
		// Check if cache is still valid
		if (Date.now() - parsed.validatedAt < CACHE_DURATION_MS) {
			return parsed;
		}
		// Cache expired
		localStorage.removeItem(VALIDATION_CACHE_STORAGE);
		return null;
	} catch {
		return null;
	}
}

// Cache validation result
function cacheValidation(key: string, valid: boolean, displayName?: string): void {
	if (!browser) return;
	const cache: ValidationCache = {
		key,
		valid,
		displayName,
		validatedAt: Date.now()
	};
	localStorage.setItem(VALIDATION_CACHE_STORAGE, JSON.stringify(cache));
}

// Validate access key against Convex
export async function validateAccessKey(
	key: string,
	client?: ConvexClient | null
): Promise<{
	valid: boolean;
	reason?: 'not_found' | 'revoked' | 'unreachable';
	displayName?: string;
}> {
	const fromCache = () => {
		const cached = getCachedValidation(key);
		if (cached) return { valid: cached.valid, displayName: cached.displayName };
		return { valid: false, reason: 'unreachable' as const };
	};

	const convexClient = client || getConvexClient();
	if (!convexClient) return fromCache();

	try {
		const result = await withTimeout(convexClient.query(api.accessKeys.validate, { key }));

		// Cache the result
		cacheValidation(key, result.valid, result.valid ? result.displayName : undefined);

		// Record usage if valid
		if (result.valid) {
			// Fire and forget - don't await
			convexClient.mutation(api.accessKeys.recordUsage, { key }).catch(() => {
				// Ignore errors recording usage
			});
		}

		return result;
	} catch {
		// Network error or timeout - check cache
		return fromCache();
	}
}

// Extract key from URL and clean up
export function extractKeyFromUrl(url: URL): string | null {
	const key = url.searchParams.get('key');
	return key;
}
