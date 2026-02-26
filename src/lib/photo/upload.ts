import type { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { getStoredAccessKey } from '$lib/auth/access-key';

const MUTATION_TIMEOUT_MS = 15_000; // 15s for Convex mutations
const UPLOAD_TIMEOUT_MS = 60_000; // 60s for blob upload

export interface PhotoUploadResult {
	storageId: Id<'_storage'>;
	thumbnailStorageId?: Id<'_storage'>;
	success: boolean;
}

/**
 * Run a promise with a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
		)
	]);
}

/**
 * Upload a photo blob to Convex file storage and attach it to a daily chore.
 *
 * This uses Convex's three-step upload pattern:
 * 1. Generate a short-lived upload URL
 * 2. POST the blob to that URL
 * 3. Attach the resulting storageId to the daily chore
 */
export async function uploadPhoto(
	client: ConvexClient,
	blob: Blob,
	dailyChoreClientId: string,
	capturedAt: number,
	capturedBy: string,
	thumbnailBlob?: Blob,
	signal?: AbortSignal
): Promise<PhotoUploadResult> {
	const accessKey = getStoredAccessKey() ?? undefined;

	// Validate blob before wasting a network round-trip
	if (!blob || blob.size === 0) {
		throw new Error('Cannot upload empty photo blob');
	}

	// Step 1: Get upload URL from Convex
	const uploadUrl = await withTimeout(
		client.mutation(api.photos.generateUploadUrl, { accessKey }),
		MUTATION_TIMEOUT_MS,
		'generateUploadUrl'
	);

	// Step 2: Upload blob to the URL with timeout via AbortController
	const uploadController = new AbortController();
	const uploadTimer = setTimeout(() => uploadController.abort(), UPLOAD_TIMEOUT_MS);

	// If an external signal is provided, propagate abort
	if (signal) {
		signal.addEventListener('abort', () => uploadController.abort(), { once: true });
	}

	let response: Response;
	try {
		response = await fetch(uploadUrl, {
			method: 'POST',
			headers: { 'Content-Type': blob.type },
			body: blob,
			signal: uploadController.signal
		});
	} finally {
		clearTimeout(uploadTimer);
	}

	if (!response.ok) {
		throw new Error(`Photo upload failed: ${response.status} ${response.statusText}`);
	}

	const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };

	// Step 2b: Upload thumbnail if provided (non-critical — continue without it)
	let thumbnailStorageId: Id<'_storage'> | undefined;
	if (thumbnailBlob) {
		try {
			const thumbUploadUrl = await withTimeout(
				client.mutation(api.photos.generateUploadUrl, { accessKey }),
				MUTATION_TIMEOUT_MS,
				'generateUploadUrl (thumbnail)'
			);

			const thumbController = new AbortController();
			const thumbTimer = setTimeout(() => thumbController.abort(), UPLOAD_TIMEOUT_MS);

			if (signal) {
				signal.addEventListener('abort', () => thumbController.abort(), { once: true });
			}

			try {
				const thumbResponse = await fetch(thumbUploadUrl, {
					method: 'POST',
					headers: { 'Content-Type': thumbnailBlob.type },
					body: thumbnailBlob,
					signal: thumbController.signal
				});

				if (thumbResponse.ok) {
					const thumbResult = (await thumbResponse.json()) as {
						storageId: Id<'_storage'>;
					};
					thumbnailStorageId = thumbResult.storageId;
				}
			} finally {
				clearTimeout(thumbTimer);
			}
		} catch (error) {
			console.warn('[Photo] Thumbnail upload failed, continuing without it:', error);
		}
	}

	// Step 3: Attach photo to the daily chore
	await withTimeout(
		client.mutation(api.photos.attachPhotoToChore, {
			dailyChoreClientId,
			storageId,
			thumbnailStorageId,
			capturedAt,
			capturedBy,
			accessKey
		}),
		MUTATION_TIMEOUT_MS,
		'attachPhotoToChore'
	);

	return { storageId, thumbnailStorageId, success: true };
}

/**
 * Get the URL for viewing a photo.
 */
export async function getPhotoViewUrl(
	client: ConvexClient,
	storageId: Id<'_storage'>
): Promise<string | null> {
	const accessKey = getStoredAccessKey() ?? undefined;
	return await client.query(api.photos.getPhotoUrl, { storageId, accessKey });
}
