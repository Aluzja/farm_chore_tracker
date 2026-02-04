/**
 * Date utilities for daily chore logic
 */

/**
 * Get the "effective today" date as YYYY-MM-DD in the user's local timezone.
 * The day doesn't roll over at midnight — hours between 12am and 3am are
 * still treated as the previous day, so late-night chore activity stays
 * on the correct daily list.
 */
export function getTodayDateString(): string {
	const now = new Date();
	// Before 3am, treat it as still the previous day
	if (now.getHours() < 3) {
		now.setDate(now.getDate() - 1);
	}
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Check if a date string is today
 */
export function isToday(dateStr: string): boolean {
	return dateStr === getTodayDateString();
}

/**
 * Format time slot for display
 */
export function formatTimeSlot(slot: string): string {
	const labels: Record<string, string> = {
		morning: 'Morning',
		afternoon: 'Afternoon',
		evening: 'Evening'
	};
	return labels[slot] || slot;
}

/**
 * Get time slot from current hour
 */
export function getCurrentTimeSlot(): 'morning' | 'afternoon' | 'evening' {
	const hour = new Date().getHours();
	if (hour < 12) return 'morning';
	if (hour < 17) return 'afternoon';
	return 'evening';
}
