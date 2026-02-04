import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { requireAuth, checkAuth } from './authCheck';

// Get or create daily list for a date
// Returns chores array if exists, or { needsClone: true, date } if needs cloning
export const getOrCreateDailyList = query({
	args: { date: v.string(), accessKey: v.optional(v.string()) },
	handler: async (ctx, { date, accessKey }) => {
		const authorized = await checkAuth(ctx, accessKey);
		if (!authorized) return [];

		const targetDate = date;

		// Check if daily list already exists
		const existing = await ctx.db
			.query('dailyChores')
			.withIndex('by_date', (q) => q.eq('date', targetDate))
			.collect();

		if (existing.length > 0) {
			return existing;
		}

		// No daily list yet - this triggers a mutation to clone
		return { needsClone: true, date: targetDate };
	}
});

// Clone master list to create daily list for a given date
// Idempotent - safe to call multiple times
export const cloneMasterToDaily = mutation({
	args: { date: v.string(), accessKey: v.optional(v.string()) },
	handler: async (ctx, { date, accessKey }) => {
		await requireAuth(ctx, accessKey);

		// Prevent duplicate cloning - check if any daily chores exist for this date
		const existing = await ctx.db
			.query('dailyChores')
			.withIndex('by_date', (q) => q.eq('date', date))
			.first();

		if (existing) {
			// Already cloned, return existing daily chores
			return await ctx.db
				.query('dailyChores')
				.withIndex('by_date', (q) => q.eq('date', date))
				.collect();
		}

		// Get active master chores
		const masterChores = await ctx.db
			.query('masterChores')
			.withIndex('by_active', (q) => q.eq('isActive', true))
			.collect();

		// Clone each to daily
		const dailyChores = [];
		const now = Date.now();

		for (const master of masterChores) {
			const clientId = crypto.randomUUID();
			const id = await ctx.db.insert('dailyChores', {
				date,
				masterChoreId: master._id,
				clientId,
				text: master.text,
				description: master.description,
				timeSlot: master.timeSlot,
				animalCategory: master.animalCategory,
				sortOrder: master.sortOrder,
				isCompleted: false,
				isAdHoc: false,
				requiresPhoto: master.requiresPhoto ?? false,
				lastModified: now
			});
			const inserted = await ctx.db.get(id);
			if (inserted) dailyChores.push(inserted);
		}

		return dailyChores;
	}
});

// Toggle completion status of a daily chore
// Uses clientId for offline-first compatibility
export const toggleComplete = mutation({
	args: {
		clientId: v.string(),
		isCompleted: v.boolean(),
		completedAt: v.optional(v.string()),
		completedBy: v.optional(v.string()),
		lastModified: v.number(),
		accessKey: v.optional(v.string())
	},
	handler: async (ctx, { clientId, lastModified, accessKey, ...updates }) => {
		await requireAuth(ctx, accessKey);

		const existing = await ctx.db
			.query('dailyChores')
			.withIndex('by_client_id', (q) => q.eq('clientId', clientId))
			.first();

		if (!existing) {
			console.log(`[dailyChores.toggleComplete] Chore ${clientId} not found`);
			return null;
		}

		// Last-write-wins: only apply if newer
		if (lastModified > existing.lastModified) {
			await ctx.db.patch(existing._id, {
				...updates,
				lastModified
			});
		}

		return existing._id;
	}
});

// Reset daily list for a given date (deletes all daily chores for that date)
// Use this to re-clone from master after adding new master chores
export const resetTodaysList = mutation({
	args: { date: v.string(), accessKey: v.optional(v.string()) },
	handler: async (ctx, { date, accessKey }) => {
		await requireAuth(ctx, accessKey);

		const chores = await ctx.db
			.query('dailyChores')
			.withIndex('by_date', (q) => q.eq('date', date))
			.collect();

		for (const chore of chores) {
			await ctx.db.delete(chore._id);
		}

		return { deleted: chores.length, date };
	}
});

// Get completed chores from past N days for history view
export const getHistory = query({
	args: { daysBack: v.optional(v.number()), accessKey: v.optional(v.string()) },
	handler: async (ctx, { daysBack = 7, accessKey }) => {
		const authorized = await checkAuth(ctx, accessKey);
		if (!authorized) return [];

		const today = new Date();
		const startDate = new Date(today);
		startDate.setDate(today.getDate() - daysBack);
		const startDateStr = startDate.toISOString().split('T')[0];

		// Get completed chores from startDate onwards
		const chores = await ctx.db
			.query('dailyChores')
			.withIndex('by_date', (q) => q.gte('date', startDateStr))
			.filter((q) => q.eq(q.field('isCompleted'), true))
			.collect();

		// Sort by date descending, then by completedAt descending
		return chores.sort((a, b) => {
			if (a.date !== b.date) return b.date.localeCompare(a.date);
			const aTime = a.completedAt ?? '';
			const bTime = b.completedAt ?? '';
			return bTime.localeCompare(aTime);
		});
	}
});

// Add ad-hoc chore for a given date
// Idempotent via clientId check
export const addAdHoc = mutation({
	args: {
		clientId: v.string(),
		text: v.string(),
		description: v.optional(v.string()),
		timeSlot: v.string(),
		animalCategory: v.string(),
		date: v.string(),
		createdBy: v.optional(v.string()),
		lastModified: v.number(),
		accessKey: v.optional(v.string())
	},
	handler: async (ctx, { accessKey, ...args }) => {
		await requireAuth(ctx, accessKey);

		// Idempotent: check if already exists
		const existing = await ctx.db
			.query('dailyChores')
			.withIndex('by_client_id', (q) => q.eq('clientId', args.clientId))
			.first();

		if (existing) return existing._id;

		// Get max sortOrder for this time slot on this date
		const slotChores = await ctx.db
			.query('dailyChores')
			.withIndex('by_date_time_slot', (q) => q.eq('date', args.date).eq('timeSlot', args.timeSlot))
			.collect();
		const maxOrder = slotChores.length > 0 ? Math.max(...slotChores.map((c) => c.sortOrder)) : 0;

		return await ctx.db.insert('dailyChores', {
			date: args.date,
			masterChoreId: undefined,
			clientId: args.clientId,
			text: args.text,
			description: args.description,
			timeSlot: args.timeSlot,
			animalCategory: args.animalCategory,
			sortOrder: maxOrder + 1,
			isCompleted: false,
			isAdHoc: true,
			requiresPhoto: false,
			lastModified: args.lastModified
		});
	}
});

// Add ad-hoc chore for a given date (admin only)
// This is a server-side mutation for admin use, generates its own clientId
export const addAdHocAdmin = mutation({
	args: {
		text: v.string(),
		description: v.optional(v.string()),
		timeSlot: v.string(),
		animalCategory: v.string(),
		date: v.string(),
		requiresPhoto: v.optional(v.boolean())
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Not authenticated');

		const user = await ctx.db.get(userId);
		if (!user?.isAdmin) throw new Error('Admin required');

		const now = Date.now();
		const clientId = crypto.randomUUID();

		// Get max sortOrder for this time slot on this date
		const slotChores = await ctx.db
			.query('dailyChores')
			.withIndex('by_date_time_slot', (q) => q.eq('date', args.date).eq('timeSlot', args.timeSlot))
			.collect();
		const maxOrder = slotChores.length > 0 ? Math.max(...slotChores.map((c) => c.sortOrder)) : 0;

		return await ctx.db.insert('dailyChores', {
			date: args.date,
			masterChoreId: undefined,
			clientId,
			text: args.text,
			description: args.description,
			timeSlot: args.timeSlot,
			animalCategory: args.animalCategory,
			sortOrder: maxOrder + 1,
			isCompleted: false,
			isAdHoc: true,
			requiresPhoto: args.requiresPhoto ?? false,
			lastModified: now
		});
	}
});
