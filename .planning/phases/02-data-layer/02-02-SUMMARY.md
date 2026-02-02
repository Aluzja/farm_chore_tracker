---
phase: "02"
plan: "02"
subsystem: data-layer
tags: [sync, offline-first, convex, indexeddb, mutation-queue]
dependency-graph:
  requires: ["02-01"]
  provides: ["mutation-queue", "sync-engine", "convex-chores-api", "connection-status"]
  affects: ["02-03", "03-xx", "04-xx"]
tech-stack:
  added: []
  patterns: ["offline-first sync", "mutation queue", "idempotent mutations", "last-write-wins"]
key-files:
  created:
    - src/lib/sync/queue.ts
    - src/lib/sync/status.svelte.ts
    - src/lib/sync/engine.svelte.ts
    - src/convex/chores.ts
  modified:
    - src/convex/schema.ts
    - src/convex/_generated/api.d.ts
decisions:
  - id: "convex-client-global"
    choice: "Global client via setConvexClient/getConvexClient instead of context"
    reason: "Sync engine needs client access outside Svelte component context"
  - id: "idempotent-mutations"
    choice: "clientId index for create idempotency, last-write-wins for updates"
    reason: "Safe retry behavior for offline-first sync"
metrics:
  duration: "3 min"
  completed: "2026-02-02"
---

# Phase 02 Plan 02: Sync Engine with Mutation Queue Summary

**Sync engine that queues offline mutations in IndexedDB and syncs to Convex when online, with idempotent mutations and retry logic**

## What Was Built

### Mutation Queue (src/lib/sync/queue.ts)
- `enqueueMutation(type, table, payload)` - Queue mutations for offline sync
- `getPendingMutations()` - Get all pending mutations ordered by creation time
- `removeMutation(id)` - Remove synced mutation from queue
- `incrementRetry(id)` - Increment retry count, returns new count
- `markFailed(id)` - Mark mutation as failed after max retries
- `getQueueLength()` / `clearQueue()` - Queue utilities

### Connection Status (src/lib/sync/status.svelte.ts)
- `connectionStatus.isOnline` - Reactive online/offline state
- `connectionStatus.lastOnlineAt` - Timestamp for triggering sync
- Listens to `online`/`offline` events and `visibilitychange`
- Triggers sync when tab becomes visible while online

### Sync Engine (src/lib/sync/engine.svelte.ts)
- `syncEngine.init()` - Initialize engine with periodic sync
- `syncEngine.processQueue()` - Process pending mutations
- `syncEngine.retryFailed()` - Reset and retry failed mutations
- Reactive state: `isSyncing`, `pendingCount`, `failedCount`, `lastSyncedAt`, `lastError`
- `setConvexClient(client)` / `getConvexClient()` - Global client access

### Convex Chores API (src/convex/chores.ts)
- `api.chores.list` - Get all chores
- `api.chores.listSince(since)` - Delta sync query
- `api.chores.create(...)` - Idempotent create via clientId lookup
- `api.chores.update(...)` - Last-write-wins via lastModified
- `api.chores.remove(id)` - Idempotent delete

### Convex Schema (src/convex/schema.ts)
- `chores` table with clientId, text, isCompleted, completedAt, completedBy, lastModified
- Indexes: `by_last_modified`, `by_client_id`
- Kept `tasks` table for backwards compatibility

## Key Patterns

1. **Offline-First Mutation Queue**: All mutations go to IndexedDB first, then sync to Convex
2. **Idempotent Creates**: clientId stored in Convex, create checks for existing before insert
3. **Last-Write-Wins**: Updates compare lastModified timestamps
4. **Retry with Backoff**: 3 retries before marking failed, manual retry available
5. **Visibility-Based Sync**: Triggers sync when user returns to tab
6. **Global Client Access**: setConvexClient/getConvexClient for non-component code

## Commits

| Hash | Description |
|------|-------------|
| 3a0363b | feat(02-02): add mutation queue and connection status tracking |
| 6284f97 | feat(02-02): expand Convex schema with chores table and CRUD mutations |
| 7bef080 | feat(02-02): create sync engine with Convex integration |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Convex client access pattern**
- **Found during:** Task 3
- **Issue:** Plan used `getConvexClient` from convex-svelte, but package exports `useConvexClient` which requires Svelte component context
- **Fix:** Created own `setConvexClient`/`getConvexClient` for global client access outside component context
- **Files modified:** src/lib/sync/engine.svelte.ts
- **Commit:** 7bef080

## Verification Results

| Check | Status |
|-------|--------|
| `bun run build` | PASS |
| `bunx convex dev --once` | PASS (deployed schema + indexes) |
| File structure correct | PASS |
| Convex API types include chores | PASS |

**Note:** `bun run check` shows 4 pre-existing errors in `+layout.svelte` related to PWA virtual module types - not related to sync code.

## Next Phase Readiness

**Ready for 02-03:** Reactive Svelte stores and test UI

**Integration point:** Layout component needs to call `setConvexClient(client)` after getting client from convex-svelte context to enable sync engine.

**Testing needed:**
- Offline mutation queueing
- Online sync processing
- Retry behavior after failures
- Connection status reactivity
