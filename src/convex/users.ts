import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get the currently authenticated user
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

// Check if current user is admin
export const isCurrentUserAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    return user?.isAdmin ?? false;
  },
});

// Make user admin (internal use, called after first signup)
export const makeAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Check if any admins exist
    const existingAdmins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .first();

    if (existingAdmins) {
      throw new Error("Admin already exists. Use admin console to grant admin rights.");
    }

    await ctx.db.patch(userId, { isAdmin: true });
    return { success: true };
  },
});

// Called after signup to check/assign first-user admin status
export const checkFirstUserAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if any admins exist
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .first();

    // If no admin exists, make this user admin
    if (!existingAdmin) {
      await ctx.db.patch(userId, { isAdmin: true });
      return { madeAdmin: true };
    }

    return { madeAdmin: false };
  },
});

// Force current authenticated user to become admin (use only if no admins exist)
export const forceSetAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if any admins exist
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .first();

    if (existingAdmin) {
      throw new Error("Admin already exists");
    }

    await ctx.db.patch(userId, { isAdmin: true });
    return { success: true, userId };
  },
});
