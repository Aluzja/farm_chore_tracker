import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Test table - will be replaced with actual schema in Phase 4
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),
});
