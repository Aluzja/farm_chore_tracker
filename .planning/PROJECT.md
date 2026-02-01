# Kitchen Sink Farm

## What This Is

A Progressive Web App for tracking daily farm chores across multiple users. Chores are organized by time of day (morning, afternoon, evening) and animal category (sheep, ducks, chickens, cats). The app provides real-time sync so multiple people can work simultaneously without duplicating effort, with full offline support for use in areas with spotty connectivity.

## Core Value

Multiple people can efficiently coordinate completing daily farm chores without stepping on each other's toes, with photo verification where needed.

## Requirements

### Validated

- ✓ SvelteKit 2.22 framework with file-based routing — existing
- ✓ Svelte 5 component architecture with runes — existing
- ✓ TypeScript strict mode configuration — existing
- ✓ ESLint + Prettier code quality tooling — existing
- ✓ Vite build system with hot reload — existing

### Active

- [ ] PWA manifest and service worker for installability
- [ ] Offline-first architecture with queued sync
- [ ] Convex database integration for real-time sync
- [ ] Master chore list management (admin)
- [ ] Daily list clone on first access
- [ ] Time-of-day organization (morning/afternoon/evening)
- [ ] Animal category organization within time slots
- [ ] Chore completion with optional photo attachment
- [ ] Per-chore photo requirement configuration
- [ ] Real-time progress visibility across users
- [ ] Reversible completion states
- [ ] Admin authentication (email/password)
- [ ] User access via URL keys (stored in localStorage)
- [ ] Admin key management (create/revoke)
- [ ] Ad-hoc chore addition (today only)
- [ ] 7-day history of completed chores and photos
- [ ] Minimal, efficient UX optimized for quick interactions

### Out of Scope

- Push notifications — users check app when needed
- Time-gated chores — time slots are organizational only
- Chore assignment to specific users — first-come-first-served model
- Complex user profiles — key-based access is anonymous
- Multi-farm support — single farm deployment
- Recurring chore scheduling — daily clone from master is sufficient

## Context

**Target users:** Farm workers who need to coordinate daily animal care tasks. Multiple people may be working the same shift. Connectivity may be unreliable in outdoor/rural areas.

**Technical environment:** Existing SvelteKit 2.22 + Svelte 5 starter project with TypeScript. Will add Convex for backend/real-time sync.

**UX priorities:** Speed and efficiency over visual polish. Users are often in the field, possibly with dirty hands or in a hurry. Minimal taps to complete a chore.

**Photo workflow:** Camera capture for verification. Some chores (like medication administration) require photo proof; others don't. Configurable per chore in master list.

## Constraints

- **Tech stack**: SvelteKit + Svelte 5 (existing), Convex (database/sync) — real-time sync is core requirement
- **PWA**: Must be installable and work fully offline with queued sync
- **Auth model**: Admin password-protected; regular users via shareable URL keys
- **Storage**: Photos stored via Convex file storage
- **History**: 7-day retention for completed chores (can be adjusted)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Convex for backend | Real-time sync across users without building custom WebSocket infrastructure | — Pending |
| URL key auth for users | Zero-friction access for farm workers; no passwords to remember | — Pending |
| Daily clone from master | Simple mental model; each day starts fresh from the template | — Pending |
| Photo optional per chore | Some chores need verification, others don't | — Pending |
| First-come-first-served | Simpler than assignment; real-time sync prevents duplicates | — Pending |

---
*Last updated: 2026-02-01 after initialization*
