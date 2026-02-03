# Phase 5: Photo Verification - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Capture, store, and upload photos for chore completions. Photos persist offline and upload when connected. Admin can configure which chores require photo proof. Required-photo chores cannot be completed without a photo.

</domain>

<decisions>
## Implementation Decisions

### Capture experience
- Camera preferred, gallery selection as fallback
- Always show preview after capture with accept/retake options
- Single photo per chore completion (not multiple)
- Photo capture happens BEFORE marking chore done (tap chore → camera opens → capture photo → chore marked complete)

### Compression & quality
- Favor quality over file size (~500KB-1MB acceptable)
- JPEG format for universal compatibility
- Keep original camera resolution (no resizing)
- Strip EXIF metadata (GPS, timestamps) — app tracks its own completion data

### Upload behavior
- Immediate upload when online; queue in IndexedDB when offline
- Show progress bar during upload
- Auto-retry silently on failure (no manual retry needed)
- Keep queued photos indefinitely until synced (no retention limit)
- Background upload enabled — use Background Sync API to continue when app is in background
- Sequential uploads (one at a time) when processing queue
- Global badge/count showing pending uploads (e.g., "3 photos uploading")
- Upload regardless of connection type (WiFi or cellular)

### Photo viewing
- Small thumbnail displayed next to completed chores in list
- Tap thumbnail opens dedicated page/modal
- Photo view includes download-to-device-gallery button
- Pinch-to-zoom supported for inspecting detail
- Show metadata on photo view: who completed the chore and when

### Claude's Discretion
- Exact thumbnail dimensions
- Photo view page layout and transitions
- Background Sync API implementation details
- Progress bar styling and animation
- Queue persistence strategy within IndexedDB

</decisions>

<specifics>
## Specific Ideas

- Flow: tap chore → camera → preview with accept/retake → chore marked complete with photo attached
- Download button on photo view lets users save proof to device gallery
- Background sync ensures photos upload even when user navigates away

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-photo-verification*
*Context gathered: 2026-02-02*
