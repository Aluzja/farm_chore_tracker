import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Validate an access key (no auth required - this IS the auth check for workers)
export const validate = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const accessKey = await ctx.db
      .query("accessKeys")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!accessKey) {
      return { valid: false, reason: "not_found" as const };
    }

    if (accessKey.revokedAt) {
      return { valid: false, reason: "revoked" as const };
    }

    return {
      valid: true,
      displayName: accessKey.displayName,
      keyId: accessKey._id,
    };
  },
});

// Record key usage (called when access key is used)
export const recordUsage = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const accessKey = await ctx.db
      .query("accessKeys")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (accessKey && !accessKey.revokedAt) {
      await ctx.db.patch(accessKey._id, { lastUsedAt: Date.now() });
    }
  },
});

// Create a new access key (admin only)
export const create = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin access required");

    // Generate secure random key (16 chars, alphanumeric)
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let key = "";
    for (let i = 0; i < 16; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const id = await ctx.db.insert("accessKeys", {
      key,
      displayName,
      createdAt: Date.now(),
      createdBy: userId,
    });

    return { id, key };
  },
});

// Revoke an access key (admin only)
export const revoke = mutation({
  args: { id: v.id("accessKeys") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin access required");

    const accessKey = await ctx.db.get(id);
    if (!accessKey) throw new Error("Access key not found");

    await ctx.db.patch(id, { revokedAt: Date.now() });
    return { success: true };
  },
});

// List all access keys (admin only)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) return [];

    const keys = await ctx.db.query("accessKeys").collect();
    // Don't expose the actual key in list, only in create response
    return keys.map((k) => ({
      id: k._id,
      displayName: k.displayName,
      createdAt: k.createdAt,
      revokedAt: k.revokedAt,
      lastUsedAt: k.lastUsedAt,
      isRevoked: !!k.revokedAt,
    }));
  },
});
