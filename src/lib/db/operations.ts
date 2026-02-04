import { getDB } from './client';
import { STORES, DailyChoreSchema, type DailyChore } from './schema';

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

export async function getDailyChoresByStatus(
	status: DailyChore['syncStatus']
): Promise<DailyChore[]> {
	const db = await getDB();
	const allChores = await db.getAll(STORES.dailyChores);
	return allChores.filter((c) => c.syncStatus === status).map((c) => DailyChoreSchema.parse(c));
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
