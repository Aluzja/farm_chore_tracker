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
    isAdmin: v.optional(v.boolean()), // First user becomes admin (set by checkFirstUserAdmin)
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

  // Chores table - main entity for farm chore tracking (deprecated - migrate to masterChores/dailyChores)
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

  // Master chore templates (admin-managed)
  masterChores: defineTable({
    text: v.string(), // Chore description
    timeSlot: v.string(), // "morning" | "afternoon" | "evening"
    animalCategory: v.string(), // "chickens" | "goats" | "pigs" | "general" etc.
    sortOrder: v.number(), // Display order within group
    isActive: v.boolean(), // Soft delete / disable
    createdBy: v.optional(v.id("users")), // Admin who created
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_time_slot", ["timeSlot"])
    .index("by_active", ["isActive"]),

  // Daily chore instances (cloned from master each day)
  dailyChores: defineTable({
    date: v.string(), // ISO date "2026-02-02"
    masterChoreId: v.optional(v.id("masterChores")), // null for ad-hoc
    clientId: v.string(), // For offline-first idempotency
    text: v.string(),
    timeSlot: v.string(),
    animalCategory: v.string(),
    sortOrder: v.number(),
    isCompleted: v.boolean(),
    completedAt: v.optional(v.string()), // ISO datetime
    completedBy: v.optional(v.string()), // Display name
    isAdHoc: v.boolean(), // true for today-only chores
    lastModified: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_date_time_slot", ["date", "timeSlot"])
    .index("by_client_id", ["clientId"]),

  // Keep tasks for backwards compatibility during transition
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),
});
