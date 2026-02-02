import { browser } from '$app/environment';
import { getConvexClient } from '$lib/sync/engine.svelte';
import { api } from '../../convex/_generated/api';

const ACCESS_KEY_STORAGE = 'kitchen_sink_access_key';
const VALIDATION_CACHE_STORAGE = 'kitchen_sink_key_validation';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ValidationCache {
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

// Get cached validation result (for offline use)
export function getCachedValidation(): ValidationCache | null {
  if (!browser) return null;
  const cached = localStorage.getItem(VALIDATION_CACHE_STORAGE);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached) as ValidationCache;
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
function cacheValidation(valid: boolean, displayName?: string): void {
  if (!browser) return;
  const cache: ValidationCache = {
    valid,
    displayName,
    validatedAt: Date.now(),
  };
  localStorage.setItem(VALIDATION_CACHE_STORAGE, JSON.stringify(cache));
}

// Validate access key against Convex
export async function validateAccessKey(key: string, client?: any): Promise<{
  valid: boolean;
  reason?: 'not_found' | 'revoked';
  displayName?: string;
}> {
  const convexClient = client || getConvexClient();
  if (!convexClient) {
    // Offline - check cache
    const cached = getCachedValidation();
    if (cached) {
      return { valid: cached.valid, displayName: cached.displayName };
    }
    // No cache, can't validate
    return { valid: false, reason: 'not_found' };
  }

  try {
    const result = await convexClient.query(api.accessKeys.validate, { key });

    // Cache the result
    cacheValidation(result.valid, result.valid ? result.displayName : undefined);

    // Record usage if valid
    if (result.valid) {
      // Fire and forget - don't await
      convexClient.mutation(api.accessKeys.recordUsage, { key }).catch(() => {
        // Ignore errors recording usage
      });
    }

    return result;
  } catch {
    // Network error - check cache
    const cached = getCachedValidation();
    if (cached) {
      return { valid: cached.valid, displayName: cached.displayName };
    }
    return { valid: false, reason: 'not_found' };
  }
}

// Extract key from URL and clean up
export function extractKeyFromUrl(url: URL): string | null {
  const key = url.searchParams.get('key');
  return key;
}
