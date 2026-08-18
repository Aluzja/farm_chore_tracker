import { query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import type { MutationCtx } from './_generated/server';

// List active feed types for the chore form dropdown (admin only)
export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		const user = await ctx.db.get(userId);
		if (!user?.isAdmin) return [];

		const feedTypes = await ctx.db
			.query('feedTypes')
			.filter((q) => q.eq(q.field('isActive'), true))
			.collect();
		return feedTypes.sort((a, b) => a.name.localeCompare(b.name));
	}
});

// Insert any feed names not already in the catalog (case-insensitive).
// Called from masterChores/dailyChores mutations so new feeds typed in the
// form flow back into the db automatically.
export async function ensureFeedTypes(ctx: MutationCtx, names: string[]): Promise<void> {
	if (names.length === 0) return;

	const existing = await ctx.db.query('feedTypes').collect();
	const known = new Set(existing.map((f) => f.name.toLowerCase()));

	for (const name of names) {
		const trimmed = name.trim();
		if (!trimmed || known.has(trimmed.toLowerCase())) continue;
		known.add(trimmed.toLowerCase());
		await ctx.db.insert('feedTypes', {
			name: trimmed,
			isActive: true,
			createdAt: Date.now()
		});
	}
}
