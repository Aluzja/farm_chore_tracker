# Project Research Summary

**Project:** Kitchen Sink Farm - PWA Chore Tracker
**Domain:** SvelteKit + Convex PWA with Offline-First Real-Time Sync
**Researched:** 2026-02-01
**Confidence:** MEDIUM

## Executive Summary

Kitchen Sink Farm is a Progressive Web App for multi-user farm chore tracking with real-time synchronization via Convex, offline support for unreliable rural connectivity, and photo verification for accountability. This is a well-understood problem domain (task management + real-time collaboration) with a specific twist: offline-first architecture on top of a real-time backend that assumes connectivity.

The recommended approach uses Convex as the real-time backend with a deliberate three-layer data architecture: IndexedDB for local persistence, a sync engine for queuing offline mutations, and Convex for authoritative server state. The critical insight from research is that Convex is designed as an always-online system, so offline support must be built explicitly rather than relying on Convex's optimistic updates alone. vite-plugin-pwa with SvelteKit integration handles the PWA shell and service worker, but must explicitly exclude Convex traffic from caching to avoid breaking real-time sync.

The primary risks are: (1) service worker accidentally caching Convex WebSocket traffic, silently breaking real-time sync in production; (2) optimistic updates without proper rollback causing data loss when offline mutations fail on sync; (3) SvelteKit SSR conflicts with client-only Convex initialization causing hydration errors. All three are preventable with correct architecture from the start, but costly to fix if discovered late.

## Key Findings

### Recommended Stack

The existing SvelteKit 2.22 + Svelte 5 + Vite 7 stack is preserved. Additions focus on real-time sync (Convex), PWA capabilities (vite-plugin-pwa), and offline data persistence (idb for IndexedDB).

**Core technologies:**
- **Convex + convex-svelte**: Real-time backend with reactive subscriptions, built-in file storage, TypeScript-first. Eliminates WebSocket boilerplate for multi-user sync.
- **vite-plugin-pwa + @vite-pwa/sveltekit**: PWA manifest generation, service worker with precaching, handles SvelteKit's SSR quirks for service workers.
- **idb**: Lightweight IndexedDB wrapper for offline mutation queue and local data cache. Essential for bridging Convex's online-only model with offline requirements.
- **browser-image-compression**: Client-side photo compression before upload to reduce bandwidth in rural conditions.

**Installation (bun):**
```bash
# Core Convex
bun add convex convex-svelte

# PWA
bun add -D vite-plugin-pwa @vite-pwa/sveltekit

# Offline support
bun add idb

# Image handling
bun add browser-image-compression
```

### Expected Features

**Must have (table stakes):**
- Task completion toggle with visual feedback
- Task list organized by time-of-day (morning/afternoon/evening) and animal category
- Real-time sync showing other users' completions instantly
- Offline functionality with queued mutations
- Photo capture and attachment for verification
- Mobile-friendly UI with large touch targets
- PWA installability

**Should have (differentiators):**
- Master list to daily clone workflow (fresh start each day)
- Completion timestamps showing who did what when
- Photo requirement per-chore configuration
- 7-day history view
- Ad-hoc chore addition for unexpected tasks
- Sync status indicators (pending/synced/failed)

**Defer to v2+:**
- Batch operations (complete multiple chores at once)
- Notes/comments on completions
- Activity log for admin
- Export functionality

**Anti-features (explicitly avoid):**
- Push notifications (scoped out; farm workers check when ready)
- Chore assignment to specific users (first-come-first-served is simpler)
- Priority levels or due dates (time slots are sufficient)
- Gamification (farm work is not a game)

### Architecture Approach

The architecture uses a three-layer data model: UI components interact with Svelte stores that wrap an offline-first data layer, which coordinates between local IndexedDB storage and Convex subscriptions. The sync engine maintains a mutation queue processed sequentially when online, with last-write-wins conflict resolution for chore completions. Convex functions handle server-side logic and authorization; file storage uses Convex's built-in storage rather than external S3.

**Major components:**
1. **Reactive Data Layer** (`src/lib/stores/`) — Svelte stores wrapping offline-first state, abstracts data source from UI
2. **Offline-First Data Layer** (`src/lib/offline/`) — Local IndexedDB store + sync engine with mutation queue
3. **Convex Client Layer** (`src/lib/convex/`) — Connection management, query subscriptions, mutation execution
4. **Service Worker** (`src/service-worker.ts`) — Asset caching, offline fallback, explicitly excludes Convex traffic
5. **Convex Backend** (`convex/`) — Schema, queries, mutations, file storage helpers

### Critical Pitfalls

1. **Service Worker caching Convex WebSocket** — Explicitly exclude `*.convex.*` endpoints from service worker fetch handler. Test with production build + service worker enabled. This will silently break real-time sync if missed.

2. **Optimistic updates without rollback** — Implement mutation queue with status tracking (pending/synced/failed). Show visual indicators for unsynced items. Handle sync failures with user notification and retry mechanism. Otherwise, users think chores are done when they never persisted.

3. **SvelteKit SSR conflicts with Convex** — Initialize Convex only on client side using `$app/environment`'s `browser` check or route-level `ssr: false`. Convex requires browser APIs (WebSocket, localStorage).

4. **Photo upload without offline queue** — Store photos in IndexedDB immediately after capture, not just in memory. Keep in IndexedDB until server confirms receipt. Browser File API handles are transient and will be lost.

5. **Conflict resolution as afterthought** — Design last-write-wins strategy upfront with timestamps on all mutations. For this app, LWW is acceptable: if two users complete the same chore, one record is fine since the work was done.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation
**Rationale:** Convex integration and PWA shell must be correct before any features. SSR conflicts and service worker caching pitfalls must be addressed at project setup, not retrofitted.
**Delivers:** Working SvelteKit + Convex connection with proper client-only initialization, PWA manifest with installability, service worker that explicitly excludes Convex traffic.
**Addresses:** PWA shell (table stakes), basic app structure
**Avoids:** SSR conflicts (Pitfall 6), service worker caching Convex (Pitfall 2)

### Phase 2: Data Model and Offline Layer
**Rationale:** The three-layer data architecture must exist before building features on top. IndexedDB schema, sync engine, and Convex schema are foundational.
**Delivers:** Convex schema (masterChores, dailyLists, dailyChores, accessKeys), IndexedDB schema with versioning, sync engine with mutation queue, reactive Svelte stores.
**Uses:** Convex, idb
**Implements:** Offline-First Data Layer, Reactive Data Layer
**Avoids:** Conflict resolution afterthought (Pitfall 5), IndexedDB migration issues (Pitfall 7)

### Phase 3: Auth and Access
**Rationale:** Master list editing requires admin auth; worker access requires key validation. Auth must exist before chore management features.
**Delivers:** Admin login (email/password via Convex), URL key generation and validation, protected routes, display name per key.
**Avoids:** localStorage key loss (Pitfall 10) — use dual storage

### Phase 4: Core Chore Workflow
**Rationale:** Now that data layer and auth exist, build the primary user workflow.
**Delivers:** Master list CRUD (admin), daily list generation (clone master on first access), chore completion toggle with optimistic updates and real-time sync, time-of-day and category organization.
**Addresses:** Table stakes features (task completion, list view, real-time sync)
**Avoids:** Optimistic without rollback (Pitfall 3), REST mental model (Pitfall 1)

### Phase 5: Photo Verification
**Rationale:** Photo capture depends on chore completion workflow existing. Requires careful offline handling.
**Delivers:** Camera capture (native file input with capture attribute), photo compression before storage, IndexedDB queue for offline photos, Convex file storage upload, photo viewing in UI.
**Uses:** browser-image-compression, Convex file storage
**Avoids:** Photo upload without offline queue (Pitfall 4), size limit issues (Pitfall 12)

### Phase 6: Polish and History
**Rationale:** Core workflow complete; add visibility and feedback features.
**Delivers:** Sync status indicators, 7-day history view, progress indicators, user identification on completed tasks, admin activity visibility.
**Addresses:** Differentiator features

### Phase Ordering Rationale

- **Foundation before features**: Service worker and Convex integration errors are silent in dev but break production. Must be validated early.
- **Data layer before UI**: The offline-first architecture is foundational; adding offline support to an online-first app is a rewrite.
- **Auth before chores**: Master list editing requires admin; worker access requires keys. Dependency is hard.
- **Completion before photos**: Photos attach to chore completions. Dependency is logical.
- **Polish last**: Status indicators and history views enhance existing functionality; don't block core value.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 1 (Foundation):** Verify `convex-svelte` exact API and SvelteKit 2.22 compatibility. vite-plugin-pwa + Vite 7 compatibility should be confirmed.
- **Phase 5 (Photos):** Test camera API on actual iOS and Android devices. Browser inconsistencies are common (Pitfall 9).

**Phases with standard patterns (skip research-phase):**
- **Phase 2 (Data Model):** IndexedDB with idb is well-documented. Convex schema patterns are standard.
- **Phase 3 (Auth):** Basic auth patterns, nothing exotic.
- **Phase 4 (Core Workflow):** CRUD operations, standard UI patterns.
- **Phase 6 (Polish):** Standard UI features.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Convex + SvelteKit integration based on training data; verify convex-svelte package exists and API |
| Features | HIGH | Task management domain is well-understood; farm context is clear |
| Architecture | MEDIUM | Three-layer offline-first pattern is sound; Convex-specific integration needs verification |
| Pitfalls | HIGH | PWA and offline-first pitfalls are well-documented; Convex SSR pitfall is common pattern |

**Overall confidence:** MEDIUM

### Gaps to Address

- **convex-svelte package verification:** Confirm package exists on npm with current version. If not, may need to wrap Convex client manually with Svelte stores.
- **vite-plugin-pwa + Vite 7:** Verify compatibility. Vite 7 is relatively new; plugin may need updates.
- **iOS Safari PWA quirks:** Known to have unique behaviors around service workers and camera access. Must test on real devices during photo phase.
- **Convex file storage limits:** Check current pricing/quota during photo implementation. May affect compression strategy.
- **Timezone handling:** Single-farm deployment means single timezone, but should explicitly set farm timezone in config rather than relying on server time.

## Sources

### Primary (HIGH confidence)
- MDN MediaDevices API — camera access patterns
- MDN IndexedDB — offline storage patterns
- idb library (github.com/jakearchibald/idb) — IndexedDB wrapper

### Secondary (MEDIUM confidence)
- Convex documentation (docs.convex.dev) — real-time patterns, file storage
- vite-plugin-pwa documentation (vite-pwa-org.netlify.app) — PWA setup

### Tertiary (needs validation)
- convex-svelte package — verify existence and API before implementation
- @vite-pwa/sveltekit + Vite 7 — verify compatibility

---
*Research completed: 2026-02-01*
*Ready for roadmap: yes*
