import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAuth, checkAuth } from './authCheck';

// Query: Get all chores
export const list = query({
	args: { accessKey: v.optional(v.string()) },
	handler: async (ctx, { accessKey }) => {
		const authorized = await checkAuth(ctx, accessKey);
		if (!authorized) return [];
		return await ctx.db.query('chores').collect();
	}
});

// Query: Get chores modified since timestamp (for delta sync)
export const listSince = query({
	args: { since: v.number(), accessKey: v.optional(v.string()) },
	handler: async (ctx, { since, accessKey }) => {
		const authorized = await checkAuth(ctx, accessKey);
		if (!authorized) return [];
		return await ctx.db
			.query('chores')
			.withIndex('by_last_modified', (q) => q.gt('lastModified', since))
			.collect();
	}
});

// Mutation: Create chore
export const create = mutation({
	args: {
		clientId: v.string(),
		text: v.string(),
		isCompleted: v.boolean(),
		completedAt: v.optional(v.string()),
		completedBy: v.optional(v.string()),
		lastModified: v.number(),
		accessKey: v.optional(v.string())
	},
	handler: async (ctx, { accessKey, ...args }) => {
		await requireAuth(ctx, accessKey);

		// Check if already exists (idempotent for retry safety)
		const existing = await ctx.db
			.query('chores')
			.withIndex('by_client_id', (q) => q.eq('clientId', args.clientId))
			.first();

		if (existing) {
			// Already synced, return existing
			return existing._id;
		}

		return await ctx.db.insert('chores', {
			clientId: args.clientId,
			text: args.text,
			isCompleted: args.isCompleted,
			completedAt: args.completedAt,
			completedBy: args.completedBy,
			lastModified: args.lastModified
		});
	}
});

// Mutation: Update chore (by clientId for offline-first support)
export const update = mutation({
	args: {
		id: v.string(), // clientId, not Convex _id
		text: v.optional(v.string()),
		isCompleted: v.optional(v.boolean()),
		completedAt: v.optional(v.string()),
		completedBy: v.optional(v.string()),
		lastModified: v.number(),
		accessKey: v.optional(v.string())
	},
	handler: async (ctx, { id: clientId, lastModified, accessKey, ...updates }) => {
		await requireAuth(ctx, accessKey);

		// Look up by clientId
		const existing = await ctx.db
			.query('chores')
			.withIndex('by_client_id', (q) => q.eq('clientId', clientId))
			.first();

		if (!existing) {
			console.log(`[chores.update] Chore with clientId ${clientId} not found, skipping`);
			return null;
		}

		// Last-write-wins: only apply if newer
		if (lastModified > existing.lastModified) {
			await ctx.db.patch(existing._id, { ...updates, lastModified });
		}

		return existing._id;
	}
});

// Mutation: Delete chore (by clientId for offline-first support)
export const remove = mutation({
	args: { id: v.string(), accessKey: v.optional(v.string()) },
	handler: async (ctx, { id: clientId, accessKey }) => {
		await requireAuth(ctx, accessKey);

		// Look up by clientId
		const existing = await ctx.db
			.query('chores')
			.withIndex('by_client_id', (q) => q.eq('clientId', clientId))
			.first();

		if (existing) {
			await ctx.db.delete(existing._id);
		}
		// Idempotent: no error if already deleted
		return clientId;
	}
});
