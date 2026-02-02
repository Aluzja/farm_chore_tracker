# Phase 2: Data Layer - Research

**Researched:** 2026-02-01
**Domain:** Offline-first data architecture (IndexedDB, sync engine, Svelte 5 reactive stores)
**Confidence:** MEDIUM

## Summary

Phase 2 establishes a three-layer offline-first data architecture for the farm chore PWA. The research identifies the core challenge: bridging Convex's real-time sync (which requires connectivity) with local persistence and offline mutation queuing. The standard approach uses IndexedDB via the `idb` wrapper library for local persistence, a custom sync engine with mutation queue, and Svelte 5 runes for reactive state management.

Convex does NOT natively provide offline sync, though it does queue mutations during temporary network blips. For true offline-first with extended offline periods, we must build a sync layer that:
1. Persists data to IndexedDB as the local source of truth
2. Queues mutations when offline and syncs when online
3. Wraps IndexedDB with Svelte 5 reactive primitives for UI binding
4. Handles conflict resolution (last-write-wins for this use case)

**Primary recommendation:** Use `idb` (v8.x) for IndexedDB operations, build a custom sync engine with explicit mutation queue stored in IndexedDB, and create reactive Svelte 5 stores using `.svelte.ts` files with `$state` runes that read from/write to the sync layer.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | ^8.0.3 | Promise-based IndexedDB wrapper | Tiny (~1.2kB), maintained by Jake Archibald (Google), mirrors native API |
| zod | ^4.3.6 | Runtime type validation | TypeScript-first, validates data at IndexedDB and sync boundaries |
| convex | 1.31.7 | (existing) Backend with real-time sync | Already installed, provides authoritative server state |
| convex-svelte | 0.0.12 | (existing) Svelte 5 Convex bindings | Already installed, provides useQuery/useMutation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| idb-keyval | ^6.2.1 | Simple key-value IndexedDB | Only if complex schema not needed (not recommended for this project) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| idb | Dexie.js | More features (liveQuery, bulk ops, cloud sync addon) but larger bundle (~30kB), adds abstraction layer |
| Custom sync engine | Automerge + Convex | CRDT-based merge, but adds complexity and 50kB+ bundle size for simple use case |
| Custom sync engine | Convex Curvilinear | Alpha-stage Convex offline engine, not production-ready yet |
| Mutation queue | Background Sync API | Native browser API for queuing, but Safari/Firefox don't support it |

**Installation:**
```bash
bun add idb zod
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── db/                     # IndexedDB layer
│   │   ├── schema.ts           # Zod schemas + DB version/stores
│   │   ├── client.ts           # idb wrapper, openDB, migrations
│   │   └── operations.ts       # CRUD operations on IndexedDB
│   ├── sync/                   # Sync engine
│   │   ├── engine.svelte.ts    # Main sync orchestrator (reactive)
│   │   ├── queue.ts            # Mutation queue operations
│   │   └── status.svelte.ts    # Connection/sync status state
│   └── stores/                 # Reactive stores for UI
│       ├── chores.svelte.ts    # Chore data store
│       └── tasks.svelte.ts     # (example) Task data store
├── convex/                     # Convex functions
│   └── schema.ts               # Server-side schema
└── routes/
    └── ...
```

### Pattern 1: IndexedDB Schema with Zod Validation
**What:** Define IndexedDB object stores with Zod schemas for type safety
**When to use:** Always - ensures data integrity at storage boundary
**Example:**
```typescript
// src/lib/db/schema.ts
import { z } from 'zod';

export const DB_NAME = 'kitchen-sink-farm';
export const DB_VERSION = 1;

// Zod schemas for validation
export const ChoreSchema = z.object({
  _id: z.string(),
  text: z.string(),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime().optional(),
  completedBy: z.string().optional(),
  syncStatus: z.enum(['pending', 'synced', 'failed']),
  lastModified: z.number(),
});

export const MutationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['create', 'update', 'delete']),
  table: z.string(),
  payload: z.record(z.unknown()),
  createdAt: z.number(),
  retryCount: z.number().default(0),
});

export type Chore = z.infer<typeof ChoreSchema>;
export type Mutation = z.infer<typeof MutationSchema>;

export const STORES = {
  chores: 'chores',
  mutationQueue: 'mutationQueue',
} as const;
```
Source: Zod documentation (https://zod.dev/)

### Pattern 2: idb Database Initialization with Migrations
**What:** Open IndexedDB with version-based migrations
**When to use:** Always - required for IndexedDB schema management
**Example:**
```typescript
// src/lib/db/client.ts
import { openDB, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, STORES } from './schema';

export type AppDB = IDBPDatabase<{
  chores: { key: string; value: Chore };
  mutationQueue: { key: string; value: Mutation };
}>;

let dbPromise: Promise<AppDB> | null = null;

export function getDB(): Promise<AppDB> {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Version 1: Initial schema
        if (oldVersion < 1) {
          const choreStore = db.createObjectStore(STORES.chores, { keyPath: '_id' });
          choreStore.createIndex('syncStatus', 'syncStatus');
          choreStore.createIndex('lastModified', 'lastModified');

          const queueStore = db.createObjectStore(STORES.mutationQueue, { keyPath: 'id' });
          queueStore.createIndex('createdAt', 'createdAt');
        }
        // Future migrations: if (oldVersion < 2) { ... }
      },
      blocked() {
        console.warn('[DB] Database blocked - close other tabs');
      },
      blocking() {
        console.warn('[DB] Database blocking - this tab has old version');
      },
    });
  }
  return dbPromise;
}
```
Source: idb GitHub (https://github.com/jakearchibald/idb)

### Pattern 3: Mutation Queue for Offline Operations
**What:** Queue writes to IndexedDB when offline, process when online
**When to use:** For all mutations that need server sync
**Example:**
```typescript
// src/lib/sync/queue.ts
import { getDB } from '../db/client';
import { STORES, MutationSchema, type Mutation } from '../db/schema';

export async function enqueueMutation(
  type: Mutation['type'],
  table: string,
  payload: Record<string, unknown>
): Promise<string> {
  const db = await getDB();
  const mutation: Mutation = {
    id: crypto.randomUUID(),
    type,
    table,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  };

  // Validate before storing
  MutationSchema.parse(mutation);

  await db.add(STORES.mutationQueue, mutation);
  return mutation.id;
}

export async function getPendingMutations(): Promise<Mutation[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORES.mutationQueue, 'createdAt');
}

export async function removeMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORES.mutationQueue, id);
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORES.mutationQueue, 'readwrite');
  const mutation = await tx.store.get(id);
  if (mutation) {
    mutation.retryCount += 1;
    await tx.store.put(mutation);
  }
  await tx.done;
}
```

### Pattern 4: Reactive Svelte 5 Store with IndexedDB
**What:** Create reactive state that syncs with IndexedDB using $state rune
**When to use:** For all UI-bound data
**Example:**
```typescript
// src/lib/stores/chores.svelte.ts
import { getDB } from '../db/client';
import { STORES, ChoreSchema, type Chore } from '../db/schema';

// Must be .svelte.ts for runes
class ChoreStore {
  items = $state<Chore[]>([]);
  isLoading = $state(true);
  error = $state<Error | null>(null);

  async load() {
    try {
      this.isLoading = true;
      const db = await getDB();
      const chores = await db.getAll(STORES.chores);
      // Validate data from IndexedDB
      this.items = chores.map(c => ChoreSchema.parse(c));
    } catch (e) {
      this.error = e instanceof Error ? e : new Error(String(e));
    } finally {
      this.isLoading = false;
    }
  }

  async add(chore: Omit<Chore, '_id' | 'syncStatus' | 'lastModified'>) {
    const newChore: Chore = {
      ...chore,
      _id: crypto.randomUUID(),
      syncStatus: 'pending',
      lastModified: Date.now(),
    };

    // Optimistic update
    this.items = [...this.items, newChore];

    // Persist to IndexedDB
    const db = await getDB();
    await db.put(STORES.chores, newChore);

    // Queue for sync
    await enqueueMutation('create', 'chores', newChore);
  }
}

export const choreStore = new ChoreStore();
```

### Pattern 5: Sync Engine with Online/Offline Detection
**What:** Orchestrate sync between IndexedDB and Convex
**When to use:** As the central sync coordinator
**Example:**
```typescript
// src/lib/sync/engine.svelte.ts
import { browser } from '$app/environment';
import { getPendingMutations, removeMutation, incrementRetry } from './queue';

class SyncEngine {
  isOnline = $state(browser ? navigator.onLine : true);
  isSyncing = $state(false);
  pendingCount = $state(0);
  lastSyncedAt = $state<number | null>(null);

  private convexClient: ConvexClient | null = null;

  init(client: ConvexClient) {
    this.convexClient = client;

    if (browser) {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.processQueue();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  async processQueue() {
    if (!this.isOnline || this.isSyncing || !this.convexClient) return;

    this.isSyncing = true;
    const mutations = await getPendingMutations();
    this.pendingCount = mutations.length;

    for (const mutation of mutations) {
      try {
        // Apply to Convex
        await this.applyMutation(mutation);
        await removeMutation(mutation.id);
        this.pendingCount -= 1;
      } catch (error) {
        if (mutation.retryCount < 3) {
          await incrementRetry(mutation.id);
        } else {
          // Mark as failed after 3 retries
          await this.markFailed(mutation.id);
        }
      }
    }

    this.lastSyncedAt = Date.now();
    this.isSyncing = false;
  }

  private async applyMutation(mutation: Mutation) {
    // Map mutation to Convex mutation call
    // Implementation depends on Convex function definitions
  }
}

export const syncEngine = new SyncEngine();
```

### Pattern 6: Hydrating Local Store from Convex
**What:** Sync Convex real-time data to IndexedDB when online
**When to use:** On initial load and when receiving server updates
**Example:**
```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { setupConvex, useQuery } from 'convex-svelte';
  import { PUBLIC_CONVEX_URL } from '$env/static/public';
  import { syncEngine } from '$lib/sync/engine.svelte';
  import { choreStore } from '$lib/stores/chores.svelte';
  import { api } from '../convex/_generated/api';

  if (browser) {
    setupConvex(PUBLIC_CONVEX_URL);

    // Load local data first (instant)
    choreStore.load();

    // Then hydrate from server when online
    const serverChores = useQuery(api.chores.list, {});

    $effect(() => {
      if (serverChores.data && syncEngine.isOnline) {
        choreStore.hydrateFromServer(serverChores.data);
      }
    });
  }
</script>
```

### Anti-Patterns to Avoid
- **Reading Proxy objects into IndexedDB:** Use `$state.snapshot()` to get plain objects before storing
- **Blocking UI on IndexedDB:** Always use async operations, show loading states
- **Storing sensitive data without consideration:** IndexedDB is not encrypted; don't store secrets
- **Ignoring storage quota:** Request persistent storage with `navigator.storage.persist()` for critical data
- **Assuming Background Sync works everywhere:** Safari and Firefox don't support it; use manual polling fallback

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB promise wrapper | Callback-based IDB code | idb | Native API is callback hell, idb is tiny and battle-tested |
| Runtime type validation | Manual type checks | Zod | Catches data corruption at boundaries, generates TS types |
| Unique ID generation | Custom ID scheme | crypto.randomUUID() | Built into browser, UUID v4 is collision-resistant |
| Online/offline detection | Custom polling | navigator.onLine + events | Native API, fires events automatically |
| Time-based sync ordering | Custom timestamps | Date.now() + monotonic counter | Simple last-write-wins is sufficient for this use case |

**Key insight:** The temptation is to use full CRDT solutions (Yjs, Automerge) for offline sync. These are overkill for farm chores where last-write-wins conflict resolution is acceptable. CRDTs add 50KB+ bundle size and significant complexity.

## Common Pitfalls

### Pitfall 1: IndexedDB Quota Exceeded
**What goes wrong:** Storage quota fills up, writes silently fail
**Why it happens:** IndexedDB has limited storage, photos can fill it fast
**How to avoid:**
- Request persistent storage: `await navigator.storage.persist()`
- Monitor quota: `await navigator.storage.estimate()`
- Implement cleanup for old data (7-day history limit)
**Warning signs:** Writes succeed but data missing on reload

### Pitfall 2: Svelte 5 Proxy Objects in IndexedDB
**What goes wrong:** IndexedDB throws "DataCloneError" or stores Proxy wrapper
**Why it happens:** $state returns Proxy objects that can't be cloned
**How to avoid:** Always use `$state.snapshot()` before storing
**Warning signs:** "DOMException: Failed to execute 'put'" errors

### Pitfall 3: Race Conditions in Sync
**What goes wrong:** Stale local data overwrites newer server data
**Why it happens:** Sync completes out of order, no timestamp comparison
**How to avoid:**
- Track `lastModified` timestamp on all records
- Compare timestamps before applying updates
- Server wins when timestamps are equal
**Warning signs:** Data reverts to old values after sync

### Pitfall 4: Memory Leaks from Unsubscribed Queries
**What goes wrong:** Convex subscriptions keep accumulating, memory grows
**Why it happens:** useQuery subscriptions not cleaned up on component unmount
**How to avoid:** convex-svelte handles cleanup automatically, but ensure components properly destroy
**Warning signs:** Memory usage grows, network tab shows accumulating subscriptions

### Pitfall 5: iOS Safari IndexedDB Quirks
**What goes wrong:** IndexedDB behaves differently on iOS, quota issues
**Why it happens:** Safari has smaller quota, more aggressive eviction
**How to avoid:**
- Always request persistent storage
- Handle storage errors gracefully
- Test on actual iOS devices
**Warning signs:** Works on desktop Safari, fails on iOS

### Pitfall 6: Sync Queue Never Processes
**What goes wrong:** Mutations queue up but never sync
**Why it happens:** Online event doesn't fire, or initial sync check missed
**How to avoid:**
- Process queue on app load if online
- Set up periodic sync check (every 30s when online)
- Provide manual "sync now" button
**Warning signs:** pendingCount stays high, lastSyncedAt never updates

## Code Examples

Verified patterns from official sources and research:

### Complete idb Database Setup
```typescript
// src/lib/db/client.ts
// Source: https://github.com/jakearchibald/idb
import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

interface KitchenSinkDB extends DBSchema {
  chores: {
    key: string;
    value: {
      _id: string;
      text: string;
      isCompleted: boolean;
      completedAt?: string;
      completedBy?: string;
      syncStatus: 'pending' | 'synced' | 'failed';
      lastModified: number;
    };
    indexes: {
      'by-sync-status': string;
      'by-last-modified': number;
    };
  };
  mutationQueue: {
    key: string;
    value: {
      id: string;
      type: 'create' | 'update' | 'delete';
      table: string;
      payload: Record<string, unknown>;
      createdAt: number;
      retryCount: number;
    };
    indexes: {
      'by-created-at': number;
    };
  };
}

export async function initDB(): Promise<IDBPDatabase<KitchenSinkDB>> {
  return openDB<KitchenSinkDB>('kitchen-sink-farm', 1, {
    upgrade(db) {
      // Chores store
      const choreStore = db.createObjectStore('chores', { keyPath: '_id' });
      choreStore.createIndex('by-sync-status', 'syncStatus');
      choreStore.createIndex('by-last-modified', 'lastModified');

      // Mutation queue store
      const queueStore = db.createObjectStore('mutationQueue', { keyPath: 'id' });
      queueStore.createIndex('by-created-at', 'createdAt');
    },
  });
}
```

### Zod Schema with Convex Type Alignment
```typescript
// src/lib/db/schema.ts
// Source: https://zod.dev/
import { z } from 'zod';

// Match Convex schema structure
export const ChoreSchema = z.object({
  _id: z.string(),  // Will be Convex Id<"chores"> on server
  text: z.string().min(1),
  isCompleted: z.boolean(),
  completedAt: z.string().datetime().optional(),
  completedBy: z.string().optional(),
  // Local-only fields
  syncStatus: z.enum(['pending', 'synced', 'failed']).default('pending'),
  lastModified: z.number().default(() => Date.now()),
});

export type Chore = z.infer<typeof ChoreSchema>;

// Validate before IndexedDB write
export function validateChore(data: unknown): Chore {
  return ChoreSchema.parse(data);
}

// Validate array from IndexedDB read
export function validateChores(data: unknown[]): Chore[] {
  return z.array(ChoreSchema).parse(data);
}
```

### Persistent Storage Request
```typescript
// src/lib/db/storage.ts
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    console.warn('[Storage] Persistent storage API not available');
    return false;
  }

  const isPersisted = await navigator.storage.persisted();
  if (isPersisted) {
    return true;
  }

  const granted = await navigator.storage.persist();
  if (granted) {
    console.log('[Storage] Persistent storage granted');
  } else {
    console.warn('[Storage] Persistent storage denied - data may be evicted');
  }
  return granted;
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
```

### Reactive Online Status
```typescript
// src/lib/sync/status.svelte.ts
import { browser } from '$app/environment';

class ConnectionStatus {
  isOnline = $state(browser ? navigator.onLine : true);

  constructor() {
    if (browser) {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = () => {
    this.isOnline = true;
  };

  private handleOffline = () => {
    this.isOnline = false;
  };

  destroy() {
    if (browser) {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }
}

export const connectionStatus = new ConnectionStatus();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for offline data | IndexedDB for structured data | 2018+ | Async, larger quota, proper indexing |
| Svelte stores for state | Svelte 5 runes ($state, $derived) | 2024 | Universal reactivity, class-based stores |
| PouchDB for offline sync | Direct idb + custom sync | 2023+ | PouchDB less maintained, simpler solutions preferred |
| Full CRDT libraries always | Last-write-wins for simple cases | 2024+ | CRDTs add complexity when conflicts are rare |
| Background Sync API | Manual sync with online events | 2025 | Safari/Firefox still don't support Background Sync |

**Deprecated/outdated:**
- localStorage for app data: Synchronous, blocks main thread, 5MB limit
- Svelte writable stores: Still work but runes preferred in Svelte 5
- service worker Cache API for data: Use for assets only, not structured data

## Open Questions

Things that couldn't be fully resolved:

1. **Convex offline mutation behavior details**
   - What we know: Convex queues mutations during brief network blips
   - What's unclear: Exact timeout before mutation fails, behavior during extended offline
   - Recommendation: Don't rely on Convex's built-in queueing; implement our own for reliability

2. **Convex Curvilinear production readiness**
   - What we know: Alpha-stage offline sync engine from Convex team
   - What's unclear: Timeline for production release, API stability
   - Recommendation: Build custom sync for now; evaluate Curvilinear for v2 if released

3. **iOS Safari storage quota under pressure**
   - What we know: iOS is more aggressive about evicting IndexedDB
   - What's unclear: Exact eviction triggers, whether persistent storage actually prevents eviction
   - Recommendation: Test thoroughly on iOS; implement graceful degradation

4. **convex-svelte vs Convelt for Svelte 5**
   - What we know: Convelt is community fork with Svelte 5 improvements
   - What's unclear: Long-term maintenance, whether official package will catch up
   - Recommendation: Stick with official convex-svelte for now; it works

## Sources

### Primary (HIGH confidence)
- [idb GitHub](https://github.com/jakearchibald/idb) - API reference, version 8.0.3
- [Zod Documentation](https://zod.dev/) - Schema validation patterns
- [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) - Native API reference
- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/$state) - Runes and reactivity
- [Convex Svelte Docs](https://docs.convex.dev/client/svelte) - Official integration guide

### Secondary (MEDIUM confidence)
- [LogRocket: Offline-first frontend apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - Ecosystem overview
- [Convex Automerge Integration](https://stack.convex.dev/automerge-and-convex) - Local-first patterns with Convex
- [Convex Curvilinear](https://github.com/get-convex/curvilinear) - Alpha offline sync engine
- [Can I Use: Background Sync](https://caniuse.com/background-sync) - Browser support data (80% global, no Safari/Firefox)
- [web.dev Offline Data](https://web.dev/learn/pwa/offline-data) - PWA patterns

### Tertiary (LOW confidence)
- WebSearch results for "offline mutation queue patterns" - patterns verified against official docs
- Community discussions on Dexie vs idb - preference validated by bundle size analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - idb and Zod are well-documented, stable libraries with clear APIs
- Architecture: MEDIUM - Patterns derived from multiple sources but custom implementation required
- Pitfalls: MEDIUM - Combination of official docs and community experience; iOS quirks need validation

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable ecosystem)
