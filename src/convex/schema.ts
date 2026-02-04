import { defineSchema, defineTable } from 'convex/server';
import { authTables } from '@convex-dev/auth/server';
import { v } from 'convex/values';

export default defineSchema({
	...authTables,

	// Extend users table with admin flag
	users: defineTable({
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		emailVerificationTime: v.optional(v.number()),
		image: v.optional(v.string()),
		isAdmin: v.optional(v.boolean()) // First user becomes admin (set by checkFirstUserAdmin)
	}).index('email', ['email']),

	// Access keys for URL-based worker access
	accessKeys: defineTable({
		key: v.string(), // The shareable key (e.g., "abc123def456")
		displayName: v.string(), // Human-readable name ("John's Phone")
		createdAt: v.number(),
		createdBy: v.id('users'), // Admin who created this key
		revokedAt: v.optional(v.number()), // Set when key is revoked
		lastUsedAt: v.optional(v.number()) // Track usage
	})
		.index('by_key', ['key'])
		.index('by_created_by', ['createdBy']),

	// Master chore templates (admin-managed)
	masterChores: defineTable({
		text: v.string(), // Chore name (e.g., "Chicken Food")
		description: v.optional(v.string()), // Details (e.g., "2 scoops of feed per coop")
		timeSlot: v.string(), // "morning" | "afternoon" | "evening"
		animalCategory: v.string(), // "chickens" | "goats" | "pigs" | "general" etc.
		sortOrder: v.number(), // Display order within group
		isActive: v.boolean(), // Soft delete / disable
		requiresPhoto: v.optional(v.boolean()), // Admin configures if photo proof needed
		createdBy: v.optional(v.id('users')), // Admin who created
		createdAt: v.number(),
		updatedAt: v.number()
	})
		.index('by_time_slot', ['timeSlot'])
		.index('by_active', ['isActive']),

	// Daily chore instances (cloned from master each day)
	dailyChores: defineTable({
		date: v.string(), // ISO date "2026-02-02"
		masterChoreId: v.optional(v.id('masterChores')), // null for ad-hoc
		clientId: v.string(), // For offline-first idempotency
		text: v.string(),
		description: v.optional(v.string()), // Copied from master on clone
		timeSlot: v.string(),
		animalCategory: v.string(),
		sortOrder: v.number(),
		isCompleted: v.boolean(),
		completedAt: v.optional(v.string()), // ISO datetime
		completedBy: v.optional(v.string()), // Display name
		isAdHoc: v.boolean(), // true for today-only chores
		requiresPhoto: v.boolean(), // Copied from master on clone (defaults false)
		photoStorageId: v.optional(v.id('_storage')), // Convex file storage ID
		photoCapturedAt: v.optional(v.number()), // When photo was taken
		photoCapturedBy: v.optional(v.string()), // Who took the photo
		lastModified: v.number()
	})
		.index('by_date', ['date'])
		.index('by_date_time_slot', ['date', 'timeSlot'])
		.index('by_client_id', ['clientId'])
});
