import { browser } from '$app/environment';
import { getDB } from '$lib/db/client';
import type { PhotoQueueEntry } from '$lib/db/schema';
import { PHOTO_BACKOFF_MS } from '$lib/sync/engine.svelte';

/**
 * Add a photo to the upload queue.
 */
export async function enqueuePhoto(
	entry: Omit<PhotoQueueEntry, 'retryCount' | 'lastAttemptAt'>
): Promise<void> {
	if (!browser) return;
	const db = await getDB();
	await db.put('photoQueue', {
		...entry,
		retryCount: 0
	});
}

/**
 * Get all photos pending upload, ordered by capture time.
 */
export async function getPhotoQueue(): Promise<PhotoQueueEntry[]> {
	if (!browser) return [];
	const db = await getDB();
	return db.getAllFromIndex('photoQueue', 'by-captured-at');
}

/**
 * Get count of pending photos (not failed).
 */
export async function getPendingPhotoCount(): Promise<number> {
	if (!browser) return 0;
	const db = await getDB();
	const all = await db.getAllFromIndex('photoQueue', 'by-upload-status', 'pending');
	return all.length;
}

/**
 * Remove a photo from the queue after successful upload.
 */
export async function removePhoto(id: string): Promise<void> {
	if (!browser) return;
	const db = await getDB();
	await db.delete('photoQueue', id);
}

/**
 * Increment retry count and update status with exponential backoff.
 */
export async function incrementPhotoRetry(id: string): Promise<number> {
	if (!browser) return 0;
	const db = await getDB();
	const entry = await db.get('photoQueue', id);
	if (!entry) return 0;

	const newRetryCount = entry.retryCount + 1;
	const backoffIndex = Math.min(newRetryCount - 1, PHOTO_BACKOFF_MS.length - 1);
	const backoffMs = PHOTO_BACKOFF_MS[backoffIndex];

	const updated: PhotoQueueEntry = {
		...entry,
		retryCount: newRetryCount,
		lastAttemptAt: Date.now(),
		nextRetryAt: Date.now() + backoffMs
	};
	await db.put('photoQueue', updated);
	return updated.retryCount;
}

/**
 * Mark a photo upload as failed (after max retries).
 */
export async function markPhotoFailed(id: string): Promise<void> {
	if (!browser) return;
	const db = await getDB();
	const entry = await db.get('photoQueue', id);
	if (!entry) return;

	await db.put('photoQueue', {
		...entry,
		uploadStatus: 'failed',
		lastAttemptAt: Date.now()
	});
}

/**
 * Update status to 'uploading' when upload starts.
 */
export async function markPhotoUploading(id: string): Promise<void> {
	if (!browser) return;
	const db = await getDB();
	const entry = await db.get('photoQueue', id);
	if (!entry) return;

	await db.put('photoQueue', {
		...entry,
		uploadStatus: 'uploading'
	});
}

/**
 * Get count of failed photo uploads.
 */
export async function getFailedPhotoCount(): Promise<number> {
	if (!browser) return 0;
	const db = await getDB();
	const all = await db.getAllFromIndex('photoQueue', 'by-upload-status', 'failed');
	return all.length;
}

/**
 * Reset failed photos for retry.
 */
export async function resetFailedPhotos(): Promise<number> {
	if (!browser) return 0;
	const db = await getDB();
	const failed = await db.getAllFromIndex('photoQueue', 'by-upload-status', 'failed');

	for (const entry of failed) {
		await db.put('photoQueue', {
			...entry,
			uploadStatus: 'pending',
			retryCount: 0
		});
	}

	return failed.length;
}
