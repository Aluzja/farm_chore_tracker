import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Get today's date string in consistent format
function getTodayDate(): string {
	return new Date().toISOString().split('T')[0];
}

// Get or create daily list for a date
// Returns chores array if exists, or { needsClone: true, date } if needs cloning
export const getOrCreateDailyList = query({
	args: { date: v.optional(v.string()) },
	handler: async (ctx, { date }) => {
		const targetDate = date ?? getTodayDate();

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
	args: { date: v.string() },
	handler: async (ctx, { date }) => {
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
		lastModified: v.number()
	},
	handler: async (ctx, { clientId, lastModified, ...updates }) => {
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

// Reset today's daily list (deletes all daily chores for today)
// Use this to re-clone from master after adding new master chores
export const resetTodaysList = mutation({
	args: {},
	handler: async (ctx) => {
		const today = getTodayDate();

		const todaysChores = await ctx.db
			.query('dailyChores')
			.withIndex('by_date', (q) => q.eq('date', today))
			.collect();

		for (const chore of todaysChores) {
			await ctx.db.delete(chore._id);
		}

		return { deleted: todaysChores.length, date: today };
	}
});

// Get completed chores from past N days for history view
export const getHistory = query({
	args: { daysBack: v.optional(v.number()) },
	handler: async (ctx, { daysBack = 7 }) => {
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

// Add ad-hoc chore for today only
// Idempotent via clientId check
export const addAdHoc = mutation({
	args: {
		clientId: v.string(),
		text: v.string(),
		timeSlot: v.string(),
		animalCategory: v.string(),
		createdBy: v.optional(v.string()),
		lastModified: v.number()
	},
	handler: async (ctx, args) => {
		// Idempotent: check if already exists
		const existing = await ctx.db
			.query('dailyChores')
			.withIndex('by_client_id', (q) => q.eq('clientId', args.clientId))
			.first();

		if (existing) return existing._id;

		const today = getTodayDate();

		// Get max sortOrder for this time slot today
		const slotChores = await ctx.db
			.query('dailyChores')
			.withIndex('by_date_time_slot', (q) => q.eq('date', today).eq('timeSlot', args.timeSlot))
			.collect();
		const maxOrder = slotChores.length > 0 ? Math.max(...slotChores.map((c) => c.sortOrder)) : 0;

		return await ctx.db.insert('dailyChores', {
			date: today,
			masterChoreId: undefined, // No master reference for ad-hoc
			clientId: args.clientId,
			text: args.text,
			timeSlot: args.timeSlot,
			animalCategory: args.animalCategory,
			sortOrder: maxOrder + 1,
			isCompleted: false,
			isAdHoc: true,
			requiresPhoto: false, // Ad-hoc chores don't require photo proof
			lastModified: args.lastModified
		});
	}
});
