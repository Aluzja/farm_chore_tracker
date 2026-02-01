# Roadmap: Kitchen Sink Farm

## Overview

This roadmap transforms an existing SvelteKit 2.22 + Svelte 5 starter into a production PWA for multi-user farm chore tracking. The journey builds from foundation (PWA shell + Convex integration) through the three-layer offline-first data architecture, authentication, core chore workflow, photo verification, and finally polish. Each phase delivers a coherent, verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - PWA shell, Convex integration, service worker with correct exclusions
- [ ] **Phase 2: Data Layer** - Three-layer offline-first architecture with IndexedDB and sync engine
- [ ] **Phase 3: Auth and Access** - Admin authentication and URL key-based user access
- [ ] **Phase 4: Core Chore Workflow** - Master list, daily clone, completion, real-time sync
- [ ] **Phase 5: Photo Verification** - Camera capture, offline queue, Convex file storage
- [ ] **Phase 6: Polish and History** - Sync indicators, 7-day history, UX refinement

## Phase Details

### Phase 1: Foundation
**Goal**: Working SvelteKit + Convex connection with PWA installability and service worker that correctly excludes real-time traffic
**Depends on**: Nothing (first phase)
**Requirements**: PWA-01, DATA-01
**Success Criteria** (what must be TRUE):
  1. App installs as PWA on mobile (iOS Safari, Android Chrome)
  2. Convex client connects and receives real-time subscription updates
  3. Service worker caches app shell for offline access
  4. Convex WebSocket traffic is NOT cached by service worker (real-time sync works after SW install)
**Plans**: 3 plans (2 waves)

Plans:
- [ ] 01-01-PLAN.md — Install @vite-pwa/sveltekit, create PWA icons, add meta tags to app.html
- [ ] 01-02-PLAN.md — Install Convex, create deployment, set up schema and client initialization
- [ ] 01-03-PLAN.md — Configure SvelteKitPWA with Convex exclusions, register SW, create test page

### Phase 2: Data Layer
**Goal**: Three-layer offline-first data architecture that persists locally and syncs when online
**Depends on**: Phase 1
**Requirements**: PWA-02
**Success Criteria** (what must be TRUE):
  1. Data persists in IndexedDB across browser restarts
  2. Mutations made offline are queued and sync when connectivity returns
  3. Real-time updates from other users appear within seconds when online
  4. Sync failures are captured and retryable
**Plans**: TBD

Plans:
- [ ] 02-01: IndexedDB schema and idb wrapper
- [ ] 02-02: Sync engine with mutation queue
- [ ] 02-03: Reactive Svelte stores wrapping offline-first layer

### Phase 3: Auth and Access
**Goal**: Admin can log in to manage master list; workers access via shareable URL keys
**Depends on**: Phase 2
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. Admin can log in with email/password
  2. Admin can generate new access keys with display names
  3. Admin can revoke existing access keys
  4. User with valid URL key gains access without login
  5. Invalid or revoked keys are rejected with clear feedback
**Plans**: TBD

Plans:
- [ ] 03-01: Admin authentication (Convex auth)
- [ ] 03-02: URL key generation and validation
- [ ] 03-03: Protected routes and access control

### Phase 4: Core Chore Workflow
**Goal**: Users can view organized chore lists, complete chores with real-time sync, and admin can manage the master list
**Depends on**: Phase 3
**Requirements**: CHORE-01, CHORE-02, CHORE-03, CHORE-04, CHORE-05, CHORE-07, CHORE-08, CHORE-09
**Success Criteria** (what must be TRUE):
  1. Admin can create, edit, and delete chores in the master list
  2. Daily list is automatically cloned from master on first access each day
  3. Chores display organized by time-of-day (morning/afternoon/evening)
  4. Within each time slot, chores are grouped by animal category
  5. User can mark chore complete with one tap; completion syncs to all users in real-time
  6. User can undo a completion (reversible state)
  7. User can add ad-hoc chore for today only
  8. Completion shows who completed and when
**Plans**: TBD

Plans:
- [ ] 04-01: Master list CRUD (admin)
- [ ] 04-02: Daily list generation and display
- [ ] 04-03: Chore completion with optimistic updates and real-time sync
- [ ] 04-04: Ad-hoc chore addition

### Phase 5: Photo Verification
**Goal**: Users can attach photos to chore completions; photos persist offline and upload when connected
**Depends on**: Phase 4
**Requirements**: CHORE-05 (photo part), CHORE-06
**Success Criteria** (what must be TRUE):
  1. User can capture photo from device camera during chore completion
  2. Photos are compressed before storage (bandwidth-friendly for rural use)
  3. Photos persist in IndexedDB when offline and upload when connected
  4. Admin can configure which chores require photo proof
  5. Required-photo chores cannot be completed without photo
  6. Completed chore photos are viewable in the UI
**Plans**: TBD

Plans:
- [ ] 05-01: Camera capture and image compression
- [ ] 05-02: Photo offline queue and Convex file upload
- [ ] 05-03: Per-chore photo requirement configuration

### Phase 6: Polish and History
**Goal**: Users have visibility into sync status and can review past 7 days of completions
**Depends on**: Phase 5
**Requirements**: HIST-01, UX-01
**Success Criteria** (what must be TRUE):
  1. Sync status indicators show pending/synced/failed for each item
  2. User can view 7-day history of completed chores
  3. History shows completion photos, timestamps, and who completed
  4. UI is optimized for field use: large touch targets, minimal taps
  5. App performs well on mid-range mobile devices
**Plans**: TBD

Plans:
- [ ] 06-01: Sync status indicators
- [ ] 06-02: 7-day history view
- [ ] 06-03: UX polish and performance optimization

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Data Layer | 0/3 | Not started | - |
| 3. Auth and Access | 0/3 | Not started | - |
| 4. Core Chore Workflow | 0/4 | Not started | - |
| 5. Photo Verification | 0/3 | Not started | - |
| 6. Polish and History | 0/3 | Not started | - |

## Requirement Coverage

All 17 v1 requirements mapped to phases:

| Requirement | Description | Phase |
|-------------|-------------|-------|
| PWA-01 | PWA manifest and service worker for installability | Phase 1 |
| PWA-02 | Offline-first architecture with queued sync | Phase 2 |
| DATA-01 | Convex database integration for real-time sync | Phase 1 |
| CHORE-01 | Master chore list management (admin) | Phase 4 |
| CHORE-02 | Daily list clone on first access | Phase 4 |
| CHORE-03 | Time-of-day organization | Phase 4 |
| CHORE-04 | Animal category organization within time slots | Phase 4 |
| CHORE-05 | Chore completion with optional photo attachment | Phase 4 + 5 |
| CHORE-06 | Per-chore photo requirement configuration | Phase 5 |
| CHORE-07 | Real-time progress visibility across users | Phase 4 |
| CHORE-08 | Reversible completion states | Phase 4 |
| CHORE-09 | Ad-hoc chore addition (today only) | Phase 4 |
| AUTH-01 | Admin authentication (email/password) | Phase 3 |
| AUTH-02 | User access via URL keys | Phase 3 |
| AUTH-03 | Admin key management (create/revoke) | Phase 3 |
| HIST-01 | 7-day history of completed chores and photos | Phase 6 |
| UX-01 | Minimal, efficient UX optimized for quick interactions | Phase 6 |

**Coverage: 17/17 requirements mapped**

---
*Created: 2026-02-01*
*Depth: standard (6 phases)*
