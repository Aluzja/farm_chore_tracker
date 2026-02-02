import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List all master chores (admin only)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) return [];

    return await ctx.db
      .query("masterChores")
      .order("asc")
      .collect();
  },
});

// Create master chore (admin only)
export const create = mutation({
  args: {
    text: v.string(),
    timeSlot: v.string(),
    animalCategory: v.string(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin required");

    // Get max sortOrder for this time slot if not provided
    let sortOrder = args.sortOrder;
    if (sortOrder === undefined) {
      const slotChores = await ctx.db
        .query("masterChores")
        .withIndex("by_time_slot", (q) => q.eq("timeSlot", args.timeSlot))
        .collect();
      const maxOrder = slotChores.length > 0
        ? Math.max(...slotChores.map((c) => c.sortOrder))
        : 0;
      sortOrder = maxOrder + 1;
    }

    const now = Date.now();
    return await ctx.db.insert("masterChores", {
      text: args.text,
      timeSlot: args.timeSlot,
      animalCategory: args.animalCategory,
      sortOrder,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update master chore (admin only)
export const update = mutation({
  args: {
    id: v.id("masterChores"),
    text: v.optional(v.string()),
    timeSlot: v.optional(v.string()),
    animalCategory: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin required");

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Chore not found");

    // Filter out undefined values
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.text !== undefined) patch.text = updates.text;
    if (updates.timeSlot !== undefined) patch.timeSlot = updates.timeSlot;
    if (updates.animalCategory !== undefined) patch.animalCategory = updates.animalCategory;
    if (updates.sortOrder !== undefined) patch.sortOrder = updates.sortOrder;
    if (updates.isActive !== undefined) patch.isActive = updates.isActive;

    await ctx.db.patch(id, patch);
  },
});

// Delete master chore (soft delete via isActive)
export const remove = mutation({
  args: { id: v.id("masterChores") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin required");

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Chore not found");

    await ctx.db.patch(id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});
