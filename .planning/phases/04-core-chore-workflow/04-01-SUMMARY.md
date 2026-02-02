---
phase: 04-core-chore-workflow
plan: 01
subsystem: database
tags: [convex, indexeddb, zod, offline-first, master-detail]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: IndexedDB infrastructure, sync patterns, Zod schemas
  - phase: 03-auth-and-access
    provides: Admin authentication for master chore CRUD
provides:
  - masterChores table with admin-protected CRUD
  - dailyChores table with clone-from-master and ad-hoc support
  - IndexedDB dailyChores store for offline persistence
  - Date utilities for daily chore logic
affects: [04-02, 04-03, 05-photo-verification, 06-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-table master/daily pattern for recurring tasks
    - On-demand daily clone (not scheduled cron)
    - clientId for offline-first idempotency on daily chores

key-files:
  created:
    - src/convex/masterChores.ts
    - src/convex/dailyChores.ts
    - src/lib/utils/date.ts
  modified:
    - src/convex/schema.ts
    - src/lib/db/schema.ts
    - src/lib/db/client.ts

key-decisions:
  - "Two-table pattern: masterChores (templates) vs dailyChores (instances)"
  - "On-demand clone on first access each day, not scheduled cron"
  - "Master chore CRUD requires admin authentication"
  - "Daily chore toggle uses clientId for offline-first compatibility"
  - "Soft delete for masterChores via isActive flag"
  - "IndexedDB version 2 migration for dailyChores store"

patterns-established:
  - "Master/daily pattern: Admin manages templates, daily instances cloned on access"
  - "Idempotent cloning: cloneMasterToDaily checks for existing daily list first"
  - "Last-write-wins: toggleComplete respects lastModified timestamp"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 4 Plan 1: Data Layer Foundation Summary

**Convex masterChores/dailyChores tables with admin CRUD, on-demand daily cloning, and IndexedDB v2 migration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T23:46:53Z
- **Completed:** 2026-02-02T23:49:58Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- masterChores and dailyChores tables added to Convex schema with proper indexes
- Admin-protected master chore CRUD (list, create, update, remove)
- Daily chore APIs: getOrCreateDailyList, cloneMasterToDaily, toggleComplete, addAdHoc
- IndexedDB schema extended to version 2 with dailyChores store
- Date utilities for daily logic (getTodayDateString, formatTimeSlot, getCurrentTimeSlot)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Convex schema** - `417a6fe` (feat)
2. **Task 2: Create master and daily chores APIs** - `28032fa` (feat)
3. **Task 3: Extend IndexedDB schema** - `e1104bc` (feat)

## Files Created/Modified

- `src/convex/schema.ts` - Added masterChores and dailyChores table definitions
- `src/convex/masterChores.ts` - Admin CRUD for master chore templates
- `src/convex/dailyChores.ts` - Daily list queries and mutations
- `src/lib/utils/date.ts` - Date utilities for daily chore logic
- `src/lib/db/schema.ts` - DailyChore Zod schema, DB_VERSION 2
- `src/lib/db/client.ts` - dailyChores store interface and migration

## Decisions Made

- **Two-table pattern:** masterChores holds templates, dailyChores holds daily instances. Changes to master only affect future days.
- **On-demand clone:** Daily list cloned on first access via getOrCreateDailyList returning `{ needsClone: true }`. Avoids empty lists when no one uses app.
- **Admin protection:** All master chore operations check getAuthUserId + isAdmin. Daily operations are public (workers access via access keys).
- **clientId for offline:** Daily chores use clientId index for toggleComplete, enabling offline-first with last-write-wins.
- **Soft delete:** Master chores use `isActive: false` rather than hard delete, preserving audit trail.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without problems.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Convex schema deployed with both tables and all indexes
- APIs ready for UI integration in Plan 02 (Daily Chore List)
- IndexedDB migration in place for offline persistence
- Existing chores table marked deprecated, can be migrated/removed later

---
*Phase: 04-core-chore-workflow*
*Completed: 2026-02-02*
