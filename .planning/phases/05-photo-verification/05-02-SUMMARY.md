---
phase: "05"
plan: "02"
subsystem: "data-layer"
tags: ["convex", "file-storage", "schema", "photos"]
dependency-graph:
  requires:
    - "04-01" # Chore data layer (masterChores, dailyChores)
  provides:
    - "Photo storage schema fields"
    - "Photo upload URL generation"
    - "Photo attachment API"
  affects:
    - "05-03" # Camera capture UI
    - "05-04" # Photo display UI
tech-stack:
  added: []
  patterns:
    - "Convex file storage API"
    - "Storage ID reference pattern (_storage table)"
key-files:
  created:
    - "src/convex/photos.ts"
  modified:
    - "src/convex/schema.ts"
    - "src/convex/dailyChores.ts"
    - "src/convex/masterChores.ts"
decisions:
  - id: "05-02-01"
    summary: "requiresPhoto optional on master, required on daily"
    rationale: "Master chores may pre-date photo feature; daily must have explicit value"
  - id: "05-02-02"
    summary: "Photo metadata captured at attachment time"
    rationale: "capturedAt and capturedBy track when/who for audit purposes"
metrics:
  duration: "3 min"
  completed: "2026-02-02"
---

# Phase 05 Plan 02: Photo Storage API Summary

**One-liner:** Convex schema extended with photo fields and file storage API for upload/retrieval via `_storage` table references.

## What Was Built

### Schema Extensions

**masterChores table:**
- `requiresPhoto: v.optional(v.boolean())` - Admin configures if photo proof needed

**dailyChores table:**
- `requiresPhoto: v.boolean()` - Copied from master on clone (required, defaults false)
- `photoStorageId: v.optional(v.id("_storage"))` - Reference to Convex file storage
- `photoCapturedAt: v.optional(v.number())` - Timestamp when photo was taken
- `photoCapturedBy: v.optional(v.string())` - User who captured the photo

### Photos API (`src/convex/photos.ts`)

| Function | Type | Purpose |
|----------|------|---------|
| `generateUploadUrl` | mutation | Returns short-lived URL for client upload |
| `attachPhotoToChore` | mutation | Links uploaded photo to daily chore via clientId |
| `getPhotoUrl` | query | Gets serving URL from storage ID |
| `getPhotoUrlByChore` | query | Gets photo URL for a daily chore by clientId |

### Chore CRUD Updates

- `masterChores.create` accepts optional `requiresPhoto`
- `masterChores.update` accepts optional `requiresPhoto`
- `cloneMasterToDaily` copies `requiresPhoto: master.requiresPhoto ?? false`
- `addAdHoc` defaults to `requiresPhoto: false`

## Architecture Decisions

### 1. Storage ID Reference Pattern

Photo binaries stored in Convex's built-in `_storage` table. Daily chores reference via `v.id("_storage")` for:
- Automatic URL generation via `ctx.storage.getUrl()`
- Built-in CDN serving
- No manual file management

### 2. Photo Metadata at Attachment Time

Capture timestamp and user at attachment (not upload) because:
- Upload URL generation doesn't know which chore
- Attachment is the meaningful action

### 3. Required vs Optional requiresPhoto

- **Master:** Optional (existing chores pre-date feature)
- **Daily:** Required (explicit state, defaults false on clone)

## Commits

| Hash | Description |
|------|-------------|
| `478fe5c` | Add photo verification fields to Convex schema |
| `9bffbdd` | Create Convex photos API |
| `e0185d4` | Add requiresPhoto support to master chore CRUD |

## Deviations from Plan

None - plan executed as written. The dailyChores.ts updates were done in Task 1 to satisfy TypeScript requirements, which aligned with Task 3 objectives.

## Next Phase Readiness

**For 05-03 (Camera Capture):**
- Use `api.photos.generateUploadUrl` to get upload URL
- Upload blob directly to returned URL
- Call `api.photos.attachPhotoToChore` with returned storage ID

**For 05-04 (Photo Display):**
- Use `api.photos.getPhotoUrlByChore` to get serving URL
- URL is ready for `<img src={url}>` usage

## Files Changed

```
src/convex/schema.ts       # Added photo fields to masterChores and dailyChores
src/convex/photos.ts       # New file: photo upload/retrieval API
src/convex/dailyChores.ts  # Updated cloning and ad-hoc to include requiresPhoto
src/convex/masterChores.ts # Updated create/update to accept requiresPhoto
```
