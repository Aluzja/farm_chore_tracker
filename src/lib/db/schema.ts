import { z } from 'zod';

export const DB_NAME = 'kitchen-sink-farm';
export const DB_VERSION = 2;

// Chore schema - mirrors Convex but adds sync metadata
export const ChoreSchema = z.object({
	_id: z.string(),
	text: z.string().min(1),
	isCompleted: z.boolean(),
	completedAt: z.iso.datetime().optional(),
	completedBy: z.string().optional(),
	// Local-only sync tracking
	syncStatus: z.enum(['pending', 'synced', 'failed']),
	lastModified: z.number()
});

// Mutation queue entry for offline mutations
export const MutationSchema = z.object({
	id: z.uuid(),
	type: z.enum(['create', 'update', 'delete']),
	table: z.string(),
	payload: z.record(z.string(), z.unknown()),
	createdAt: z.number(),
	retryCount: z.number().default(0)
});

export type Chore = z.infer<typeof ChoreSchema>;
export type Mutation = z.infer<typeof MutationSchema>;

// Daily chore schema - mirrors Convex dailyChores but adds syncStatus for offline
export const DailyChoreSchema = z.object({
	_id: z.string(), // clientId used as local _id
	date: z.string(),
	masterChoreId: z.string().optional(),
	text: z.string().min(1),
	timeSlot: z.string(),
	animalCategory: z.string(),
	sortOrder: z.number(),
	isCompleted: z.boolean(),
	completedAt: z.iso.datetime().optional(),
	completedBy: z.string().optional(),
	isAdHoc: z.boolean(),
	syncStatus: z.enum(['pending', 'synced', 'failed']),
	lastModified: z.number()
});

export type DailyChore = z.infer<typeof DailyChoreSchema>;

export const STORES = {
	chores: 'chores',
	dailyChores: 'dailyChores',
	mutationQueue: 'mutationQueue'
} as const;
