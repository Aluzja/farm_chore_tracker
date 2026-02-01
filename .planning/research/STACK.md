# Technology Stack

**Project:** Kitchen Sink Farm - PWA Additions
**Researched:** 2026-02-01
**Overall Confidence:** MEDIUM (training data, verification recommended)

## Existing Stack (Do Not Change)

| Technology | Version | Purpose |
|------------|---------|---------|
| SvelteKit | ^2.22.0 | Application framework |
| Svelte | ^5.0.0 | UI framework |
| Vite | ^7.0.4 | Build tool |
| TypeScript | ^5.0.0 | Type safety |

---

## Recommended Additions

### Database: Convex

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| convex | ^1.17.x | Backend-as-a-service with real-time sync | Built-in real-time subscriptions, optimistic updates, TypeScript-first. Eliminates need for separate WebSocket setup. |
| convex-svelte | ^0.1.x | Svelte bindings for Convex | Official Convex adapter providing reactive Svelte stores for queries and mutations. |

**Confidence:** MEDIUM - Convex Svelte bindings exist but verify exact package name and version on npm.

**Rationale:**
- Convex provides automatic real-time sync without manual WebSocket management
- TypeScript schema definitions generate type-safe client code
- Built-in optimistic updates improve perceived performance
- Serverless functions scale automatically
- File storage is built into Convex (no separate S3 setup needed)

**Alternative Considered:** Firebase + custom sync
- Why not: More complex offline sync setup, less TypeScript-native, requires more boilerplate for real-time features

### PWA: vite-plugin-pwa

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vite-plugin-pwa | ^0.21.x | PWA manifest and service worker generation | Best-in-class Vite PWA plugin, SvelteKit-aware, handles manifest + SW generation. |
| @vite-pwa/sveltekit | ^0.6.x | SvelteKit-specific PWA integration | Provides proper SSR handling, auto-registration, and SvelteKit-compatible SW strategies. |
| workbox-precaching | ^7.x | Service worker caching strategies | Bundled with vite-plugin-pwa, provides precaching and runtime caching. |

**Confidence:** MEDIUM - vite-plugin-pwa is stable, but verify current version compatibility with Vite 7.

**Rationale:**
- vite-plugin-pwa is the standard solution for Vite-based PWAs
- Generates manifest.webmanifest automatically from config
- Supports both generateSW (auto) and injectManifest (custom) modes
- @vite-pwa/sveltekit handles SvelteKit's service worker quirks

**Alternative Considered:** Custom service worker
- Why not: Significant boilerplate, easy to get caching wrong, vite-plugin-pwa handles edge cases

### Offline Data Sync

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| idb | ^8.x | IndexedDB wrapper | Lightweight (~1KB), Promise-based API, TypeScript support. For local queue storage. |

**Confidence:** HIGH - idb is stable and well-maintained.

**Rationale:**
- Convex has built-in optimistic updates but limited offline support
- Need local IndexedDB queue for mutations when offline
- idb provides clean Promise API over raw IndexedDB
- Queue syncs when connection restored

**Architecture Pattern:**
```
Online: User action -> Convex mutation (optimistic) -> Server
Offline: User action -> IndexedDB queue -> UI update (local) -> Sync when online
```

**Alternative Considered:** localForage
- Why not: Larger bundle, async storage abstraction not needed (we specifically want IndexedDB)

**Alternative Considered:** Dexie.js
- Why not: More features than needed, idb is simpler for queue storage

### Camera/Photo Capture

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native MediaDevices API | N/A | Camera access | No library needed - browser API is sufficient |

**Confidence:** HIGH - Web standard, well-supported.

**Rationale:**
- `navigator.mediaDevices.getUserMedia()` provides camera access
- File input with `capture="environment"` attribute for simple photo capture
- Canvas API for image processing (resize, compress)
- No library overhead needed

**Implementation Pattern:**
```html
<!-- Simple approach for mobile -->
<input type="file" accept="image/*" capture="environment" />

<!-- For custom camera UI -->
<video bind:this={videoElement}></video>
<canvas bind:this={canvasElement}></canvas>
```

### File Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Convex File Storage | Built-in | Image/file storage | Already using Convex; built-in storage avoids separate S3 setup |

**Confidence:** HIGH - Core Convex feature.

**Rationale:**
- Convex includes file storage up to 20MB per file
- Generates signed URLs automatically
- TypeScript-typed file references
- No additional infrastructure

**Storage Flow:**
```
1. Client captures photo
2. Compress/resize client-side (canvas)
3. Upload to Convex storage via generateUploadUrl()
4. Store file ID in document
5. Retrieve via storage.getUrl()
```

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| browser-image-compression | ^2.x | Client-side image compression | Before uploading photos to reduce bandwidth and storage |

**Confidence:** MEDIUM - Verify current version.

---

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| Firebase | More complex sync setup, less TypeScript-native than Convex |
| PouchDB/CouchDB | Overkill for this use case, complex replication setup |
| localForage | Unnecessary abstraction layer over IndexedDB |
| workbox-window | vite-plugin-pwa handles registration |
| Custom service worker from scratch | Error-prone, vite-plugin-pwa handles edge cases |
| Capacitor/Cordova | Not needed - PWA camera APIs work well for web-only |
| Native app wrapper | PWA sufficient for farm chore tracking use case |

---

## Installation

```bash
# Core Convex
bun add convex
bun add convex-svelte

# PWA
bun add -D vite-plugin-pwa @vite-pwa/sveltekit

# Offline support
bun add idb

# Image handling
bun add browser-image-compression
```

## Configuration Overview

### Convex Setup

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chores: defineTable({
    name: v.string(),
    completed: v.boolean(),
    completedBy: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    photoId: v.optional(v.id("_storage")),
  }),
});
```

### PWA Configuration

```typescript
// vite.config.ts
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Kitchen Sink Farm',
        short_name: 'Farm Chores',
        theme_color: '#4a7c59',
        icons: [/* ... */],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*convex.*$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'convex-api' },
          },
        ],
      },
    }),
  ],
});
```

---

## Version Verification Needed

Before implementation, verify current versions:

| Package | Verify | How |
|---------|--------|-----|
| convex | Latest stable | `bun info convex` |
| convex-svelte | Exists and version | `bun info convex-svelte` or check Convex docs |
| vite-plugin-pwa | Vite 7 compatibility | Check changelog/releases |
| @vite-pwa/sveltekit | SvelteKit 2 compatibility | Check changelog/releases |
| idb | Latest stable | `bun info idb` |

---

## Sources

- Convex documentation: https://docs.convex.dev
- vite-plugin-pwa documentation: https://vite-pwa-org.netlify.app
- MDN MediaDevices API: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices
- idb library: https://github.com/jakearchibald/idb

**Note:** This research is based on training data with knowledge cutoff. Verify current versions and API compatibility before implementation.
