# Plan 02-03 Summary: Reactive Svelte stores and test UI

## Execution Time
- Started: 2026-02-02
- Completed: 2026-02-02
- Duration: ~15 min (including bug fixes)

## What Was Built

### Reactive Chore Store (`src/lib/stores/chores.svelte.ts`)
- Class-based store with Svelte 5 `$state` runes
- Optimistic updates for instant UI feedback
- `$state.snapshot()` for IndexedDB writes (avoids Proxy issues)
- Hydration from Convex with conflict resolution (last-write-wins)
- Pending delete tracking to prevent hydration conflicts
- Methods: `load()`, `add()`, `toggleComplete()`, `updateText()`, `remove()`
- Computed properties: `completedCount`, `pendingCount`, `failedCount`

### Layout Integration (`src/routes/+layout.svelte`)
- Convex client initialization with `useConvexClient()` at top level
- Real-time subscription via `useQuery(api.chores.list)`
- Hydration via `$effect` (legitimate use for third-party subscription data)
- Sync engine initialization in `onMount`
- SSR disabled via `+layout.ts` to avoid hydration issues with $state singletons

### Test UI (`src/routes/+page.svelte`)
- Status panel showing connection, sync state, pending/failed counts
- Add chore form with optimistic updates
- Chore list with completion toggle and delete
- Sync status indicators per item (pending/synced/failed)
- Storage quota display
- Retry button for failed mutations

## Bug Fixes During Implementation

1. **Convex mutation ID mismatch**: Changed update/delete mutations to use `clientId` field instead of `v.id("chores")`, added `by_client_id` index

2. **Hydration "Illegal invocation" error**: Module-level `$state` singletons caused SSR mismatch. Fixed by disabling SSR with `export const ssr = false`

3. **`useConvexClient` lifecycle error**: Was called inside `onMount` but uses `getContext()`. Moved to component top level

4. **`$effect.root` causing sync indicator stuck**: Replaced with direct `addEventListener` for online/visibility events per Svelte 5 best practices

5. **Mutations not syncing immediately**: Added `processQueue()` trigger in `enqueueMutation()`

6. **Delete not working**: Deleted items were re-added by hydration before sync completed. Added `pendingDeletes` tracking

7. **List flashing on state changes**: Added `hasChanges` check in `hydrateFromServer` to avoid unnecessary array replacements

## Key Patterns Established

- **$effect usage**: Only for third-party library integration (Convex subscription). Use `onMount` for one-time init, event listeners for browser events
- **Sync state updates**: Call `choreStore.markSynced()` and `choreStore.confirmDelete()` from sync engine after successful mutations
- **Optimistic UI**: Update reactive state immediately, persist to IndexedDB, queue mutation for sync

## Phase 2 Success Criteria Verification

| Criteria | Status |
|----------|--------|
| Data persists in IndexedDB across browser restarts | ✅ Verified |
| Mutations made offline queue and sync when online | ✅ Verified |
| Real-time updates appear within seconds | ✅ Verified |
| Sync failures are captured and retryable | ✅ Verified |

## Files Modified
- `src/lib/stores/chores.svelte.ts` (created)
- `src/lib/stores/index.ts` (created)
- `src/routes/+layout.svelte` (updated)
- `src/routes/+layout.ts` (created - SSR disable)
- `src/routes/+page.svelte` (replaced)
- `src/lib/sync/engine.svelte.ts` (updated - event listeners, choreStore integration)
- `src/lib/sync/queue.ts` (updated - immediate sync trigger)
- `src/convex/chores.ts` (updated - clientId-based mutations)
- `.planning/codebase/CONVENTIONS.md` (updated - $effect guidelines)

## Decisions Made
- SSR disabled for entire app (PWA + $state singletons)
- Direct event listeners instead of $effect for browser events
- Pending delete tracking for hydration conflict prevention
