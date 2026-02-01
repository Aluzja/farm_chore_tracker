# Domain Pitfalls

**Domain:** SvelteKit + Convex + PWA Offline-First Farm Chore Tracker
**Researched:** 2026-02-01
**Overall Confidence:** MEDIUM (based on domain knowledge; verify Convex-specific patterns with official docs)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Treating Convex Like a Traditional REST Backend

**What goes wrong:** Developers try to use Convex with request/response mental model instead of reactive subscriptions. They fetch data once and expect it to stay current, leading to stale UI and missed updates from other users.

**Why it happens:** Experience with REST APIs creates assumptions that don't apply to Convex's real-time reactive model.

**Consequences:**
- Users see stale chore completion status
- Duplicate work when two people complete the same chore
- Manual refresh required to see updates
- Defeats core value proposition of real-time coordination

**Prevention:**
- Use Convex queries with reactive subscriptions (not one-time fetches)
- SvelteKit: Use `useQuery` from convex-svelte that returns reactive stores
- Think "live query" not "fetch"
- Test with two browser windows side-by-side during development

**Detection:**
- UI requires manual refresh to see updates
- Convex dashboard shows query calls without subscriptions
- Users report seeing different states than each other

**Phase:** Foundation/Convex integration phase - must be correct from the start

---

### Pitfall 2: Service Worker Caching Convex's WebSocket Connection

**What goes wrong:** Service worker intercepts Convex WebSocket traffic, breaking real-time sync. Or caches API responses that should be live, causing stale data.

**Why it happens:** Generic service worker recipes cache "all network requests" which includes Convex's sync protocol.

**Consequences:**
- Real-time updates stop working silently
- App appears to work but sync is broken
- Extremely hard to debug - looks like Convex issue
- Only manifests when service worker is active (not in dev)

**Prevention:**
- Explicitly exclude Convex endpoints from service worker cache:
  ```javascript
  // In service worker
  if (url.hostname.includes('convex')) {
    return fetch(event.request);
  }
  ```
- Test with service worker enabled in development (use production build)
- Verify WebSocket connection in Network tab shows "101 Switching Protocols"

**Detection:**
- Real-time sync works in dev, breaks in production
- Network tab shows cached responses for Convex endpoints
- WebSocket doesn't establish properly

**Phase:** PWA/Service Worker phase - critical to get right early

---

### Pitfall 3: Optimistic Updates Without Rollback Strategy

**What goes wrong:** When offline mutations queue and then fail on sync, the UI shows completed state that never persisted. User thinks chore is done, but it isn't.

**Why it happens:** Optimistic UI is implemented for responsiveness, but the failure path isn't handled.

**Consequences:**
- Data loss - user actions disappear silently
- False confidence - chores marked done aren't actually recorded
- Trust erosion - users lose confidence in the app
- Coordination failures - if one user's "done" didn't persist, another user might skip it

**Prevention:**
- Implement mutation queue with status tracking (pending/synced/failed)
- Show visual indicator for unsynced items (e.g., subtle icon)
- Handle sync failures with user notification
- Provide retry mechanism for failed mutations
- Consider: "Mark as done" vs "Done (syncing...)" vs "Done" states

**Detection:**
- No visual difference between synced and pending items
- No error handling in mutation callbacks
- Items disappear after going offline then online

**Phase:** Offline sync implementation phase

---

### Pitfall 4: Photo Upload Without Offline Queue

**What goes wrong:** Photos taken offline are lost because there's no local storage queue. Or photos are stored in memory/temp storage that gets cleared.

**Why it happens:** File uploads are often treated as synchronous operations. Browser File API is transient.

**Consequences:**
- Photos taken in the field (offline) are lost
- Users must retake photos when back online
- Verification workflow broken for remote farm areas
- Core feature (photo proof) unreliable

**Prevention:**
- Store photos in IndexedDB immediately after capture (not just in memory)
- Implement upload queue that persists across sessions
- Keep photo in IndexedDB until server confirms receipt
- Show clear status: "Photo saved locally" vs "Photo uploaded"
- Consider compression before storage (IndexedDB has size limits per origin)

**Detection:**
- Photos taken offline don't appear after coming online
- No IndexedDB storage for media
- Refresh while offline loses captured photos

**Phase:** Photo capture phase - design storage strategy before implementing capture

---

### Pitfall 5: Conflict Resolution Afterthought

**What goes wrong:** Two users complete the same chore while one is offline. When sync happens, data conflicts occur with no resolution strategy, causing data loss or duplicates.

**Why it happens:** Conflict resolution is complex; teams defer it until "later" then discover it's architectural.

**Consequences:**
- Lost completions (one user's work disappears)
- Duplicate completions (chore shows done twice)
- Inconsistent state between devices
- Requires database migration to fix properly

**Prevention:**
- Design conflict strategy upfront: Last-Write-Wins (LWW) or Merge
- For chore completion: LWW is usually acceptable (both users did the chore, one record is fine)
- Add timestamps to all mutations for ordering
- For photo attachments: Consider keeping both (merge)
- Document strategy in architecture docs

**Detection:**
- No timestamp fields on mutable records
- No discussion of "what if two users..." scenarios
- Testing only with single user

**Phase:** Data model design phase - before writing first mutation

---

### Pitfall 6: SvelteKit SSR Conflicts with Client-Only Convex

**What goes wrong:** Convex client initializes during SSR, fails because it needs browser APIs (WebSocket, localStorage). Or hydration mismatch when server renders stale/empty data that client then populates.

**Why it happens:** SvelteKit SSR runs code on server first. Convex is client-only.

**Consequences:**
- Build/SSR failures in production
- Hydration errors in console
- Flash of empty content on page load
- Inconsistent behavior between dev and prod

**Prevention:**
- Initialize Convex only on client side:
  ```svelte
  <script>
  import { browser } from '$app/environment';
  </script>

  {#if browser}
    <ConvexProvider>
      <slot />
    </ConvexProvider>
  {/if}
  ```
- Or use SvelteKit's `ssr: false` for routes that need Convex
- Handle loading states explicitly (skeleton UI, not empty)

**Detection:**
- "window is not defined" or "WebSocket is not defined" errors
- Works in dev, fails in production build
- Console shows hydration mismatch warnings

**Phase:** Convex integration phase - first thing to get right

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 7: IndexedDB Schema Evolution Without Migration

**What goes wrong:** Local IndexedDB schema changes between app versions, breaking existing offline data for users who haven't refreshed.

**Why it happens:** Web apps auto-update via service worker, but IndexedDB doesn't auto-migrate.

**Prevention:**
- Version your IndexedDB schema from day one
- Implement migration functions for schema changes
- Test upgrades by running old version, storing data, then upgrading
- Consider using a wrapper library (idb) that handles versioning

**Detection:**
- App breaks for users who haven't cleared cache
- IndexedDB errors about object stores
- Works for new users, breaks for existing

**Phase:** Offline storage implementation

---

### Pitfall 8: Service Worker Update Confusion

**What goes wrong:** Users stuck on old app version because service worker caches aggressively. Or constant "new version available" prompts annoy users.

**Why it happens:** Service worker lifecycle is complex; default caching is aggressive.

**Prevention:**
- Implement clear update strategy (prompt on new version, auto-reload, or hybrid)
- Use workbox or similar for predictable caching behavior
- Version your service worker cache names
- Test service worker updates explicitly (not just fresh installs)
- Add "app version" visible in UI for debugging

**Detection:**
- Users report features missing that were deployed
- "Works on my machine" issues
- No visible app version indicator

**Phase:** PWA implementation phase

---

### Pitfall 9: Camera API Browser Inconsistencies

**What goes wrong:** Camera capture works on some devices but fails on others. iOS Safari has different constraints than Android Chrome.

**Why it happens:** MediaDevices API and file input have browser-specific behaviors, especially on mobile.

**Prevention:**
- Test on actual iOS and Android devices (not just emulators)
- Use `<input type="file" accept="image/*" capture="environment">` for maximum compatibility
- Handle permission denials gracefully
- Provide fallback for devices without cameras
- Consider both "take photo" and "choose from library" options

**Detection:**
- "Camera not working" reports from specific device/browser combos
- No error handling around getUserMedia
- Only tested in Chrome desktop

**Phase:** Photo capture implementation

---

### Pitfall 10: localStorage for User Keys Without Backup

**What goes wrong:** User clears browser data (or browser clears it automatically), losing their access key. They can't log back in because they never saved the key.

**Why it happens:** localStorage seems persistent but isn't guaranteed. Mobile browsers especially clear data under storage pressure.

**Prevention:**
- Store keys in both localStorage AND IndexedDB (belt and suspenders)
- Prompt users to save/bookmark their unique URL
- For admin: implement key recovery via email
- Consider: Generate keys from memorable phrases if full auth is overkill
- Show warning if storage APIs are unavailable

**Detection:**
- User reports getting logged out unexpectedly
- Users can't access after clearing cookies
- No key recovery mechanism

**Phase:** Auth/key system implementation

---

### Pitfall 11: Not Testing True Offline Scenarios

**What goes wrong:** App "works offline" in dev but fails in real offline conditions. Dev testing uses throttled network, not actual disconnection.

**Why it happens:** True offline is hard to simulate. Chrome DevTools "offline" mode doesn't perfectly replicate real conditions.

**Prevention:**
- Test with airplane mode on real devices
- Test with WiFi disabled (not just throttled)
- Test the offline-to-online transition
- Test background sync when app is closed then reopened
- Test with service worker + no network + app restart

**Detection:**
- Works with DevTools offline mode, fails with real offline
- Never tested on actual mobile devices
- No testing of app restart while offline

**Phase:** QA/testing phase - throughout development

---

### Pitfall 12: Convex File Storage Size Limits

**What goes wrong:** Large photos fill up Convex storage quota, or uploads fail for high-res images.

**Why it happens:** Modern phone cameras capture very large images. Convex has storage considerations.

**Prevention:**
- Compress images before upload (target reasonable size like 1-2MB)
- Implement client-side image resize before upload
- Track storage usage in admin dashboard
- Implement cleanup for old photos (7-day retention requirement helps)
- Consider thumbnail generation for list views

**Detection:**
- Upload failures for large images
- Slow uploads in field conditions
- Storage quota warnings from Convex

**Phase:** Photo upload implementation

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 13: PWA Install Prompt Timing

**What goes wrong:** Install prompt appears too early (user ignores it) or never appears (criteria not met).

**Why it happens:** Browser install prompt has specific criteria and timing that developers don't control directly.

**Prevention:**
- Meet all PWA criteria (manifest, service worker, HTTPS, etc.)
- Don't show custom install prompt on first visit
- Wait for user engagement before prompting
- Provide manual "Add to Home Screen" instructions as backup

**Detection:**
- Install prompt never fires
- Users report not being able to install
- beforeinstallprompt event not captured

**Phase:** PWA manifest phase

---

### Pitfall 14: Svelte 5 Runes Migration Gotchas

**What goes wrong:** Mixing old Svelte reactive patterns ($: declarations) with new runes causes confusing behavior.

**Why it happens:** Svelte 5 runes ($state, $derived, $effect) replace old reactive patterns but both still work, causing confusion.

**Prevention:**
- Commit to runes fully for new code
- Use svelte-check to catch pattern mixing
- Follow Svelte 5 migration guide
- Establish team conventions early

**Detection:**
- Mixed patterns in codebase
- Unexpected reactivity behavior
- Svelte 5 deprecation warnings

**Phase:** All development phases

---

### Pitfall 15: Time Zone Confusion for Daily Chores

**What goes wrong:** "Daily" chores reset at wrong time because of UTC vs local time confusion. User in different timezone sees yesterday's chores.

**Why it happens:** JavaScript Date and server timestamps default to UTC. Farm operates in local time.

**Prevention:**
- Decide: Is "day" based on server timezone or user timezone?
- Store and compare dates in consistent timezone
- For single-farm app: Use farm's timezone explicitly
- Test around midnight in the farm's timezone

**Detection:**
- Chores reset at unexpected times
- Different users see different "today"
- Testing never happens near midnight

**Phase:** Data model design phase

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Priority |
|-------------|---------------|------------|----------|
| Convex Setup | SSR conflicts (#6) | Client-only initialization | HIGH |
| Convex Setup | REST mental model (#1) | Use reactive subscriptions | HIGH |
| Data Model | Conflict resolution (#5) | Design strategy upfront | HIGH |
| Data Model | Timezone confusion (#15) | Define timezone policy | MEDIUM |
| Service Worker | Caching WebSocket (#2) | Explicit Convex exclusion | CRITICAL |
| Service Worker | Update confusion (#8) | Clear update strategy | MEDIUM |
| Offline Storage | IndexedDB migration (#7) | Version schema from start | MEDIUM |
| Offline Sync | Optimistic without rollback (#3) | Status tracking + UI | HIGH |
| Photo Capture | Browser inconsistencies (#9) | Multi-device testing | MEDIUM |
| Photo Upload | Offline queue (#4) | IndexedDB storage | HIGH |
| Photo Upload | Size limits (#12) | Client-side compression | MEDIUM |
| User Auth | localStorage loss (#10) | Dual storage + recovery | MEDIUM |
| Testing | True offline (#11) | Real device + airplane mode | HIGH |

## Research Confidence Notes

| Topic | Confidence | Rationale |
|-------|------------|-----------|
| Convex + SvelteKit integration | MEDIUM | Based on general Convex and SvelteKit knowledge; verify convex-svelte package specifics with official docs |
| Service worker caching | HIGH | Well-documented PWA patterns |
| Offline-first sync | HIGH | Established patterns, IndexedDB well understood |
| Photo capture | MEDIUM | Browser APIs evolve; test on target devices |
| Conflict resolution | HIGH | Standard distributed systems patterns |
| Svelte 5 runes | MEDIUM | Relatively new; patterns still evolving |

## Gaps Requiring Phase-Specific Research

1. **convex-svelte package specifics** - Verify exact API for SvelteKit integration when implementing
2. **Convex file storage limits** - Check current pricing/limits during photo implementation
3. **iOS Safari PWA quirks** - Known to have unique behaviors; test thoroughly on real devices
4. **Svelte 5 + SvelteKit 2.22 patterns** - Both relatively new; patterns may have evolved

---

*Pitfalls research: 2026-02-01*
*Note: Confidence is MEDIUM overall. Verify Convex-specific patterns with official documentation during implementation. Service worker and offline patterns are HIGH confidence based on established PWA best practices.*
