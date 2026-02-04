import { getAuthUserId } from '@convex-dev/auth/server';
import type { QueryCtx, MutationCtx } from './_generated/server';

/**
 * Verify that the caller is authorized - either an authenticated admin user
 * or a holder of a valid (non-revoked) access key.
 *
 * Returns the display name of the caller for logging purposes.
 * Throws an error if neither auth method is valid.
 */
export async function requireAuth(
	ctx: QueryCtx | MutationCtx,
	accessKey?: string
): Promise<string> {
	// Check admin auth first (cheap, no DB query if not authenticated)
	const userId = await getAuthUserId(ctx);
	if (userId) {
		const user = await ctx.db.get(userId);
		if (user) return user.name ?? 'Admin';
	}

	// Check access key
	if (accessKey) {
		const key = await ctx.db
			.query('accessKeys')
			.withIndex('by_key', (q: any) => q.eq('key', accessKey))
			.first();

		if (key && !key.revokedAt) {
			return key.displayName;
		}
	}

	throw new Error('Unauthorized: valid authentication or access key required');
}

/**
 * Same as requireAuth but returns a boolean instead of throwing.
 * Useful for queries that should return empty results instead of errors.
 */
export async function checkAuth(
	ctx: QueryCtx | MutationCtx,
	accessKey?: string
): Promise<boolean> {
	try {
		await requireAuth(ctx, accessKey);
		return true;
	} catch {
		return false;
	}
}
