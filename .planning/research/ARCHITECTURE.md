# Architecture Patterns

**Domain:** SvelteKit + Convex PWA with Offline Support
**Researched:** 2026-02-01
**Overall Confidence:** MEDIUM (based on training data; verify Convex-specific patterns with official docs)

## Executive Summary

This architecture research addresses integrating Convex as a real-time backend into an existing SvelteKit application while maintaining full offline functionality. The core challenge is that Convex is designed as an always-online real-time database, so offline support requires a deliberate offline-first data layer that sits between the UI and Convex.

The recommended architecture uses a **three-layer data model**: local-first storage (IndexedDB) for offline resilience, a sync engine for queue management and conflict resolution, and Convex for authoritative server state with real-time subscriptions.

## Recommended Architecture

```
+------------------------------------------------------------------+
|                         SvelteKit App                            |
|  +------------------------------------------------------------+  |
|  |                     UI Components                           |  |
|  |  (Svelte 5 components with reactive state via runes)        |  |
|  +-----------------------------+------------------------------+  |
|                                |                                  |
|                                v                                  |
|  +------------------------------------------------------------+  |
|  |                    Reactive Data Layer                      |  |
|  |  (Svelte stores wrapping offline-first state)               |  |
|  +-----------------------------+------------------------------+  |
|                                |                                  |
|                                v                                  |
|  +------------------------------------------------------------+  |
|  |                  Offline-First Data Layer                   |  |
|  |  +------------------+  +------------------+                |  |
|  |  | Local Store      |  | Sync Engine      |                |  |
|  |  | (IndexedDB)      |<->| (Queue Manager)  |                |  |
|  |  +------------------+  +--------+---------+                |  |
|  +-----------------------------+------------------------------+  |
|                                |                                  |
|                                v (when online)                    |
|  +------------------------------------------------------------+  |
|  |                    Convex Client Layer                      |  |
|  |  +------------------+  +------------------+                |  |
|  |  | Query Client     |  | Mutation Client  |                |  |
|  |  | (Subscriptions)  |  | (Optimistic)     |                |  |
|  +------------------+--+  +--------+---------+                |  |
|                     |              |                              |
+---------------------|--------------|-----------------------------+
                      |              |
                      v              v
+------------------------------------------------------------------+
|                      Convex Backend                              |
|  +------------------+  +------------------+  +----------------+  |
|  | Functions        |  | Database         |  | File Storage   |  |
|  | (Queries/Muts)   |  | (Documents)      |  | (Photos)       |  |
|  +------------------+  +------------------+  +----------------+  |
+------------------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Location |
|-----------|---------------|-------------------|----------|
| **UI Components** | Render chore lists, handle user input | Reactive Data Layer | `src/routes/`, `src/lib/components/` |
| **Reactive Data Layer** | Expose Svelte-friendly reactive state via stores | Offline-First Data Layer | `src/lib/stores/` |
| **Local Store** | Persist data to IndexedDB for offline access | Sync Engine | `src/lib/offline/store.ts` |
| **Sync Engine** | Queue mutations, process when online, handle conflicts | Local Store, Convex Client | `src/lib/offline/sync.ts` |
| **Convex Client** | Manage connection, execute queries/mutations | Convex Backend | `src/lib/convex/client.ts` |
| **Auth Guard** | Validate URL keys, manage admin sessions | Local Store, Convex | `src/lib/auth/` |
| **Service Worker** | Cache assets, intercept network requests | Browser Cache API | `src/service-worker.ts` |
| **Convex Functions** | Server-side logic for data operations | Convex Database | `convex/` directory |
| **File Storage** | Photo upload/download via Convex storage | Convex Client | `convex/` + `src/lib/photos/` |

### Data Flow

**1. Online Read Flow (Real-time Sync):**
```
User opens app
    -> SvelteKit hydrates page
    -> Convex client connects via WebSocket
    -> useQuery() subscribes to chores for today
    -> Convex pushes initial data
    -> Svelte store updates
    -> UI renders chore list
    -> Real-time updates pushed as other users modify
```

**2. Offline Read Flow:**
```
User opens app (offline)
    -> SvelteKit renders from service worker cache
    -> Convex connection fails (offline)
    -> Fallback to IndexedDB local store
    -> Svelte store loads cached data
    -> UI renders stale but usable chore list
    -> Visual indicator shows offline state
```

**3. Mutation Flow (Online):**
```
User marks chore complete
    -> UI handler calls mutation function
    -> Optimistic update to local store (instant feedback)
    -> Sync engine checks online status
    -> Convex mutation executed
    -> Server confirms, updates local state
    -> Real-time update broadcast to other clients
```

**4. Mutation Flow (Offline with Queue):**
```
User marks chore complete (offline)
    -> UI handler calls mutation function
    -> Optimistic update to local store (instant feedback)
    -> Sync engine detects offline
    -> Mutation added to pending queue (IndexedDB)
    -> UI shows pending indicator
    ...later, network restored...
    -> Online event detected
    -> Sync engine processes queue sequentially
    -> Each mutation sent to Convex
    -> Server confirms, queue entry removed
    -> Real-time sync resumes
```

**5. Photo Capture Flow:**
```
User taps camera on photo-required chore
    -> Browser MediaDevices API opens camera
    -> Photo captured as Blob
    -> Thumbnail generated (for fast display)
    -> Blob stored in IndexedDB with chore reference
    -> If online: Upload to Convex file storage
    -> If offline: Queue for upload
    -> Chore record updated with photo reference
```

**6. Auth Flow (Admin vs User):**
```
Admin Login:
    -> Navigate to /admin/login
    -> Submit email/password
    -> Convex auth function validates
    -> Session token stored (httpOnly cookie or localStorage)
    -> Redirect to /admin with elevated permissions

User Access (URL Key):
    -> Navigate to /[key] (e.g., /abc123)
    -> Route param extracted
    -> Key validated against Convex (or cached validation)
    -> Key stored in localStorage for offline use
    -> Access granted to chore list
```

## Component Specifications

### 1. Convex Client Layer

**Purpose:** Manage connection to Convex and provide typed access to queries/mutations.

**Key Responsibilities:**
- Initialize Convex client with deployment URL
- Provide reactive query subscriptions (integrate with Svelte stores)
- Execute mutations with optimistic updates
- Handle connection state (online/offline/connecting)
- Expose file storage upload/download methods

**Implementation Pattern:**
```typescript
// src/lib/convex/client.ts
import { ConvexClient } from 'convex/browser';
import { writable } from 'svelte/store';

export const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

// Connection state as Svelte store
export const connectionState = writable<'online' | 'offline' | 'connecting'>('connecting');

convex.onTransition((newState) => {
  connectionState.set(newState === 'closed' ? 'offline' : 'online');
});
```

**Confidence:** MEDIUM - Convex SvelteKit integration patterns based on training data; specific API may differ.

### 2. Offline-First Data Layer

**Purpose:** Provide resilient data access regardless of network state.

**Key Components:**

**LocalStore (IndexedDB):**
- Store chores, daily lists, pending mutations, photos
- Use idb library (IndexedDB wrapper) for ergonomic API
- Structure: one object store per entity type
- Indexes on date, status, syncState

**SyncEngine:**
- Monitor online/offline state
- Maintain mutation queue
- Process queue on reconnection
- Handle conflict resolution (last-write-wins for chores)
- Track sync status per record

**Implementation Pattern:**
```typescript
// src/lib/offline/store.ts
import { openDB, type DBSchema } from 'idb';

interface FarmDB extends DBSchema {
  chores: {
    key: string;
    value: Chore;
    indexes: { 'by-date': string; 'by-status': string };
  };
  pendingMutations: {
    key: number;
    value: PendingMutation;
  };
  photos: {
    key: string;
    value: { id: string; choreId: string; blob: Blob; uploadStatus: string };
  };
}

export const db = await openDB<FarmDB>('KitchenSinkFarm', 1, {
  upgrade(db) {
    const choreStore = db.createObjectStore('chores', { keyPath: 'id' });
    choreStore.createIndex('by-date', 'date');
    choreStore.createIndex('by-status', 'status');
    db.createObjectStore('pendingMutations', { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('photos', { keyPath: 'id' });
  },
});
```

**Confidence:** HIGH - IndexedDB + idb is well-established pattern.

### 3. Service Worker

**Purpose:** Enable PWA installability, cache assets, support offline access.

**Key Responsibilities:**
- Cache static assets (app shell) on install
- Intercept fetch requests for offline fallback
- Handle background sync for queued mutations (if supported)
- Manage app updates (skip waiting, claim clients)

**Strategy:**
- **Static assets:** Cache-first (versioned on deploy)
- **API/Convex:** Network-first with offline fallback to IndexedDB
- **Photos:** Cache with network fallback

**SvelteKit Integration:**
- Use SvelteKit's service worker support via `src/service-worker.ts`
- Import generated build manifest for asset list
- Handle navigation requests to serve app shell

**Implementation Pattern:**
```typescript
// src/service-worker.ts
import { build, files, version } from '$service-worker';

const CACHE_NAME = `cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Skip Convex WebSocket traffic
  if (event.request.url.includes('convex')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
```

**Confidence:** HIGH - SvelteKit service worker pattern is well-documented.

### 4. Convex Backend (Server Functions)

**Purpose:** Implement server-side data logic, enforce authorization.

**Structure:**
```
convex/
  _generated/        # Auto-generated types and API
  schema.ts          # Database schema definition
  chores.ts          # Chore queries and mutations
  dailyLists.ts      # Daily list generation logic
  auth.ts            # Auth functions
  keys.ts            # Access key management
  storage.ts         # File storage helpers
```

**Key Schema:**

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  masterChores: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    timeSlot: v.union(v.literal('morning'), v.literal('afternoon'), v.literal('evening')),
    category: v.string(),
    requiresPhoto: v.boolean(),
    sortOrder: v.number(),
  }).index('by_timeSlot', ['timeSlot']),

  dailyLists: defineTable({
    date: v.string(), // YYYY-MM-DD
    generatedAt: v.number(),
    generatedBy: v.optional(v.string()),
  }).index('by_date', ['date']),

  dailyChores: defineTable({
    dailyListId: v.id('dailyLists'),
    masterChoreId: v.id('masterChores'),
    status: v.union(v.literal('pending'), v.literal('completed')),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.string()),
    photoId: v.optional(v.id('_storage')),
    date: v.string(),
  }).index('by_dailyList', ['dailyListId'])
    .index('by_date', ['date']),

  accessKeys: defineTable({
    key: v.string(),
    displayName: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.string(),
    expiresAt: v.optional(v.number()),
    revoked: v.boolean(),
  }).index('by_key', ['key']),

  admins: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index('by_email', ['email']),
});
```

**Confidence:** MEDIUM - Schema design based on project requirements; Convex schema API should be verified.

## Patterns to Follow

### Pattern 1: Optimistic Updates with Rollback

**What:** Update UI immediately, sync to server, rollback on failure.

**When:** All user mutations (marking chores complete, adding photos).

**Why:** Critical for perceived performance, especially with potentially slow rural connections.

**Example:**
```typescript
async function completeChore(choreId: string) {
  // 1. Optimistic update
  const previousState = await localStore.getChore(choreId);
  await localStore.updateChore(choreId, { status: 'completed', completedAt: Date.now() });

  try {
    // 2. Server sync
    await convex.mutation(api.chores.complete, { choreId });
  } catch (error) {
    // 3. Rollback on failure
    await localStore.updateChore(choreId, previousState);
    throw error;
  }
}
```

### Pattern 2: Queue-Based Offline Mutations

**What:** Queue mutations when offline, process sequentially when online.

**When:** Any write operation while disconnected.

**Why:** Ensures no data loss during connectivity gaps.

### Pattern 3: Svelte Store + Offline State Composition

**What:** Compose Svelte stores that abstract online/offline data sources.

**When:** All data-fetching scenarios.

**Why:** UI components don't care about data source; consistent API.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Convex Calls from UI

**What:** UI components calling Convex mutations directly without offline layer.

**Why bad:** App breaks completely when offline; no optimistic updates.

**Instead:** Always go through the offline-first data layer.

### Anti-Pattern 2: Storing Photos as Base64 in Database

**What:** Converting photos to base64 and storing in Convex documents.

**Why bad:** Bloats document size (33% larger than binary), slow to sync.

**Instead:** Use Convex file storage for photos. Store only the storage ID reference.

### Anti-Pattern 3: Polling for Updates

**What:** Using setInterval to repeatedly fetch data.

**Why bad:** Wastes bandwidth and battery, delayed updates.

**Instead:** Use Convex's real-time subscriptions.

### Anti-Pattern 4: Service Worker Caching Convex Traffic

**What:** Letting service worker cache Convex WebSocket/API traffic.

**Why bad:** Silently breaks real-time sync.

**Instead:** Explicitly exclude Convex endpoints from service worker cache.

## Suggested Build Order

Based on component dependencies:

### Phase 1: Foundation (No Dependencies)
1. **Convex Project Setup** - Initialize Convex, configure schema
2. **Service Worker Shell** - Basic asset caching, offline fallback
3. **IndexedDB Setup** - idb schema matching Convex schema

### Phase 2: Data Layer (Depends on Phase 1)
4. **Convex Client Integration** - Connect SvelteKit to Convex
5. **Sync Engine** - Queue management, online/offline detection
6. **Reactive Store Layer** - Svelte stores wrapping offline-first layer

### Phase 3: Core Features (Depends on Phase 2)
7. **Master Chore List** - Admin CRUD for chore templates
8. **Daily List Generation** - Clone master to daily on first access
9. **Chore Completion** - Mark complete with optimistic updates

### Phase 4: Extended Features (Depends on Phase 3)
10. **Photo Capture** - Camera integration, local storage
11. **Photo Sync** - Background upload to Convex storage
12. **Auth (Admin)** - Password login, protected routes
13. **Auth (Keys)** - URL key generation and validation

### Phase 5: Polish (Depends on Phase 4)
14. **Sync Status Indicators** - Visual feedback for pending/synced state
15. **History View** - 7-day completed chore history
16. **PWA Manifest** - Installability, icons, splash screens

---

*Architecture research: 2026-02-01*
*Confidence: MEDIUM - Verify Convex API and SvelteKit patterns against current docs*
