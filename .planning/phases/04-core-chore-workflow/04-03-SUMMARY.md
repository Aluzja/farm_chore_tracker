---
phase: 04-core-chore-workflow
plan: 03
subsystem: frontend
tags: [svelte, daily-chores, offline-first, real-time-sync, grouping]

# Dependency graph
requires:
  - phase: 04-core-chore-workflow
    plan: 01
    provides: Convex dailyChores APIs, IndexedDB schema, date utilities
provides:
  - DailyChoreStore with reactive grouping by time slot and category
  - IndexedDB operations for daily chores
  - Sync engine support for daily chore mutations
  - Daily chore list UI with completion toggle
affects: [04-02, 05-photo-verification, 06-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Reactive grouped derived state for time slot/category hierarchy
    - Optimistic UI with sync queue for offline-first completion
    - Clone-on-demand pattern for daily list creation

key-files:
  created:
    - src/lib/stores/dailyChores.svelte.ts
  modified:
    - src/lib/db/operations.ts
    - src/lib/sync/engine.svelte.ts
    - src/routes/(app)/+layout.svelte
    - src/routes/(app)/+page.svelte

key-decisions:
  - "Grouped derived state: Time slots ordered (morning/afternoon/evening), categories alphabetical"
  - "Clone trigger in layout: When getOrCreateDailyList returns needsClone, trigger cloneMasterToDaily"
  - "Optimistic toggle: Update UI immediately, persist to IndexedDB, queue for sync"
  - "Replace Tailwind with scoped CSS: App layout and page now use plain CSS"

patterns-established:
  - "Daily chore grouping: $derived.by() for hierarchical grouping logic"
  - "Clone-on-demand: Layout handles clone trigger via effect watching query result"
  - "Multi-table sync: Sync engine routes mutations to correct API based on table name"

# Metrics
duration: 4min
completed: 2026-02-02
---

# Phase 4 Plan 3: Daily Chore List Summary

**DailyChoreStore with grouped display, one-tap completion, real-time sync, and proper CSS styling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-02T23:53:36Z
- **Completed:** 2026-02-02T23:57:20Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Created DailyChoreStore with reactive state and derived grouping by time slot and category
- Added IndexedDB operations for daily chores (get, getByDate, put, putBatch, delete)
- Extended sync engine to handle dailyChores table mutations (create and update)
- Updated app layout to subscribe to daily chores and trigger cloning when needed
- Built daily chore list page with progress bar, time slot sections, and category groups
- Replaced non-functional Tailwind classes with scoped CSS in layout and page

## Task Commits

Each task was committed atomically:

1. **Task 1: Create daily chore store with grouping and IndexedDB operations** - `a061b6d` (feat)
2. **Task 2: Update sync engine to handle daily chores** - `da9824e` (feat)
3. **Task 3: Update app layout and page for daily chores** - `39e3513` (feat)

## Files Created/Modified

- `src/lib/stores/dailyChores.svelte.ts` - Reactive store with grouped derived state, hydration, toggle
- `src/lib/db/operations.ts` - Added getDailyChore, getDailyChoresByDate, putDailyChore, putDailyChores, deleteDailyChore
- `src/lib/sync/engine.svelte.ts` - Added dailyChores case with applyDailyChoresMutation helper
- `src/routes/(app)/+layout.svelte` - Daily chores subscription, clone trigger, fixed CSS
- `src/routes/(app)/+page.svelte` - Complete rewrite with daily chore list UI

## Decisions Made

- **Grouped display structure:** Time slots are ordered (morning, afternoon, evening). Within each slot, categories are sorted alphabetically. Within each category, chores are sorted by sortOrder.
- **Clone trigger location:** The clone-on-demand is triggered in the app layout when the query returns `{ needsClone: true, date }`. This ensures cloning happens once per day on first access.
- **Optimistic updates:** Completion toggle updates UI immediately, persists to IndexedDB with `pending` syncStatus, then queues mutation for Convex sync.
- **CSS migration:** Replaced Tailwind utility classes with scoped CSS in both layout and page components, fixing the styling issues noted in CLAUDE.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed non-functional Tailwind styling**

- **Found during:** Task 3
- **Issue:** Layout and page had Tailwind classes but Tailwind is not installed
- **Fix:** Replaced all Tailwind classes with scoped CSS in `<style>` blocks
- **Files modified:** src/routes/(app)/+layout.svelte, src/routes/(app)/+page.svelte
- **Commit:** `39e3513`

## Issues Encountered

None - all tasks completed successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Daily chore list displays with proper grouping
- Completion toggle works with optimistic updates and sync
- Real-time sync via Convex subscription
- Clone-on-demand ensures daily list exists on first access
- Ready for Plan 04-02 (Master Chore Admin) to manage the source chores

---
*Phase: 04-core-chore-workflow*
*Completed: 2026-02-02*
