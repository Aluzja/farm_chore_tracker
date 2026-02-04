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
export const attachPhotoToChore = mutation({
	args: {
		dailyChoreClientId: v.string(),
		storageId: v.id('_storage'),
		capturedAt: v.number(),
		capturedBy: v.string(),
		accessKey: v.optional(v.string())
	},
	handler: async (ctx, { accessKey, ...args }) => {
		await requireAuth(ctx, accessKey);

		const chore = await ctx.db
			.query('dailyChores')
			.withIndex('by_client_id', (q) => q.eq('clientId', args.dailyChoreClientId))
			.first();

		if (!chore) {
			throw new Error(`Daily chore not found: ${args.dailyChoreClientId}`);
		}

		await ctx.db.patch(chore._id, {
			photoStorageId: args.storageId,
			photoCapturedAt: args.capturedAt,
			photoCapturedBy: args.capturedBy,
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
