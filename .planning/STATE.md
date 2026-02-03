# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Multiple people can efficiently coordinate completing daily farm chores without stepping on each other's toes, with photo verification where needed.
**Current focus:** Phase 6 - Polish and History (in progress)

## Current Position

Phase: 6 of 6 (Polish and History)
Plan: 3 of 3 in current phase
Status: Phase complete
Last activity: 2026-02-03 - Completed 06-03-PLAN.md (Mobile UX Polish)

Progress: [████████████████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 19
- Average duration: 5.37 min
- Total execution time: 1.7 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 15 min | 5 min |
| 02-data-layer | 2 | 7 min | 3.5 min |
| 03-auth-and-access | 3 | 21 min | 7 min |
| 04-core-chore-workflow | 4 | 13 min | 3.25 min |
| 05-photo-verification | 4 | 32 min | 8 min |
| 06-polish-and-history | 3 | 23 min | 7.67 min |

**Recent Trend:**
- Last 5 plans: 05-03 (2 min), 05-04 (25 min), 06-01 (4 min), 06-02 (5 min), 06-03 (14 min)
- Trend: stable execution time with iterative refinement

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 06-03: Slide transitions (150ms) on chore items, fade transitions (200ms) on completion info
- 06-03: 48px minimum touch targets for all primary actions per mobile accessibility
- 06-03: No strikethrough on completed chores - reduces visual clutter
- 06-03: Photo thumbnail positioned to left of checkbox for better visual flow
- 06-01: Synced status is hidden (opacity 0) for clean UI - no visual noise
- 06-01: 44px minimum touch target on sync badge for accessibility
- 06-01: Combined retry button handles both mutation queue and photo queue failures
- 06-01: markFailed propagates to store for immediate UI update
- 06-02: getHistory uses by_date index with gte for efficient date range queries
- 06-02: Client-side date sorting since Convex filter limits index usage
- 06-02: Sticky date headers at top:3.5rem to clear main header
- 05-04: Photo capture page auto-triggers camera on mount via $effect for seamless UX
- 05-04: PhotoThumbnail component encapsulates Convex query for reactive photo URL fetching
- 05-04: Navigate to photo-capture (not toggle) for requiresPhoto chores to enforce capture
- 05-04: Pinch-to-zoom via CSS touch-action on photo view (not JavaScript)
- 05-03: Photo queue processed after mutation queue in sync cycle
- 05-03: Sequential photo uploads (not parallel) for mobile bandwidth efficiency
- 05-03: 3 retries before marking photo as failed (same as mutations)
- 05-02: requiresPhoto optional on master, required on daily (explicit state on clone)
- 05-02: Photo metadata (capturedAt, capturedBy) captured at attachment time
- 05-01: Camera access via file input with capture=environment (simpler than getUserMedia)
- 05-01: Strip EXIF metadata on compression for privacy (preserveExif: false)
- 05-01: Store Blob directly in IndexedDB (not base64) for efficiency
- 04-04: User context via module exports: setCurrentUser/getCurrentUser for cross-component sharing
- 04-04: Layout effect syncs userName to user context when access validated
- 04-04: Ad-hoc form defaults time slot to current time of day
- 04-03: Grouped derived state: Time slots ordered, categories alphabetical within
- 04-03: Clone trigger in layout via effect watching query result
- 04-03: Replace Tailwind with scoped CSS in app layout/page
- 04-02: Store pattern: hydrateFromServer method receives Convex query data
- 04-02: Client-side grouping via $derived.by for offline display capability
- 04-02: Category: Free text with datalist suggestions, not constrained enum
- 04-01: Two-table pattern: masterChores (templates) vs dailyChores (instances)
- 04-01: On-demand clone on first access each day, not scheduled cron
- 04-01: Master chore CRUD requires admin authentication
- 04-01: Daily chore toggle uses clientId for offline-first compatibility
- 03-03: convex-svelte has no useMutation - use useConvexClient().mutation() directly
- 03-03: Use startsWith for pathname checks to avoid TypeScript route inference issues
- 03-03: Admin layout allows login page without auth, protects all other admin routes
- 03-02: Access key validate query is public (no auth) - workers use key AS authentication
- 03-02: signIn/signOut use client.action() since Convex Auth exposes them as actions
- 03-02: 24-hour localStorage cache for offline access key validation
- 03-01: Password provider only (no OAuth) - simple admin-only auth for farm app
- 03-01: First user becomes admin pattern via isAdmin boolean on users table
- 03-01: accessKeys table for URL-based worker access (shareable keys instead of accounts)
- 02-02: Global Convex client via setConvexClient/getConvexClient for non-component sync engine access
- 02-02: Idempotent mutations via clientId index for creates, last-write-wins for updates
- 02-01: Zod 4 API: z.uuid(), z.iso.datetime(), z.record(key, value) instead of deprecated v3 syntax
- 02-01: Sync metadata on chores: syncStatus enum and lastModified timestamp
- Phase 2: Add Zod for runtime type safety and client-side validation
- 01-02: Browser-only Convex initialization via $app/environment browser guard
- 01-02: Functions directory in src/convex/ for SvelteKit compatibility
- 01-03: NetworkOnly handler for Convex domains to prevent caching real-time traffic
- 01-03: registerType: prompt for user-controlled PWA updates

### Pending Todos

- (Completed) Phase 2: Include Zod installation and integration in Data Layer planning

### Blockers/Concerns

From research (to address during implementation):
- Phase 1: Verify convex-svelte package exists and API compatibility with SvelteKit 2.22 (01-02: VERIFIED - convex-svelte@0.0.12 works with SvelteKit)
- Phase 1: Verify vite-plugin-pwa + Vite 7 compatibility (01-01: @vite-pwa/sveltekit@1.1.0 installed OK)
- Phase 1: esbuild service EPIPE errors during build - investigate in Plan 02 (02-01: Still occurring intermittently - environmental issue, not code-related)
- Phase 5: Test camera API on actual iOS and Android devices

## Session Continuity

Last session: 2026-02-03
Stopped at: Completed 06-03-PLAN.md (Mobile UX Polish) - Phase 6 complete
Resume file: None (all phases complete)

## Phase 4 Plans Summary

| Wave | Plan | Description | Autonomous | Status |
|------|------|-------------|------------|--------|
| 1 | 04-01 | Data Layer Foundation | Autonomous | Complete |
| 2 | 04-02 | Admin Master Chores UI | Autonomous | Complete |
| 3 | 04-03 | Daily Chore List (Worker UI) | Autonomous | Complete |
| 3 | 04-04 | Ad-hoc Chores and User Identity | Autonomous | Complete |

Key technical decisions:
- Two-table pattern: masterChores (admin-managed templates) vs dailyChores (daily instances)
- On-demand daily cloning via getOrCreateDailyList + cloneMasterToDaily
- clientId for offline-first idempotency on dailyChores
- IndexedDB version 2 migration for dailyChores store
- MasterChoreStore with $state and $derived.by grouping
- DailyChoreStore with time slot and category grouping
- Sync engine multi-table support for chores and dailyChores
- User context module for cross-component user identity sharing
- Ad-hoc chore creation with optimistic UI

## Phase 3 Plans Summary

| Wave | Plan | Description | Autonomous | Status |
|------|------|-------------|------------|--------|
| 1 | 03-01 | Convex Auth Setup | Checkpoint | Complete |
| 2 | 03-02 | Auth APIs and Client Utilities | Autonomous | Complete |
| 3 | 03-03 | Admin UI | Autonomous | Complete |

Key technical decisions:
- @convex-dev/auth with @auth/core@0.37.0 for Convex authentication
- Password provider only (no OAuth) for simple admin auth
- authTables spread for session management tables
- accessKeys table with by_key index for URL-based worker access
- HTTP router pattern: httpRouter() with auth.addHttpRoutes()
- Access key validate query is public for worker authentication
- AdminAuth class uses Svelte 5 $state runes for reactive state
- convex-svelte mutation pattern: useConvexClient().mutation() (no useMutation export)

## Phase 6 Plans Summary

| Wave | Plan | Description | Autonomous | Status |
|------|------|-------------|------------|--------|
| 1 | 06-01 | Sync Status Indicators | Autonomous | Complete |
| 1 | 06-02 | History view | Autonomous | Complete |
| 2 | 06-03 | Mobile UX Polish | Checkpoint | Complete |

Key technical decisions:
- SyncStatusBadge component with CSS-only pulse animation
- Synced status hidden (opacity 0) for clean UI
- 44px minimum touch target for accessibility
- markFailed/resetFailedToPending methods on dailyChoreStore
- getHistory query with by_date index and gte filter
- Date grouping with $derived.by for reactive computed state
- Sticky headers pattern for scroll context
- Mobile-first layout with max-width container for desktop
- Svelte transitions: slide (150ms) for list items, fade (200ms) for status changes
- 48px minimum touch targets for all primary actions (toggle buttons)
- 56px minimum height for chore items and history cards
- Safe area insets for notched phones: calc(4rem + env(safe-area-inset-bottom))
- Iterative UX refinement via checkpoint feedback loop

## Phase 5 Plans Summary

| Wave | Plan | Description | Autonomous | Status |
|------|------|-------------|------------|--------|
| 1 | 05-01 | Photo Capture Infrastructure | Autonomous | Complete |
| 1 | 05-02 | Photo Storage API | Autonomous | Complete |
| 2 | 05-03 | Photo Upload Queue | Autonomous | Complete |
| 2 | 05-04 | Worker UI Integration | Checkpoint | Complete |

Key technical decisions:
- browser-image-compression for ~1MB JPEG output with EXIF stripping
- HTML5 file input with capture=environment for camera access
- IndexedDB version 3 with photoQueue store
- PhotoQueueEntry Zod schema with uploadStatus enum for retry management
- Convex file storage via _storage table references
- Photos API with generateUploadUrl, attachPhotoToChore, getPhotoUrl, getPhotoUrlByChore
- Photo queue CRUD: enqueuePhoto, getPhotoQueue, removePhoto, incrementPhotoRetry, markPhotoFailed
- Sync engine photo queue processing with pendingPhotoCount, failedPhotoCount, currentPhotoUpload state
- Photo capture page with full-screen modal layout and auto-trigger camera
- PhotoThumbnail component pattern for Convex reactive queries
- Photo view with CSS pinch-to-zoom support
- Photo requirement enforcement via navigation instead of toggle
