import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Chores table - main entity for farm chore tracking
  chores: defineTable({
    clientId: v.string(), // Client-generated UUID for offline-first idempotency
    text: v.string(),
    isCompleted: v.boolean(),
    completedAt: v.optional(v.string()),
    completedBy: v.optional(v.string()),
    lastModified: v.number(),
  })
    .index("by_last_modified", ["lastModified"])
    .index("by_client_id", ["clientId"]),

  // Keep tasks for backwards compatibility during transition
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),
});
