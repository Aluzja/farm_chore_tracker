# Requirements: Kitchen Sink Farm

## v1 Requirements

### PWA Infrastructure

| ID | Requirement | Priority |
|----|-------------|----------|
| PWA-01 | PWA manifest and service worker for installability | Must have |
| PWA-02 | Offline-first architecture with queued sync | Must have |

### Data Layer

| ID | Requirement | Priority |
|----|-------------|----------|
| DATA-01 | Convex database integration for real-time sync | Must have |

### Authentication

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-01 | Admin authentication (email/password) | Must have |
| AUTH-02 | User access via URL keys (stored in localStorage) | Must have |
| AUTH-03 | Admin key management (create/revoke) | Must have |

### Chore Management

| ID | Requirement | Priority |
|----|-------------|----------|
| CHORE-01 | Master chore list management (admin) | Must have |
| CHORE-02 | Daily list clone on first access | Must have |
| CHORE-03 | Time-of-day organization (morning/afternoon/evening) | Must have |
| CHORE-04 | Animal category organization within time slots | Must have |
| CHORE-05 | Chore completion with optional photo attachment | Must have |
| CHORE-06 | Per-chore photo requirement configuration | Must have |
| CHORE-07 | Real-time progress visibility across users | Must have |
| CHORE-08 | Reversible completion states | Must have |
| CHORE-09 | Ad-hoc chore addition (today only) | Must have |

### History

| ID | Requirement | Priority |
|----|-------------|----------|
| HIST-01 | 7-day history of completed chores and photos | Must have |

### User Experience

| ID | Requirement | Priority |
|----|-------------|----------|
| UX-01 | Minimal, efficient UX optimized for quick interactions | Must have |

## v2+ Backlog

From research - deferred features:
- Batch operations (complete multiple chores at once)
- Notes/comments on completions
- Activity log for admin
- Export functionality

## Out of Scope

From PROJECT.md - explicitly excluded:
- Push notifications (users check app when needed)
- Time-gated chores (time slots are organizational only)
- Chore assignment to specific users (first-come-first-served model)
- Complex user profiles (key-based access is anonymous)
- Multi-farm support (single farm deployment)
- Recurring chore scheduling (daily clone from master is sufficient)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PWA-01 | Phase 1 | Pending |
| PWA-02 | Phase 2 | Pending |
| DATA-01 | Phase 1 | Pending |
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| CHORE-01 | Phase 4 | Pending |
| CHORE-02 | Phase 4 | Pending |
| CHORE-03 | Phase 4 | Pending |
| CHORE-04 | Phase 4 | Pending |
| CHORE-05 | Phase 4 + 5 | Pending |
| CHORE-06 | Phase 5 | Pending |
| CHORE-07 | Phase 4 | Pending |
| CHORE-08 | Phase 4 | Pending |
| CHORE-09 | Phase 4 | Pending |
| HIST-01 | Phase 6 | Pending |
| UX-01 | Phase 6 | Pending |

**Coverage: 17/17 v1 requirements mapped**

---
*Created: 2026-02-01*
