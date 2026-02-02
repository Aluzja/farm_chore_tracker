# Phase 4: Core Chore Workflow - Research

**Researched:** 2026-02-02
**Domain:** Chore management workflow with master/daily list pattern, time-of-day grouping, and real-time sync
**Confidence:** HIGH

## Summary

Phase 4 implements the core chore workflow for the farm app: admin manages a master list of recurring chores, and each day a fresh daily list is cloned from the master for workers to complete. The research identifies the key architectural patterns needed: a two-table schema (masterChores vs dailyChores), on-demand daily cloning via Convex queries/mutations, time-of-day and animal category grouping using Svelte 5's `$derived` rune, and optimistic UI updates using the existing sync engine infrastructure.

The existing codebase provides a solid foundation: the IndexedDB sync layer from Phase 2 and the auth system from Phase 3 are fully operational. The current `chores` table needs to be evolved into `masterChores` (template definitions) and `dailyChores` (daily instances). The daily clone happens on first access by any user each day - not via a scheduled cron job, to avoid empty daily lists if no one accesses the app.

**Primary recommendation:** Extend the Convex schema with `masterChores` and `dailyChores` tables. Implement a `getOrCreateDailyList` query that clones from master on first access. Use `$derived` for client-side grouping by timeSlot and animalCategory. Leverage the existing chore store pattern for optimistic updates.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | 1.31.7 | Backend with real-time sync | Already installed, provides queries/mutations |
| convex-svelte | 0.0.12 | Svelte 5 Convex bindings | Already installed, provides useQuery for subscriptions |
| idb | ^8.0.3 | IndexedDB wrapper | Already installed, offline persistence layer |
| zod | ^4.3.6 | Runtime type validation | Already installed, validates data at boundaries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Built-in Date | Native | Date handling for daily logic | No external lib needed |
| Built-in crypto | Native | UUID generation | crypto.randomUUID() for clientId |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| On-demand daily clone | Scheduled cron job | Cron creates empty lists if no one accesses app; on-demand is simpler |
| Client-side grouping | Server-side grouping | Client-side is faster for small lists, supports offline viewing |
| Nested data model | Flat with indexes | Nested complex; flat with timeSlot/animalCategory fields is simpler |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── convex/
│   ├── schema.ts           # Add masterChores, dailyChores tables
│   ├── masterChores.ts     # Admin CRUD for master chores
│   ├── dailyChores.ts      # Daily list queries/mutations
│   └── chores.ts           # (migrate/deprecate existing)
├── lib/
│   ├── db/
│   │   ├── schema.ts       # Update with MasterChore, DailyChore types
│   │   └── operations.ts   # Add daily chore operations
│   ├── stores/
│   │   ├── masterChores.svelte.ts  # Admin master list store
│   │   └── dailyChores.svelte.ts   # Daily list store with grouping
│   └── utils/
│       └── date.ts         # Date utilities for daily logic
└── routes/
    ├── (app)/
    │   └── +page.svelte    # Daily chore list view (workers)
    └── admin/
        └── chores/
            └── +page.svelte # Master list management (admin)
```

### Pattern 1: Two-Table Master/Daily Schema
**What:** Separate tables for template definitions vs daily instances
**When to use:** Recurring task patterns with daily state tracking
**Example:**
```typescript
// convex/schema.ts
export default defineSchema({
  ...authTables,
  users: /* existing */,
  accessKeys: /* existing */,

  // Master chore templates (admin-managed)
  masterChores: defineTable({
    text: v.string(),                     // Chore description
    timeSlot: v.string(),                 // "morning" | "afternoon" | "evening"
    animalCategory: v.string(),           // "chickens" | "goats" | "pigs" | etc.
    sortOrder: v.number(),                // Display order within group
    isActive: v.boolean(),                // Soft delete / disable
    createdBy: v.optional(v.id("users")), // Admin who created
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_time_slot", ["timeSlot"])
    .index("by_active", ["isActive"]),

  // Daily chore instances (cloned from master each day)
  dailyChores: defineTable({
    date: v.string(),                     // ISO date "2026-02-02"
    masterChoreId: v.optional(v.id("masterChores")), // null for ad-hoc
    clientId: v.string(),                 // For offline-first idempotency
    text: v.string(),
    timeSlot: v.string(),
    animalCategory: v.string(),
    sortOrder: v.number(),
    isCompleted: v.boolean(),
    completedAt: v.optional(v.string()),
    completedBy: v.optional(v.string()),  // Display name of completer
    isAdHoc: v.boolean(),                 // true for today-only chores
    lastModified: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_date_time_slot", ["date", "timeSlot"])
    .index("by_client_id", ["clientId"]),
});
```

### Pattern 2: On-Demand Daily List Cloning
**What:** Clone master list to daily list on first access each day
**When to use:** Ensuring fresh daily list without scheduled jobs
**Example:**
```typescript
// convex/dailyChores.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get today's date string in consistent format
function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // "2026-02-02"
}

// Get or create daily list for today
export const getOrCreateDailyList = query({
  args: {},
  handler: async (ctx) => {
    const today = getTodayDate();

    // Check if daily list already exists
    const existing = await ctx.db
      .query("dailyChores")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();

    if (existing.length > 0) {
      return existing;
    }

    // No daily list yet - this triggers a mutation to clone
    return { needsClone: true, date: today };
  },
});

// Clone master list to create today's daily list
export const cloneMasterToDaily = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    // Prevent duplicate cloning
    const existing = await ctx.db
      .query("dailyChores")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (existing) {
      // Already cloned, return existing
      return await ctx.db
        .query("dailyChores")
        .withIndex("by_date", (q) => q.eq("date", date))
        .collect();
    }

    // Get active master chores
    const masterChores = await ctx.db
      .query("masterChores")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Clone each to daily
    const dailyChores = [];
    for (const master of masterChores) {
      const clientId = crypto.randomUUID();
      const id = await ctx.db.insert("dailyChores", {
        date,
        masterChoreId: master._id,
        clientId,
        text: master.text,
        timeSlot: master.timeSlot,
        animalCategory: master.animalCategory,
        sortOrder: master.sortOrder,
        isCompleted: false,
        isAdHoc: false,
        lastModified: Date.now(),
      });
      const inserted = await ctx.db.get(id);
      if (inserted) dailyChores.push(inserted);
    }

    return dailyChores;
  },
});
```

### Pattern 3: Client-Side Grouping with $derived
**What:** Group chores by timeSlot and animalCategory using reactive derived state
**When to use:** Organizing flat data for hierarchical UI display
**Example:**
```typescript
// src/lib/stores/dailyChores.svelte.ts
import type { DailyChore } from '$lib/db/schema';

type TimeSlot = 'morning' | 'afternoon' | 'evening';

interface GroupedChores {
  timeSlot: TimeSlot;
  categories: {
    name: string;
    chores: DailyChore[];
  }[];
}

class DailyChoreStore {
  items = $state<DailyChore[]>([]);
  isLoading = $state(true);

  // Grouped by time slot, then by animal category
  grouped = $derived.by(() => {
    const timeSlotOrder: TimeSlot[] = ['morning', 'afternoon', 'evening'];
    const result: GroupedChores[] = [];

    for (const timeSlot of timeSlotOrder) {
      const slotChores = this.items.filter(c => c.timeSlot === timeSlot);
      if (slotChores.length === 0) continue;

      // Group by animal category within time slot
      const categoryMap = new Map<string, DailyChore[]>();
      for (const chore of slotChores) {
        const category = chore.animalCategory || 'General';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(chore);
      }

      // Sort categories alphabetically, sort chores by sortOrder
      const categories = Array.from(categoryMap.entries())
        .map(([name, chores]) => ({
          name,
          chores: chores.sort((a, b) => a.sortOrder - b.sortOrder),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      result.push({ timeSlot, categories });
    }

    return result;
  });

  // Progress stats
  completedCount = $derived(this.items.filter(c => c.isCompleted).length);
  totalCount = $derived(this.items.length);
  progress = $derived(this.totalCount > 0 ? Math.round((this.completedCount / this.totalCount) * 100) : 0);
}

export const dailyChoreStore = new DailyChoreStore();
```

### Pattern 4: Optimistic Toggle with Attribution
**What:** One-tap completion with immediate UI feedback and completer tracking
**When to use:** All completion/undo operations
**Example:**
```typescript
// src/lib/stores/dailyChores.svelte.ts (continued)

class DailyChoreStore {
  // ... previous code ...

  async toggleComplete(id: string, userName: string): Promise<void> {
    const chore = this.items.find(c => c._id === id);
    if (!chore) return;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const updated: DailyChore = {
      ...chore,
      isCompleted: !chore.isCompleted,
      completedAt: !chore.isCompleted ? nowIso : undefined,
      completedBy: !chore.isCompleted ? userName : undefined,
      syncStatus: 'pending',
      lastModified: now,
    };

    // Optimistic UI update
    this.items = this.items.map(c => c._id === id ? updated : c);

    // Persist to IndexedDB
    await putDailyChore($state.snapshot(updated));

    // Queue for sync
    await enqueueMutation('update', 'dailyChores', {
      id: updated._id,
      isCompleted: updated.isCompleted,
      completedAt: updated.completedAt,
      completedBy: updated.completedBy,
      lastModified: updated.lastModified,
    });
  }
}
```

### Pattern 5: Ad-Hoc Chore Addition (Today Only)
**What:** Workers can add one-time chores for today that don't affect master list
**When to use:** Unexpected tasks that need tracking
**Example:**
```typescript
// convex/dailyChores.ts (continued)

export const addAdHoc = mutation({
  args: {
    clientId: v.string(),
    text: v.string(),
    timeSlot: v.string(),
    animalCategory: v.string(),
    createdBy: v.optional(v.string()),
    lastModified: v.number(),
  },
  handler: async (ctx, args) => {
    // Idempotent: check if already exists
    const existing = await ctx.db
      .query("dailyChores")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .first();

    if (existing) return existing._id;

    const today = getTodayDate();

    // Get max sortOrder for this time slot today
    const slotChores = await ctx.db
      .query("dailyChores")
      .withIndex("by_date_time_slot", (q) =>
        q.eq("date", today).eq("timeSlot", args.timeSlot)
      )
      .collect();
    const maxOrder = Math.max(0, ...slotChores.map(c => c.sortOrder));

    return await ctx.db.insert("dailyChores", {
      date: today,
      masterChoreId: undefined, // No master reference
      clientId: args.clientId,
      text: args.text,
      timeSlot: args.timeSlot,
      animalCategory: args.animalCategory,
      sortOrder: maxOrder + 1,
      isCompleted: false,
      isAdHoc: true,
      lastModified: args.lastModified,
    });
  },
});
```

### Pattern 6: Real-Time Subscription for Progress
**What:** All users see live updates as chores are completed
**When to use:** Multi-user coordination
**Example:**
```svelte
<!-- src/routes/(app)/+page.svelte -->
<script lang="ts">
  import { useQuery, useConvexClient } from 'convex-svelte';
  import { browser } from '$app/environment';
  import { api } from '../../convex/_generated/api';
  import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';

  const client = browser ? useConvexClient() : null;

  // Subscribe to today's daily chores (real-time updates)
  const dailyQuery = browser ? useQuery(api.dailyChores.getOrCreateDailyList, {}) : null;

  // Handle clone-on-first-access
  $effect(() => {
    if (dailyQuery?.data?.needsClone && client) {
      client.mutation(api.dailyChores.cloneMasterToDaily, {
        date: dailyQuery.data.date
      });
    }
  });

  // Hydrate store from server data
  $effect(() => {
    if (dailyQuery?.data && Array.isArray(dailyQuery.data)) {
      dailyChoreStore.hydrateFromServer(dailyQuery.data);
    }
  });
</script>

<!-- Progress bar showing real-time completion -->
<div class="progress-bar">
  <div
    class="progress-fill"
    style="width: {dailyChoreStore.progress}%"
  ></div>
  <span class="progress-text">
    {dailyChoreStore.completedCount}/{dailyChoreStore.totalCount} complete
  </span>
</div>
```

### Anti-Patterns to Avoid
- **Storing grouped data in database:** Groups are view concerns; store flat, derive groups client-side
- **Using cron for daily clone:** Creates empty lists on days no one uses app; on-demand is better
- **Mutating $derived values:** $derived is read-only by default; use store methods instead
- **Blocking UI on sync:** Use optimistic updates; show sync status indicator separately
- **Hard-coding timezone:** Use ISO date strings; let client handle display timezone

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date string formatting | Custom date format | `date.toISOString().split('T')[0]` | ISO dates sort correctly, no timezone bugs |
| List grouping | Manual loops in template | `$derived.by()` | Automatic updates, memoized |
| Optimistic updates | Manual rollback logic | Existing chore store pattern | Already handles IndexedDB + sync queue |
| Real-time sync | Custom WebSocket | convex-svelte useQuery | Built-in subscription management |
| UUID generation | Custom ID scheme | `crypto.randomUUID()` | Browser native, collision-resistant |

**Key insight:** The existing sync infrastructure from Phase 2 handles the hard parts (IndexedDB persistence, mutation queue, conflict resolution). Phase 4 extends this pattern to daily chores rather than rebuilding it.

## Common Pitfalls

### Pitfall 1: Timezone Confusion in Daily Logic
**What goes wrong:** Chores appear on wrong day for users in different timezones
**Why it happens:** Using local dates inconsistently between server and client
**How to avoid:**
- Server uses UTC date (`new Date().toISOString().split('T')[0]`)
- Store date as ISO string "2026-02-02"
- Let client display dates in local timezone
**Warning signs:** Chores "disappear" at midnight for some users but not others

### Pitfall 2: Race Condition on Daily Clone
**What goes wrong:** Multiple users clone master list simultaneously, creating duplicates
**Why it happens:** No lock on clone operation
**How to avoid:**
- Check for existing daily chores before cloning (idempotent mutation)
- Use `ctx.db.query().first()` check at start of clone mutation
- Return existing chores if already cloned
**Warning signs:** Duplicate chores appearing in daily list

### Pitfall 3: Lost Ad-Hoc Chores
**What goes wrong:** Ad-hoc chores disappear after app reload
**Why it happens:** Not persisting to IndexedDB before sync, or not hydrating correctly
**How to avoid:**
- Store ad-hoc chores in IndexedDB immediately with syncStatus: 'pending'
- Include isAdHoc flag in hydration merge logic
- Don't filter out ad-hoc chores when syncing
**Warning signs:** Ad-hoc chores visible until refresh, then gone

### Pitfall 4: Optimistic Update Reversion
**What goes wrong:** Completed chore reverts to incomplete after sync
**Why it happens:** Server data overwrites local optimistic state with stale data
**How to avoid:**
- Track lastModified timestamp on all updates
- Server-side last-write-wins comparison
- Don't overwrite local 'pending' items with server 'synced' items
**Warning signs:** Checkmarks disappear briefly after marking complete

### Pitfall 5: Empty Master List Clone
**What goes wrong:** Daily list is empty even though master list has chores
**Why it happens:** Querying master chores with wrong index or filter
**How to avoid:**
- Ensure `isActive: true` filter in clone query
- Verify master chores exist before clone
- Log clone operation for debugging
**Warning signs:** First day works, subsequent days have empty lists

### Pitfall 6: Grouped View Doesn't Update
**What goes wrong:** Adding/completing chore doesn't update grouped display
**Why it happens:** $derived not tracking dependency correctly, or stale snapshot used
**How to avoid:**
- Ensure `this.items` is reactive ($state)
- Use `$derived.by()` for complex grouping logic
- Avoid caching derived values manually
**Warning signs:** Need to refresh page to see changes in grouped view

## Code Examples

Verified patterns from official sources and existing codebase:

### Date Utilities for Daily Logic
```typescript
// src/lib/utils/date.ts

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 * Uses UTC to avoid timezone issues on server
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if a date string is today
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayDateString();
}

/**
 * Format time slot for display
 */
export function formatTimeSlot(slot: string): string {
  const labels: Record<string, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
  };
  return labels[slot] || slot;
}

/**
 * Get time slot from current hour
 */
export function getCurrentTimeSlot(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
```

### Master Chore CRUD (Admin)
```typescript
// convex/masterChores.ts
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

    // Get max sortOrder for this time slot
    const slotChores = await ctx.db
      .query("masterChores")
      .withIndex("by_time_slot", (q) => q.eq("timeSlot", args.timeSlot))
      .collect();
    const maxOrder = Math.max(0, ...slotChores.map(c => c.sortOrder));

    const now = Date.now();
    return await ctx.db.insert("masterChores", {
      text: args.text,
      timeSlot: args.timeSlot,
      animalCategory: args.animalCategory,
      sortOrder: args.sortOrder ?? maxOrder + 1,
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

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
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

    await ctx.db.patch(id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});
```

### Complete Daily Chore (All Users)
```typescript
// convex/dailyChores.ts (toggle completion)

export const toggleComplete = mutation({
  args: {
    id: v.string(), // clientId for offline-first
    isCompleted: v.boolean(),
    completedAt: v.optional(v.string()),
    completedBy: v.optional(v.string()),
    lastModified: v.number(),
  },
  handler: async (ctx, { id: clientId, lastModified, ...updates }) => {
    const existing = await ctx.db
      .query("dailyChores")
      .withIndex("by_client_id", (q) => q.eq("clientId", clientId))
      .first();

    if (!existing) {
      console.log(`[dailyChores.toggleComplete] Chore ${clientId} not found`);
      return null;
    }

    // Last-write-wins
    if (lastModified > existing.lastModified) {
      await ctx.db.patch(existing._id, {
        ...updates,
        lastModified,
      });
    }

    return existing._id;
  },
});
```

### Grouped Chore List Component
```svelte
<!-- Grouped chore rendering pattern -->
<script lang="ts">
  import { dailyChoreStore } from '$lib/stores/dailyChores.svelte';
  import { formatTimeSlot } from '$lib/utils/date';

  // Get user name from access key context
  let userName = 'Worker'; // Get from access key displayName

  async function handleToggle(id: string) {
    await dailyChoreStore.toggleComplete(id, userName);
  }
</script>

{#each dailyChoreStore.grouped as group}
  <section class="time-slot">
    <h2 class="time-slot-header">{formatTimeSlot(group.timeSlot)}</h2>

    {#each group.categories as category}
      <div class="animal-category">
        <h3 class="category-header">{category.name}</h3>

        <ul class="chore-list">
          {#each category.chores as chore (chore._id)}
            <li class="chore-item" class:completed={chore.isCompleted}>
              <button
                class="toggle-btn"
                onclick={() => handleToggle(chore._id)}
                aria-label={chore.isCompleted ? 'Mark incomplete' : 'Mark complete'}
              >
                {#if chore.isCompleted}
                  <span class="checkmark">check</span>
                {:else}
                  <span class="circle"></span>
                {/if}
              </button>

              <div class="chore-content">
                <span class="chore-text">{chore.text}</span>
                {#if chore.isCompleted && chore.completedBy}
                  <span class="completion-info">
                    {chore.completedBy} at {new Date(chore.completedAt || '').toLocaleTimeString()}
                  </span>
                {/if}
              </div>

              {#if chore.isAdHoc}
                <span class="adhoc-badge">Today only</span>
              {/if}

              <span class="sync-indicator" class:pending={chore.syncStatus === 'pending'}>
                {chore.syncStatus === 'pending' ? '...' : ''}
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </section>
{/each}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scheduled cron for daily reset | On-demand clone on first access | Best practice | Avoids empty lists, simpler |
| Server-side grouping | Client-side $derived grouping | Svelte 5 (2024) | Faster, offline-capable |
| Manual rollback for optimistic UI | Last-write-wins with timestamps | Current | Simpler conflict resolution |
| Separate sync libraries | Built-in Convex real-time | Current | Less complexity |

**Deprecated/outdated:**
- Svelte 4 reactive statements (`$:`) for derived state: Use `$derived` in Svelte 5
- PouchDB for offline sync: Direct IndexedDB + custom sync is simpler
- Moment.js for dates: Native Date API sufficient for ISO date handling

## Open Questions

Things that couldn't be fully resolved:

1. **Exact completion attribution UX**
   - What we know: Store completedBy as display name string
   - What's unclear: Should admin see full attribution vs workers seeing abbreviated?
   - Recommendation: Show "Name at HH:MM" for all users; keep simple

2. **Master list changes mid-day**
   - What we know: Daily list is cloned once at first access
   - What's unclear: If admin edits master, should today's daily list update?
   - Recommendation: Changes only affect tomorrow; today's list is immutable from master

3. **Historical data retention**
   - What we know: Phase 6 covers 7-day history
   - What's unclear: Should Phase 4 index daily chores for historical queries?
   - Recommendation: Add `by_date` index now; defer history UI to Phase 6

4. **Sort order across users**
   - What we know: sortOrder field controls display order
   - What's unclear: Can workers reorder chores, or only admin?
   - Recommendation: Admin controls sortOrder in master; daily list inherits; workers cannot reorder

## Sources

### Primary (HIGH confidence)
- [Convex Scheduled Functions](https://docs.convex.dev/scheduling/scheduled-functions) - ctx.scheduler API
- [Convex Cron Jobs](https://docs.convex.dev/scheduling/cron-jobs) - Cron patterns (decided against for daily clone)
- [Svelte 5 $derived](https://svelte.dev/docs/svelte/$derived) - Derived state for grouping
- [convex-svelte GitHub](https://github.com/get-convex/convex-svelte) - useQuery, useConvexClient patterns
- Existing codebase: `src/lib/stores/chores.svelte.ts`, `src/lib/sync/engine.svelte.ts`

### Secondary (MEDIUM confidence)
- [MDN Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) - ISO date handling
- [web.dev Offline Data](https://web.dev/learn/pwa/offline-data) - Offline-first patterns
- Phase 2 and Phase 3 research documents

### Tertiary (LOW confidence)
- WebSearch results on task management schema patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing installed packages, extending proven patterns
- Architecture: HIGH - Two-table pattern is well-established for master/instance scenarios
- Pitfalls: MEDIUM - Combination of known patterns and project-specific edge cases
- Code examples: HIGH - Based on existing codebase patterns and official docs

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable patterns, no fast-moving dependencies)
