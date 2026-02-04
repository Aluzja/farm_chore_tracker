import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import {
	DB_NAME,
	DB_VERSION,
	STORES,
	type DailyChore,
	type Mutation,
	type PhotoQueueEntry,
	type ImageCacheEntry
} from './schema';

interface KitchenSinkDB extends DBSchema {
	chores: {
		key: string;
		value: { _id: string; [key: string]: unknown };
		indexes: {
			'by-sync-status': string;
			'by-last-modified': number;
		};
	};
	dailyChores: {
		key: string;
		value: DailyChore;
		indexes: {
			'by-date': string;
			'by-sync-status': string;
		};
	};
	mutationQueue: {
		key: string;
		value: Mutation;
		indexes: {
			'by-created-at': number;
		};
	};
	photoQueue: {
		key: string;
		value: PhotoQueueEntry;
		indexes: {
			'by-upload-status': string;
			'by-captured-at': number;
		};
	};
	imageCache: {
		key: string;
		value: ImageCacheEntry;
		indexes: {
			'by-cached-at': number;
		};
	};
}

let dbPromise: Promise<IDBPDatabase<KitchenSinkDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<KitchenSinkDB>> {
	if (!dbPromise) {
		dbPromise = openDB<KitchenSinkDB>(DB_NAME, DB_VERSION, {
			upgrade(db, oldVersion) {
				// Version 1: Initial schema
				if (oldVersion < 1) {
					const choreStore = db.createObjectStore(STORES.chores, { keyPath: '_id' });
					choreStore.createIndex('by-sync-status', 'syncStatus');
					choreStore.createIndex('by-last-modified', 'lastModified');

					const queueStore = db.createObjectStore(STORES.mutationQueue, { keyPath: 'id' });
					queueStore.createIndex('by-created-at', 'createdAt');
				}
				// Version 2: Add dailyChores store
				if (oldVersion < 2) {
					const dailyStore = db.createObjectStore(STORES.dailyChores, { keyPath: '_id' });
					dailyStore.createIndex('by-date', 'date');
					dailyStore.createIndex('by-sync-status', 'syncStatus');
				}
				// Version 3: Add photoQueue store
				if (oldVersion < 3) {
					const photoStore = db.createObjectStore(STORES.photoQueue, { keyPath: 'id' });
					photoStore.createIndex('by-upload-status', 'uploadStatus');
					photoStore.createIndex('by-captured-at', 'capturedAt');
				}
				// Version 4: Add imageCache store
				if (oldVersion < 4) {
					const cacheStore = db.createObjectStore(STORES.imageCache, { keyPath: 'storageId' });
					cacheStore.createIndex('by-cached-at', 'cachedAt');
				}
			},
			blocked() {
				console.warn('[DB] Database blocked - close other tabs');
			},
			blocking() {
				console.warn('[DB] Database blocking - this tab has old version');
			}
		});
	}
	return dbPromise;
}

// For testing: reset the cached promise
export function resetDB(): void {
	dbPromise = null;
}

export type { KitchenSinkDB };
