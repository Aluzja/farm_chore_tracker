import { getDB } from './client';
import { STORES, ChoreSchema, DailyChoreSchema, type Chore, type DailyChore } from './schema';

// Read operations
export async function getChore(id: string): Promise<Chore | undefined> {
	const db = await getDB();
	const chore = await db.get(STORES.chores, id);
	return chore ? ChoreSchema.parse(chore) : undefined;
}

export async function getAllChores(): Promise<Chore[]> {
	const db = await getDB();
	const chores = await db.getAll(STORES.chores);
	return chores.map((c) => ChoreSchema.parse(c));
}

export async function getChoresByStatus(status: Chore['syncStatus']): Promise<Chore[]> {
	const db = await getDB();
	const chores = await db.getAllFromIndex(STORES.chores, 'by-sync-status', status);
	return chores.map((c) => ChoreSchema.parse(c));
}

// Write operations
export async function putChore(chore: Chore): Promise<void> {
	// Validate before storing
	const validated = ChoreSchema.parse(chore);
	const db = await getDB();
	await db.put(STORES.chores, validated);
}

export async function deleteChore(id: string): Promise<void> {
	const db = await getDB();
	await db.delete(STORES.chores, id);
}

// Batch operations for sync
export async function putChores(chores: Chore[]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(STORES.chores, 'readwrite');
	await Promise.all([...chores.map((c) => tx.store.put(ChoreSchema.parse(c))), tx.done]);
}

export async function clearChores(): Promise<void> {
	const db = await getDB();
	await db.clear(STORES.chores);
}

// Daily chore operations
export async function getDailyChore(id: string): Promise<DailyChore | undefined> {
	const db = await getDB();
	const chore = await db.get(STORES.dailyChores, id);
	return chore ? DailyChoreSchema.parse(chore) : undefined;
}

export async function getAllDailyChores(): Promise<DailyChore[]> {
	const db = await getDB();
	const chores = await db.getAll(STORES.dailyChores);
	return chores.map((c) => DailyChoreSchema.parse(c));
}

export async function getDailyChoresByDate(date: string): Promise<DailyChore[]> {
	const db = await getDB();
	const chores = await db.getAllFromIndex(STORES.dailyChores, 'by-date', date);
	return chores.map((c) => DailyChoreSchema.parse(c));
}

export async function putDailyChore(chore: DailyChore): Promise<void> {
	const validated = DailyChoreSchema.parse(chore);
	const db = await getDB();
	await db.put(STORES.dailyChores, validated);
}

export async function putDailyChores(chores: DailyChore[]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(STORES.dailyChores, 'readwrite');
	await Promise.all([...chores.map((c) => tx.store.put(DailyChoreSchema.parse(c))), tx.done]);
}

export async function deleteDailyChore(id: string): Promise<void> {
	const db = await getDB();
	await db.delete(STORES.dailyChores, id);
}
