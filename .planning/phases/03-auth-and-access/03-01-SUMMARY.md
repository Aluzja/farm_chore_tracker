---
phase: 03-auth-and-access
plan: 01
subsystem: auth
tags: [convex-auth, password-auth, jwt, access-keys]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: Convex schema with chores table
provides:
  - Convex Auth infrastructure with Password provider
  - authTables for session management
  - accessKeys table for URL-based worker access
  - users table with isAdmin field
affects: [03-02, 03-03, 04-ui]

# Tech tracking
tech-stack:
  added: ["@convex-dev/auth", "@auth/core@0.37.0"]
  patterns: ["Password authentication", "HTTP router for auth endpoints"]

key-files:
  created:
    - src/convex/auth.config.ts
    - src/convex/auth.ts
    - src/convex/http.ts
  modified:
    - src/convex/schema.ts
    - package.json

key-decisions:
  - "Password provider only (no OAuth) - simple admin-only auth"
  - "First user becomes admin pattern via isAdmin boolean"
  - "accessKeys table for URL-based worker access"

patterns-established:
  - "Convex Auth: auth.config.ts + auth.ts + http.ts pattern"
  - "HTTP router: httpRouter() with auth.addHttpRoutes()"

# Metrics
duration: 8min
completed: 2026-02-02
---

# Phase 3 Plan 1: Convex Auth Setup Summary

**Convex Auth with Password provider, authTables for session management, and accessKeys table for URL-based worker access**

## Performance

- **Duration:** 8 min (includes checkpoint wait for JWT key configuration)
- **Started:** 2026-02-02T10:00:00Z
- **Completed:** 2026-02-02T10:31:00Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments
- Installed @convex-dev/auth and @auth/core@0.37.0 for Convex authentication
- Created auth configuration files (auth.config.ts, auth.ts, http.ts)
- Extended schema with authTables, users.isAdmin, and accessKeys table
- Configured JWT environment variables in Convex dashboard

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Convex Auth dependencies** - `539add9` (chore)
2. **Task 2: Create Convex Auth configuration files** - `bdd21d2` (feat)
3. **Task 3: Extend schema with authTables and accessKeys** - `b34dee5` (feat)
4. **Task 4: Set up JWT environment variables** - checkpoint:human-action (user configured)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/convex/auth.config.ts` - Provider configuration for Convex Auth
- `src/convex/auth.ts` - Convex Auth setup with Password provider, exports auth helpers
- `src/convex/http.ts` - HTTP router with auth endpoints
- `src/convex/schema.ts` - Extended with authTables, users.isAdmin, accessKeys table
- `package.json` - Added @convex-dev/auth and @auth/core@0.37.0

## Decisions Made
- **Password provider only:** Simple admin-only authentication, no OAuth complexity needed for farm app
- **First user becomes admin:** isAdmin boolean on users table enables first-signup-is-admin pattern
- **accessKeys for workers:** URL-based access via shareable keys instead of individual accounts

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

During execution, JWT key configuration was required:

1. Task 4: Convex Auth required JWT environment variables
   - Paused for user to configure JWT_PRIVATE_KEY, JWKS, and SITE_URL in Convex dashboard
   - User configured keys via Convex dashboard
   - Resumed and verified deployment successful

## Issues Encountered
- esbuild EPIPE error during `bun run build` - known environmental issue documented in STATE.md, not related to auth changes
- Convex functions deployed successfully via `bunx convex dev --once`

## User Setup Required

**External services require manual configuration.** JWT keys were configured during this plan execution:
- JWT_PRIVATE_KEY: RSA private key for token signing
- JWKS: JSON Web Key Set for token verification
- SITE_URL: Application URL for auth redirects

## Next Phase Readiness
- Auth infrastructure ready for admin login UI (03-02)
- accessKeys table ready for key management mutations (03-03)
- HTTP router registered and serving auth endpoints

---
*Phase: 03-auth-and-access*
*Completed: 2026-02-02*
