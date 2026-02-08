import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

// Find today's daily chore linked to a master chore
async function findTodaysDailyChore(
	ctx: MutationCtx,
	todayDate: string,
	masterId: Id<'masterChores'>
) {
	return await ctx.db
		.query('dailyChores')
		.withIndex('by_date_master', (q) => q.eq('date', todayDate).eq('masterChoreId', masterId))
		.first();
}

// List all master chores (admin only)
export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		const user = await ctx.db.get(userId);
		if (!user?.isAdmin) return [];

		return await ctx.db.query('masterChores').order('asc').collect();
	}
});

// Create master chore (admin only)
// If todayDate is provided and today's daily list exists, also adds the chore to today
export const create = mutation({
	args: {
		text: v.string(),
		description: v.optional(v.string()),
		timeSlot: v.string(),
		animalCategory: v.string(),
		sortOrder: v.optional(v.number()),
		requiresPhoto: v.optional(v.boolean()),
		todayDate: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Not authenticated');

		const user = await ctx.db.get(userId);
		if (!user?.isAdmin) throw new Error('Admin required');

		// Get max sortOrder for this time slot if not provided
		let sortOrder = args.sortOrder;
		if (sortOrder === undefined) {
			const slotChores = await ctx.db
				.query('masterChores')
				.withIndex('by_time_slot', (q) => q.eq('timeSlot', args.timeSlot))
				.collect();
			const maxOrder = slotChores.length > 0 ? Math.max(...slotChores.map((c) => c.sortOrder)) : 0;
			sortOrder = maxOrder + 1;
		}

		const now = Date.now();
		const masterId = await ctx.db.insert('masterChores', {
			text: args.text,
			description: args.description,
			timeSlot: args.timeSlot,
			animalCategory: args.animalCategory,
			sortOrder,
			isActive: true,
			requiresPhoto: args.requiresPhoto,
			createdBy: userId,
			createdAt: now,
			updatedAt: now
		});

		// Sync to today's daily list if it already exists
		if (args.todayDate) {
			const todayExists = await ctx.db
				.query('dailyChores')
				.withIndex('by_date', (q) => q.eq('date', args.todayDate!))
				.first();

			if (todayExists) {
				await ctx.db.insert('dailyChores', {
					date: args.todayDate,
					masterChoreId: masterId,
					clientId: crypto.randomUUID(),
					text: args.text,
					description: args.description,
					timeSlot: args.timeSlot,
					animalCategory: args.animalCategory,
					sortOrder,
					isCompleted: false,
					isAdHoc: false,
					requiresPhoto: args.requiresPhoto ?? false,
					lastModified: now
				});
			}
		}

		return masterId;
	}
});

// Update master chore (admin only)
// If todayDate is provided, also syncs changes to today's daily chore (if not completed)
export const update = mutation({
	args: {
		id: v.id('masterChores'),
		text: v.optional(v.string()),
		description: v.optional(v.string()),
		timeSlot: v.optional(v.string()),
		animalCategory: v.optional(v.string()),
		sortOrder: v.optional(v.number()),
		isActive: v.optional(v.boolean()),
		requiresPhoto: v.optional(v.boolean()),
		todayDate: v.optional(v.string())
	},
	handler: async (ctx, { id, todayDate, ...updates }) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Not authenticated');

		const user = await ctx.db.get(userId);
		if (!user?.isAdmin) throw new Error('Admin required');

		const existing = await ctx.db.get(id);
		if (!existing) throw new Error('Chore not found');

		// Filter out undefined values
		const patch: Record<string, unknown> = { updatedAt: Date.now() };
		if (updates.text !== undefined) patch.text = updates.text;
		if (updates.description !== undefined) patch.description = updates.description;
		if (updates.timeSlot !== undefined) patch.timeSlot = updates.timeSlot;
		if (updates.animalCategory !== undefined) patch.animalCategory = updates.animalCategory;
		if (updates.sortOrder !== undefined) patch.sortOrder = updates.sortOrder;
		if (updates.isActive !== undefined) patch.isActive = updates.isActive;
		if (updates.requiresPhoto !== undefined) patch.requiresPhoto = updates.requiresPhoto;

		await ctx.db.patch(id, patch);

		// Sync to today's daily chore
		if (todayDate) {
			const dailyChore = await findTodaysDailyChore(ctx, todayDate, id);
			if (dailyChore && !dailyChore.isCompleted) {
				const dailyPatch: Record<string, unknown> = { lastModified: Date.now() };
				if (updates.text !== undefined) dailyPatch.text = updates.text;
				if (updates.description !== undefined) dailyPatch.description = updates.description;
				if (updates.timeSlot !== undefined) dailyPatch.timeSlot = updates.timeSlot;
				if (updates.animalCategory !== undefined)
					dailyPatch.animalCategory = updates.animalCategory;
				if (updates.sortOrder !== undefined) dailyPatch.sortOrder = updates.sortOrder;
				if (updates.requiresPhoto !== undefined) dailyPatch.requiresPhoto = updates.requiresPhoto;
				await ctx.db.patch(dailyChore._id, dailyPatch);
			}
		}
	}
});

// Delete master chore (soft delete via isActive)
// If todayDate is provided, also removes today's daily chore (if not completed)
export const remove = mutation({
	args: { id: v.id('masterChores'), todayDate: v.optional(v.string()) },
	handler: async (ctx, { id, todayDate }) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Not authenticated');

		const user = await ctx.db.get(userId);
		if (!user?.isAdmin) throw new Error('Admin required');

		const existing = await ctx.db.get(id);
		if (!existing) throw new Error('Chore not found');

		await ctx.db.patch(id, {
			isActive: false,
			updatedAt: Date.now()
		});

		// Remove from today's daily list if not completed
		if (todayDate) {
			const dailyChore = await findTodaysDailyChore(ctx, todayDate, id);
			if (dailyChore && !dailyChore.isCompleted) {
				await ctx.db.delete(dailyChore._id);
			}
		}
	}
});
