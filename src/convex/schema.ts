import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Extend users table with admin flag
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAdmin: v.boolean(), // First user becomes admin
  }).index("email", ["email"]),

  // Access keys for URL-based worker access
  accessKeys: defineTable({
    key: v.string(), // The shareable key (e.g., "abc123def456")
    displayName: v.string(), // Human-readable name ("John's Phone")
    createdAt: v.number(),
    createdBy: v.id("users"), // Admin who created this key
    revokedAt: v.optional(v.number()), // Set when key is revoked
    lastUsedAt: v.optional(v.number()), // Track usage
  })
    .index("by_key", ["key"])
    .index("by_created_by", ["createdBy"]),

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
