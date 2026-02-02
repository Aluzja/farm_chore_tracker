import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      // Only run for new users (not updates)
      if (existingUserId) return;

      // Check if any admins exist
      const existingAdmin = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("isAdmin"), true))
        .first();

      // If no admin exists, make this user admin (first user)
      if (!existingAdmin) {
        await ctx.db.patch(userId, { isAdmin: true });
      }
    },
  },
});
