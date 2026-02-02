# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Multiple people can efficiently coordinate completing daily farm chores without stepping on each other's toes, with photo verification where needed.
**Current focus:** Phase 4 - Core Chore Workflow (in progress)

## Current Position

Phase: 4 of 6 (Core Chore Workflow)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-02 - Completed 04-02-PLAN.md (Admin Master Chores UI)

Progress: [███████████░] 67%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 5.0 min
- Total execution time: 0.83 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 15 min | 5 min |
| 02-data-layer | 2 | 7 min | 3.5 min |
| 03-auth-and-access | 3 | 21 min | 7 min |
| 04-core-chore-workflow | 2 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 03-01 (8 min), 03-02 (8 min), 03-03 (5 min), 04-01 (3 min), 04-02 (4 min)
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

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

Last session: 2026-02-02
Stopped at: Completed 04-02-PLAN.md (Admin Master Chores UI)
Resume file: .planning/phases/04-core-chore-workflow/04-03-PLAN.md (next plan)

## Phase 4 Plans Summary

| Wave | Plan | Description | Autonomous | Status |
|------|------|-------------|------------|--------|
| 1 | 04-01 | Data Layer Foundation | Autonomous | Complete |
| 2 | 04-02 | Admin Master Chores UI | Autonomous | Complete |
| 3 | 04-03 | Daily Chore List (Worker UI) | TBD | Pending |

Key technical decisions:
- Two-table pattern: masterChores (admin-managed templates) vs dailyChores (daily instances)
- On-demand daily cloning via getOrCreateDailyList + cloneMasterToDaily
- clientId for offline-first idempotency on dailyChores
- IndexedDB version 2 migration for dailyChores store
- MasterChoreStore with $state and $derived.by grouping

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
