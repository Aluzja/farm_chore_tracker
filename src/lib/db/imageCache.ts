import { browser } from '$app/environment';
import { getDB } from './client';
import { STORES, type ImageCacheEntry } from './schema';

// Max cache size in bytes (50MB)
const MAX_CACHE_SIZE = 50 * 1024 * 1024;
// Max age for cached images (7 days)
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Get a cached image by storage ID
 * Returns a blob URL if cached, null otherwise
 */
export async function getCachedImage(storageId: string): Promise<string | null> {
	if (!browser) return null;

	try {
		const db = await getDB();
		const entry = await db.get(STORES.imageCache, storageId);

		if (!entry) return null;

		// Check if cache is expired
		if (Date.now() - entry.cachedAt > MAX_CACHE_AGE) {
			// Delete expired entry
			await db.delete(STORES.imageCache, storageId);
			return null;
		}

		// Create blob URL from cached blob
		return URL.createObjectURL(entry.blob);
	} catch (error) {
		console.error('[ImageCache] Error getting cached image:', error);
		return null;
	}
}

/**
 * Cache an image from a URL
 * Fetches the image and stores the blob in IndexedDB
 */
export async function cacheImage(storageId: string, url: string): Promise<string | null> {
	if (!browser) return null;

	try {
		// Fetch the image
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.status}`);
		}

		const blob = await response.blob();
		const mimeType = blob.type || 'image/jpeg';

		const entry: ImageCacheEntry = {
			storageId,
			blob,
			mimeType,
			cachedAt: Date.now(),
			size: blob.size
		};

		const db = await getDB();
		await db.put(STORES.imageCache, entry);

		// Clean up old cache entries if needed
		await cleanupCache();

		// Return blob URL
		return URL.createObjectURL(blob);
	} catch (error) {
		console.error('[ImageCache] Error caching image:', error);
		return null;
	}
}

/**
 * Get or fetch a cached image
 * Returns cached version if available, otherwise fetches and caches
 */
export async function getOrCacheImage(storageId: string, url: string): Promise<string | null> {
	// Try to get from cache first
	const cached = await getCachedImage(storageId);
	if (cached) {
		return cached;
	}

	// Fetch and cache
	return cacheImage(storageId, url);
}

/**
 * Remove a cached image
 */
export async function removeCachedImage(storageId: string): Promise<void> {
	if (!browser) return;

	try {
		const db = await getDB();
		await db.delete(STORES.imageCache, storageId);
	} catch (error) {
		console.error('[ImageCache] Error removing cached image:', error);
	}
}

/**
 * Clean up old or excess cache entries
 */
async function cleanupCache(): Promise<void> {
	try {
		const db = await getDB();
		const tx = db.transaction(STORES.imageCache, 'readwrite');
		const store = tx.objectStore(STORES.imageCache);
		const index = store.index('by-cached-at');

		// Get all entries sorted by cached time (oldest first)
		const entries = await index.getAll();

		let totalSize = 0;
		const now = Date.now();
		const toDelete: string[] = [];

		// Calculate total size and mark old entries for deletion
		for (const entry of entries) {
			// Delete expired entries
			if (now - entry.cachedAt > MAX_CACHE_AGE) {
				toDelete.push(entry.storageId);
				continue;
			}
			totalSize += entry.size;
		}

		// If still over limit, delete oldest entries
		if (totalSize > MAX_CACHE_SIZE) {
			for (const entry of entries) {
				if (toDelete.includes(entry.storageId)) continue;

				toDelete.push(entry.storageId);
				totalSize -= entry.size;

				if (totalSize <= MAX_CACHE_SIZE * 0.8) {
					// Keep 20% buffer
					break;
				}
			}
		}

		// Delete marked entries
		for (const storageId of toDelete) {
			await store.delete(storageId);
		}

		await tx.done;

		if (toDelete.length > 0) {
			console.log(`[ImageCache] Cleaned up ${toDelete.length} entries`);
		}
	} catch (error) {
		console.error('[ImageCache] Error cleaning up cache:', error);
	}
}

/**
 * Clear entire image cache
 */
export async function clearImageCache(): Promise<void> {
	if (!browser) return;

	try {
		const db = await getDB();
		await db.clear(STORES.imageCache);
		console.log('[ImageCache] Cache cleared');
	} catch (error) {
		console.error('[ImageCache] Error clearing cache:', error);
	}
}
