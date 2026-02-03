// Simple reactive user context for sharing authenticated user name
// Used by app pages to attribute actions (completion, ad-hoc creation) to users

let currentUserName = $state<string | null>(null);

/**
 * Set the current user name after access validation.
 * Called by the app layout after successful authentication.
 */
export function setCurrentUser(name: string | null): void {
	currentUserName = name;
}

/**
 * Get the current user name for action attribution.
 * Returns 'Worker' as fallback if no name is set.
 */
export function getCurrentUser(): string {
	return currentUserName || 'Worker';
}
