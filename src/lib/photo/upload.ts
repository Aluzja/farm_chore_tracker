import type { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export interface PhotoUploadResult {
	storageId: Id<'_storage'>;
	success: boolean;
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
	capturedBy: string
): Promise<PhotoUploadResult> {
	// Step 1: Get upload URL from Convex
	const uploadUrl = await client.mutation(api.photos.generateUploadUrl, {});

	// Step 2: Upload blob to the URL
	const response = await fetch(uploadUrl, {
		method: 'POST',
		headers: { 'Content-Type': blob.type },
		body: blob
	});

	if (!response.ok) {
		throw new Error(`Photo upload failed: ${response.status} ${response.statusText}`);
	}

	const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };

	// Step 3: Attach photo to the daily chore
	await client.mutation(api.photos.attachPhotoToChore, {
		dailyChoreClientId,
		storageId,
		capturedAt,
		capturedBy
	});

	return { storageId, success: true };
}

/**
 * Get the URL for viewing a photo.
 */
export async function getPhotoViewUrl(
	client: ConvexClient,
	storageId: Id<'_storage'>
): Promise<string | null> {
	return await client.query(api.photos.getPhotoUrl, { storageId });
}
