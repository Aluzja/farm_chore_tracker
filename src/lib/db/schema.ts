import { z } from 'zod';

export const DB_NAME = 'kitchen-sink-farm';
export const DB_VERSION = 4;

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
	description: z.string().optional(),
	timeSlot: z.string(),
	animalCategory: z.string(),
	sortOrder: z.number(),
	isCompleted: z.boolean(),
	completedAt: z.iso.datetime().optional(),
	completedBy: z.string().optional(),
	isAdHoc: z.boolean(),
	requiresPhoto: z.boolean(),
	photoStorageId: z.string().optional(), // Convex file storage ID
	syncStatus: z.enum(['pending', 'synced', 'failed']),
	lastModified: z.number()
});

export type DailyChore = z.infer<typeof DailyChoreSchema>;

// Photo queue entry for offline photo uploads
export const PhotoQueueEntrySchema = z.object({
	id: z.string(), // UUID
	dailyChoreClientId: z.string(), // Links to dailyChore
	blob: z.instanceof(Blob), // Compressed image blob
	mimeType: z.literal('image/jpeg'),
	originalSize: z.number(), // Pre-compression size
	compressedSize: z.number(), // Post-compression size
	capturedAt: z.number(), // Timestamp
	capturedBy: z.string(), // User display name
	uploadStatus: z.enum(['pending', 'uploading', 'failed']),
	retryCount: z.number().default(0),
	lastAttemptAt: z.number().optional()
});

export type PhotoQueueEntry = z.infer<typeof PhotoQueueEntrySchema>;

// Cached image entry for offline viewing of uploaded photos
export const ImageCacheEntrySchema = z.object({
	storageId: z.string(), // Convex storage ID (used as key)
	blob: z.instanceof(Blob), // Image data
	mimeType: z.string(),
	cachedAt: z.number(), // Timestamp when cached
	size: z.number() // Blob size in bytes
});

export type ImageCacheEntry = z.infer<typeof ImageCacheEntrySchema>;

export const STORES = {
	chores: 'chores',
	dailyChores: 'dailyChores',
	mutationQueue: 'mutationQueue',
	photoQueue: 'photoQueue',
	imageCache: 'imageCache'
} as const;
