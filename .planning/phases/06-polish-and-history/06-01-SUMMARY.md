---
phase: 06-polish-and-history
plan: 01
subsystem: ui
tags: [svelte, sync, offline-first, accessibility, css-animations]

# Dependency graph
requires:
  - phase: 05-photo-verification
    provides: Photo capture and sync infrastructure
  - phase: 04-core-chore-workflow
    provides: Daily chore store and sync engine
provides:
  - Reusable SyncStatusBadge component with pending/synced/failed states
  - Visual sync status feedback on each chore item
  - Global retry button for failed syncs
  - markFailed method on dailyChoreStore
  - resetFailedToPending method for retry flow
affects: [06-02-history, any-future-sync-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS-only pulse animation for pending indicator"
    - "Component-based sync status display pattern"
    - "Store method for marking items as failed"

key-files:
  created:
    - src/lib/components/SyncStatusBadge.svelte
  modified:
    - src/routes/(app)/+page.svelte
    - src/lib/sync/engine.svelte.ts
    - src/lib/stores/dailyChores.svelte.ts
    - src/lib/db/operations.ts

key-decisions:
  - "Synced status is hidden (opacity 0) for clean UI - no visual noise when fully synced"
  - "44px minimum touch target on sync badge for accessibility and future tap-to-retry"
  - "Combined retry button handles both mutation queue and photo queue failures"
  - "markFailed propagates to store for immediate UI update"

patterns-established:
  - "SyncStatusBadge: Reusable component for displaying sync state"
  - "Store methods for marking items as synced/failed"

# Metrics
duration: 4min
completed: 2026-02-02
---

# Phase 6 Plan 01: Sync Status Indicators Summary

**SyncStatusBadge component with CSS pulse animation, integrated into chore list with global retry capability for failed syncs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-02T10:45:00Z
- **Completed:** 2026-02-02T10:49:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Created reusable SyncStatusBadge component with pending (pulsing amber dot), synced (hidden), and failed (red exclamation) states
- Integrated sync status badges into chore list, replacing inline spans
- Added global retry button in header that appears when failed count > 0
- Enhanced sync engine to mark dailyChores as failed and reset them on retry

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SyncStatusBadge component** - `a20a83d` (feat)
2. **Task 2: Integrate SyncStatusBadge into chore list** - `867bab2` (feat)
3. **Task 3: Add retry capability to sync engine** - `7e0c14d` (feat)

## Files Created/Modified
- `src/lib/components/SyncStatusBadge.svelte` - Reusable sync status indicator with CSS animations
- `src/routes/(app)/+page.svelte` - Chore list with sync badges and retry button
- `src/lib/sync/engine.svelte.ts` - Enhanced retry logic for daily chores
- `src/lib/stores/dailyChores.svelte.ts` - markFailed and resetFailedToPending methods
- `src/lib/db/operations.ts` - getDailyChoresByStatus helper function

## Decisions Made
- Synced state is hidden (opacity: 0) to keep UI clean when all items are synced
- Used 44px minimum touch target for accessibility and future tap-to-retry per item
- Retry button calls both retryFailed() and retryFailedPhotos() to handle all failure types
- CSS-only pulse animation (no JavaScript) for better performance on mobile devices

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added markFailed and resetFailedToPending to dailyChoreStore**
- **Found during:** Task 3 (Verify/enhance sync engine retry)
- **Issue:** Sync engine marked mutations as failed but didn't update chore syncStatus in IndexedDB/store
- **Fix:** Added markFailed method to update store state, resetFailedToPending for retry, getDailyChoresByStatus helper
- **Files modified:** src/lib/stores/dailyChores.svelte.ts, src/lib/db/operations.ts, src/lib/sync/engine.svelte.ts
- **Verification:** Code paths link failed mutations to chore syncStatus and reset on retry
- **Committed in:** 7e0c14d (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for failed state to be visible in UI. Without this, chores with failed syncs would show as pending forever.

## Issues Encountered
None - plan executed smoothly with one enhancement needed for complete retry flow.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sync status indicators complete and functional
- Ready for Plan 06-02: 7-Day History View
- All sync state is now visible to users with retry capability

---
*Phase: 06-polish-and-history*
*Completed: 2026-02-02*
