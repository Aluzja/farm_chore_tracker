import type { Id } from '../../convex/_generated/dataModel';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface MasterChore {
	_id: Id<'masterChores'>;
	text: string;
	description?: string;
	timeSlot: string;
	animalCategory: string;
	sortOrder: number;
	isActive: boolean;
	requiresPhoto?: boolean;
	createdBy?: Id<'users'>;
	createdAt: number;
	updatedAt: number;
}

interface CategoryGroup {
	name: string;
	chores: MasterChore[];
}

interface GroupedMasterChores {
	timeSlot: TimeSlot;
	label: string;
	categories: CategoryGroup[];
	totalChores: number;
}

const TIME_SLOT_ORDER: TimeSlot[] = ['morning', 'afternoon', 'evening'];
const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
	morning: 'Morning',
	afternoon: 'Afternoon',
	evening: 'Evening'
};

class MasterChoreStore {
	items = $state<MasterChore[]>([]);
	isLoading = $state(true);

	// Group by time slot, then by category for display (only active chores)
	grouped = $derived.by(() => {
		const result: GroupedMasterChores[] = [];

		for (const slot of TIME_SLOT_ORDER) {
			const slotChores = this.items
				.filter((c) => c.timeSlot === slot && c.isActive)
				.sort((a, b) => a.sortOrder - b.sortOrder);

			if (slotChores.length > 0) {
				// Group by category
				const categoryMap = new Map<string, MasterChore[]>();
				for (const chore of slotChores) {
					const cat = chore.animalCategory;
					if (!categoryMap.has(cat)) {
						categoryMap.set(cat, []);
					}
					categoryMap.get(cat)!.push(chore);
				}

				// Convert to array and sort categories alphabetically
				const categories: CategoryGroup[] = Array.from(categoryMap.entries())
					.sort((a, b) => a[0].localeCompare(b[0]))
					.map(([name, chores]) => ({ name, chores }));

				result.push({
					timeSlot: slot,
					label: TIME_SLOT_LABELS[slot],
					categories,
					totalChores: slotChores.length
				});
			}
		}

		return result;
	});

	// All active chores (flat list)
	activeChores = $derived(this.items.filter((c) => c.isActive));

	// Count by time slot
	countBySlot = $derived.by(() => {
		const counts: Record<TimeSlot, number> = {
			morning: 0,
			afternoon: 0,
			evening: 0
		};

		for (const chore of this.items) {
			if (chore.isActive && chore.timeSlot in counts) {
				counts[chore.timeSlot as TimeSlot]++;
			}
		}

		return counts;
	});

	// Total active chores
	totalActive = $derived(this.items.filter((c) => c.isActive).length);

	// Hydrate from Convex query result
	hydrateFromServer(serverChores: MasterChore[]): void {
		this.items = serverChores;
		this.isLoading = false;
	}

	// Set loading state (useful when query is refetching)
	setLoading(loading: boolean): void {
		this.isLoading = loading;
	}
}

export const masterChoreStore = new MasterChoreStore();
