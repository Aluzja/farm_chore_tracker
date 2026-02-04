/**
 * Date utilities for daily chore logic
 */

/**
 * Get today's date as YYYY-MM-DD in the user's local timezone.
 * This ensures "today" matches what the user sees on their clock,
 * not UTC (which can be a different date after ~4pm PST).
 */
export function getTodayDateString(): string {
	const now = new Date();
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
