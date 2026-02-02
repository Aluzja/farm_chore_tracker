import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import { DB_NAME, DB_VERSION, STORES, type Chore, type Mutation } from './schema';

interface KitchenSinkDB extends DBSchema {
	chores: {
		key: string;
		value: Chore;
		indexes: {
			'by-sync-status': string;
			'by-last-modified': number;
		};
	};
	mutationQueue: {
		key: string;
		value: Mutation;
		indexes: {
			'by-created-at': number;
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
				// Future migrations: if (oldVersion < 2) { ... }
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
