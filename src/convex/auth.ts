import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
	providers: [Password],
	callbacks: {
		async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
			// Only run for new users (not updates)
			if (existingUserId) return;

			// Check if any admins exist
			const existingAdmin = await ctx.db
				.query('users')
				.filter((q) => q.eq(q.field('isAdmin'), true))
				.first();

			if (!existingAdmin) {
				// First user becomes admin
				await ctx.db.patch(userId, { isAdmin: true });
			} else {
				// An admin already exists — no new accounts allowed.
				// Delete the just-created user and reject signup.
				await ctx.db.delete(userId);
				throw new Error('Account creation is disabled. Use an access key to use the app.');
			}
		}
	}
});
