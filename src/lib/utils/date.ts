/**
 * Date utilities for daily chore logic
 */

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 * Uses UTC to avoid timezone issues on server
 */
export function getTodayDateString(): string {
	return new Date().toISOString().split('T')[0];
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
