---
phase: 03-auth-and-access
plan: 02
subsystem: auth
tags: [convex, svelte5, runes, localStorage, access-keys, admin]

# Dependency graph
requires:
  - phase: 03-01
    provides: Convex Auth setup with Password provider, schema with users.isAdmin and accessKeys table
provides:
  - Convex user queries (currentUser, isCurrentUserAdmin, checkFirstUserAdmin)
  - Convex access key mutations (create, revoke, list, validate, recordUsage)
  - Client-side access key validation with localStorage caching
  - Admin auth state management with Svelte 5 runes
affects: [03-03, worker-ui, admin-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Access key validation without auth (public query)"
    - "First-user-admin pattern via checkFirstUserAdmin mutation"
    - "Svelte 5 $state class pattern for reactive auth state"
    - "localStorage caching with 24-hour expiry for offline validation"

key-files:
  created:
    - src/convex/users.ts
    - src/convex/accessKeys.ts
    - src/lib/auth/access-key.ts
    - src/lib/auth/admin.svelte.ts
  modified: []

key-decisions:
  - "Access key validate query is public (no auth) - workers use access key AS authentication"
  - "signIn/signOut use client.action() since they are Convex actions, not mutations"
  - "24-hour validation cache allows offline workers to access chores"

patterns-established:
  - "AdminAuth class with $state runes for reactive auth singleton"
  - "Access key list sanitizes key values - only returned in create response"

# Metrics
duration: 8min
completed: 2026-02-02
---

# Phase 3 Plan 2: Auth APIs and Client Utilities Summary

**Convex user/access key APIs with client-side auth state using Svelte 5 runes and localStorage validation caching**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-02T18:35:18Z
- **Completed:** 2026-02-02T18:43:30Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments
- User queries with admin detection and first-user-admin assignment
- Access key CRUD mutations with admin-only create/revoke and public validate
- Client-side auth utilities with offline-capable validation caching
- Reactive admin auth state using Svelte 5 $state runes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Convex user queries with admin detection** - `ff906d5` (feat)
2. **Task 2: Create access key Convex mutations** - `3539ac8` (feat)
3. **Task 3: Create client-side auth utilities** - `644b52b` (feat)

## Files Created/Modified
- `src/convex/users.ts` - User queries: currentUser, isCurrentUserAdmin, makeAdmin, checkFirstUserAdmin
- `src/convex/accessKeys.ts` - Access key CRUD: validate, recordUsage, create, revoke, list
- `src/lib/auth/access-key.ts` - Client-side validation with localStorage caching (24-hour TTL)
- `src/lib/auth/admin.svelte.ts` - Admin auth state class with Svelte 5 $state runes

## Decisions Made
- Access key `validate` query is intentionally public (no auth required) - workers authenticate via the access key itself
- Used `client.action()` for signIn/signOut calls since Convex Auth exposes these as actions, not mutations
- 24-hour localStorage cache duration balances offline usability with revocation responsiveness
- Access key list query returns sanitized data (no actual key values) - keys only returned once during creation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed signIn/signOut API calls from mutation to action**
- **Found during:** Task 3 (Create client-side auth utilities)
- **Issue:** Plan specified `client.mutation(api.auth.signIn, ...)` but Convex Auth exposes signIn/signOut as actions
- **Fix:** Changed to `client.action(api.auth.signIn, ...)` and `client.action(api.auth.signOut, {})`
- **Files modified:** src/lib/auth/admin.svelte.ts
- **Verification:** Build passes, TypeScript compilation successful
- **Committed in:** 644b52b (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correct API usage. No scope creep.

## Issues Encountered
- esbuild EPIPE errors during build verification (known environmental issue, resolved by killing stale processes)

## User Setup Required

None - no external service configuration required. JWT keys were configured in Phase 3 Plan 1.

## Next Phase Readiness
- Auth APIs complete and deployed to Convex
- Client utilities ready for UI integration in Plan 03
- Access key validation supports offline-first worker access pattern

---
*Phase: 03-auth-and-access*
*Completed: 2026-02-02*
