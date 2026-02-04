import { query } from './_generated/server';
import { v } from 'convex/values';
import { checkAuth } from './authCheck';

export const list = query({
	args: { accessKey: v.optional(v.string()) },
	handler: async (ctx, { accessKey }) => {
		const authorized = await checkAuth(ctx, accessKey);
		if (!authorized) return [];
		return await ctx.db.query('tasks').collect();
	}
});
