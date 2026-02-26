import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireAuth, checkAuth } from './authCheck';

// Generate a short-lived URL for uploading a photo
export const generateUploadUrl = mutation({
	args: { accessKey: v.optional(v.string()) },
	handler: async (ctx, { accessKey }) => {
		await requireAuth(ctx, accessKey);
		return await ctx.storage.generateUploadUrl();
	}
});

// Attach uploaded photo to a daily chore
// Verifies the storage blob is non-empty before attaching to prevent
// 0-byte uploads from bad wifi being linked to chores
export const attachPhotoToChore = mutation({
	args: {
		dailyChoreClientId: v.string(),
		storageId: v.id('_storage'),
		thumbnailStorageId: v.optional(v.id('_storage')),
		capturedAt: v.number(),
		capturedBy: v.string(),
		accessKey: v.optional(v.string())
	},
	handler: async (ctx, { accessKey, ...args }) => {
		await requireAuth(ctx, accessKey);

		// Verify the photo blob actually has data (not a 0-byte truncated upload)
		const photoMeta = await ctx.db.system.get(args.storageId);
		if (!photoMeta || photoMeta.size === 0) {
			// Clean up the empty storage entry
			await ctx.storage.delete(args.storageId);
			throw new Error('Photo upload was empty — blob was truncated during transfer');
		}

		// Verify thumbnail if provided (non-critical — skip if empty)
		let thumbnailStorageId = args.thumbnailStorageId;
		if (thumbnailStorageId) {
			const thumbMeta = await ctx.db.system.get(thumbnailStorageId);
			if (!thumbMeta || thumbMeta.size === 0) {
				await ctx.storage.delete(thumbnailStorageId);
				thumbnailStorageId = undefined;
			}
		}

		const chore = await ctx.db
			.query('dailyChores')
			.withIndex('by_client_id', (q) => q.eq('clientId', args.dailyChoreClientId))
			.first();

		if (!chore) {
			throw new Error(`Daily chore not found: ${args.dailyChoreClientId}`);
		}

		await ctx.db.patch(chore._id, {
			photoStorageId: args.storageId,
			thumbnailStorageId,
			photoCapturedAt: args.capturedAt,
			photoCapturedBy: args.capturedBy,
			photoStatus: 'uploaded',
			lastModified: Date.now()
		});

		return { success: true };
	}
});

// Get the serving URL for a photo
export const getPhotoUrl = query({
	args: { storageId: v.id('_storage'), accessKey: v.optional(v.string()) },
	handler: async (ctx, { storageId, accessKey }) => {
		const authorized = await checkAuth(ctx, accessKey);
		if (!authorized) return null;
		return await ctx.storage.getUrl(storageId);
	}
});

// Clear photoStatus on a chore when photo upload permanently fails
// Only clears photoStatus (not photoStorageId) since no blob was ever uploaded
export const clearPhotoStatus = mutation({
	args: {
		dailyChoreClientId: v.string(),
		accessKey: v.optional(v.string())
	},
	handler: async (ctx, { accessKey, dailyChoreClientId }) => {
		await requireAuth(ctx, accessKey);

		const chore = await ctx.db
			.query('dailyChores')
			.withIndex('by_client_id', (q) => q.eq('clientId', dailyChoreClientId))
			.first();

		if (!chore) return { success: true };

		if (chore.photoStatus === 'pending') {
			await ctx.db.patch(chore._id, {
				photoStatus: undefined,
				lastModified: Date.now()
			});
		}

		return { success: true };
	}
});

// Get photo URL for a specific daily chore
export const getPhotoUrlByChore = query({
	args: { dailyChoreClientId: v.string(), accessKey: v.optional(v.string()) },
	handler: async (ctx, { dailyChoreClientId, accessKey }) => {
		const authorized = await checkAuth(ctx, accessKey);
		if (!authorized) return null;

		const chore = await ctx.db
			.query('dailyChores')
			.withIndex('by_client_id', (q) => q.eq('clientId', dailyChoreClientId))
			.first();

		if (!chore?.photoStorageId) {
			return null;
		}

		return await ctx.storage.getUrl(chore.photoStorageId);
	}
});
