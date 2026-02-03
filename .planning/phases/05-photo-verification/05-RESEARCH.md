# Phase 5: Photo Verification - Research

**Researched:** 2026-02-02
**Domain:** Photo capture, compression, offline persistence, and cloud upload
**Confidence:** HIGH

## Summary

This phase implements photo verification for chore completions. The technical domain spans browser camera access, client-side image compression, IndexedDB persistence for offline scenarios, Convex file storage for permanent storage, and background sync for resilient uploads.

The project already has a solid foundation with `idb` (v8.0.3) for IndexedDB operations, a working mutation queue system in `src/lib/sync/engine.svelte.ts`, and `@vite-pwa/sveltekit` with Workbox for service worker management. Photo verification extends these patterns with a dedicated photo queue and Convex's built-in file storage.

Key findings: Browser-image-compression library handles JPEG compression with EXIF stripping by default. Convex file storage uses a three-step upload URL pattern that works well with offline-first architectures. The Background Sync API has limited browser support but Workbox provides automatic fallback to retry on service worker startup.

**Primary recommendation:** Use browser-image-compression for capture/compress, extend the existing IndexedDB schema with a `photoQueue` store, and use Convex's `generateUploadUrl` pattern for uploads.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| browser-image-compression | ^2.0.2 | Client-side JPEG compression | 390k+ weekly downloads, strips EXIF by default, web worker support |
| idb | 8.0.3 | IndexedDB wrapper (already installed) | Type-safe, promise-based, project standard |
| Convex file storage | Built-in | Cloud file storage | Native to project backend, no additional setup |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workbox-background-sync | 7.x | Background upload retry | Included via @vite-pwa/sveltekit |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| browser-image-compression | compressorjs | compressorjs is smaller but lacks web worker support |
| browser-image-compression | canvas.toBlob() directly | Manual EXIF handling, no progress callback |
| Convex file storage | Cloudflare R2 | R2 requires additional setup, Convex is already integrated |

**Installation:**
```bash
npm install browser-image-compression
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── db/
│   │   ├── client.ts              # Extend with photoQueue store
│   │   ├── schema.ts              # Add PhotoQueueEntry schema
│   │   └── operations.ts          # Add photo queue operations
│   ├── photo/
│   │   ├── capture.ts             # Camera capture + compression
│   │   ├── queue.svelte.ts        # Photo queue state management
│   │   └── upload.ts              # Convex upload logic
│   └── sync/
│       └── engine.svelte.ts       # Extend to process photo queue
├── convex/
│   ├── schema.ts                  # Add requiresPhoto to masterChores/dailyChores
│   └── photos.ts                  # Photo upload mutations + queries
└── routes/
    └── (app)/
        ├── photo-capture/
        │   └── +page.svelte       # Camera capture page
        └── photo-view/
            └── [id]/+page.svelte  # Photo viewing with zoom
```

### Pattern 1: Photo Queue Entry Schema
**What:** Data structure for queued photos awaiting upload
**When to use:** All photo captures before upload completion
**Example:**
```typescript
// Source: Project extension of existing pattern
export const PhotoQueueEntrySchema = z.object({
  id: z.string(),                              // UUID
  dailyChoreClientId: z.string(),              // Links to dailyChore
  blob: z.instanceof(Blob),                    // Compressed image blob
  mimeType: z.literal('image/jpeg'),
  originalSize: z.number(),                    // Pre-compression size
  compressedSize: z.number(),                  // Post-compression size
  capturedAt: z.number(),                      // Timestamp
  capturedBy: z.string(),                      // User display name
  uploadStatus: z.enum(['pending', 'uploading', 'failed']),
  retryCount: z.number().default(0),
  lastAttemptAt: z.number().optional(),
});
```

### Pattern 2: Convex Upload URL Flow
**What:** Three-step pattern for uploading files to Convex
**When to use:** All photo uploads
**Example:**
```typescript
// Source: https://docs.convex.dev/file-storage/upload-files

// 1. Generate upload URL (Convex mutation)
export const generatePhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// 2. Upload blob to URL (client-side)
async function uploadPhoto(blob: Blob): Promise<Id<"_storage">> {
  const uploadUrl = await convexClient.mutation(api.photos.generatePhotoUploadUrl);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type },
    body: blob,
  });

  const { storageId } = await response.json();
  return storageId;
}

// 3. Save storage ID to database (Convex mutation)
export const attachPhotoToChore = mutation({
  args: {
    dailyChoreClientId: v.string(),
    storageId: v.id("_storage"),
    capturedAt: v.number(),
    capturedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Update dailyChore with photo reference
    const chore = await ctx.db
      .query("dailyChores")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.dailyChoreClientId))
      .first();

    if (chore) {
      await ctx.db.patch(chore._id, {
        photoStorageId: args.storageId,
        photoCapturedAt: args.capturedAt,
        photoCapturedBy: args.capturedBy,
      });
    }
  },
});
```

### Pattern 3: Camera Capture with HTML5 Input
**What:** Native camera access without permissions API complexity
**When to use:** Photo capture on mobile devices
**Example:**
```svelte
<!-- Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture -->
<script lang="ts">
  import imageCompression from 'browser-image-compression';

  let fileInput: HTMLInputElement;
  let previewUrl = $state<string | null>(null);
  let compressedBlob = $state<Blob | null>(null);

  async function handleCapture(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Compress with EXIF stripped (default behavior)
    const options = {
      maxSizeMB: 1,
      useWebWorker: true,
      preserveExif: false,  // Strips GPS, timestamps (default)
      fileType: 'image/jpeg',
      initialQuality: 0.85,
      onProgress: (percent: number) => console.log(`Compression: ${percent}%`),
    };

    compressedBlob = await imageCompression(file, options);
    previewUrl = URL.createObjectURL(compressedBlob);
  }
</script>

<!-- Camera preferred, gallery fallback -->
<input
  bind:this={fileInput}
  type="file"
  accept="image/*"
  capture="environment"
  onchange={handleCapture}
  style="display: none"
/>

<button onclick={() => fileInput.click()}>
  Take Photo
</button>

{#if previewUrl}
  <img src={previewUrl} alt="Preview" />
{/if}
```

### Pattern 4: Sequential Queue Processing with Progress
**What:** Process upload queue one at a time with global progress indicator
**When to use:** When online and photos are queued
**Example:**
```typescript
// Source: Project pattern extension
class PhotoUploadQueue {
  pendingCount = $state(0);
  currentUpload = $state<string | null>(null);

  async processQueue() {
    const entries = await getPhotoQueueEntries();
    this.pendingCount = entries.length;

    for (const entry of entries) {
      if (entry.uploadStatus === 'failed') continue;

      this.currentUpload = entry.id;
      try {
        await this.uploadSinglePhoto(entry);
        await removePhotoQueueEntry(entry.id);
        this.pendingCount--;
      } catch (error) {
        await incrementPhotoRetry(entry.id);
      }
    }
    this.currentUpload = null;
  }
}
```

### Anti-Patterns to Avoid
- **Storing base64 in IndexedDB:** Use Blob directly - base64 is 33% larger and slower to process
- **Uploading before compression:** Always compress before queueing to avoid storing large files
- **Blocking UI during compression:** Use web worker (default in browser-image-compression)
- **Manual retry logic for uploads:** Use existing sync engine pattern with retry count

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image compression | Canvas manipulation loop | browser-image-compression | Handles EXIF, quality iteration, web workers, edge cases |
| EXIF stripping | Manual binary parsing | browser-image-compression (preserveExif: false) | EXIF format is complex, GPS/timestamp in multiple locations |
| IndexedDB operations | Raw IndexedDB API | idb library (already installed) | Type safety, promise API, upgrade handling |
| Upload retry | Custom retry loop | Extend existing sync engine pattern | Already handles retry count, failure marking |
| File serving URLs | Custom HTTP endpoints | Convex storage.getUrl() | Built-in, handles authentication, caching |

**Key insight:** Image handling has many edge cases (EXIF orientation, iOS quirks, memory limits). Browser-image-compression handles these. The project already has a mutation queue pattern - photos should follow the same architecture.

## Common Pitfalls

### Pitfall 1: iOS Memory Limits
**What goes wrong:** Large photos (12MP+) crash the browser tab during canvas operations
**Why it happens:** iOS Safari has strict memory limits (~256MB for web content)
**How to avoid:** browser-image-compression handles this with chunked processing; don't pre-load multiple large images
**Warning signs:** App crashes silently on iOS when processing photos

### Pitfall 2: Capture Attribute Behavior Difference
**What goes wrong:** Desktop browsers show file picker instead of camera
**Why it happens:** `capture` attribute only works on mobile browsers with cameras
**How to avoid:** Accept this behavior - desktop users select from file system, mobile opens camera
**Warning signs:** N/A - this is expected behavior

### Pitfall 3: Background Sync Browser Support
**What goes wrong:** Photos don't upload when app is backgrounded on Safari/Firefox
**Why it happens:** Background Sync API only supported in Chromium browsers
**How to avoid:** Workbox provides fallback - retries when service worker starts. Also retry when app returns to foreground.
**Warning signs:** Photos stuck in queue on non-Chrome browsers

### Pitfall 4: Upload URL Expiration
**What goes wrong:** Upload fails with 403 after photo queued for a while
**Why it happens:** Convex upload URLs expire after 1 hour
**How to avoid:** Generate upload URL immediately before upload, never cache/store it
**Warning signs:** Intermittent upload failures on queued photos

### Pitfall 5: Blob Not Persisting Correctly
**What goes wrong:** Photo blob is empty or corrupted after IndexedDB retrieval
**Why it happens:** Incorrect serialization or transaction handling
**How to avoid:** Store Blob directly (IndexedDB supports it natively), verify with immediate read-back during development
**Warning signs:** Photo preview works but uploaded image is corrupted

### Pitfall 6: Missing Photo on Required-Photo Chore
**What goes wrong:** Chore marked complete without photo when required
**Why it happens:** UI allows completion button without photo check
**How to avoid:** Disable completion button/action until photo is captured for required-photo chores
**Warning signs:** Incomplete chores in database with requiresPhoto=true and no photoStorageId

## Code Examples

Verified patterns from official sources:

### Camera Input with Environment Camera (Back-facing)
```html
<!-- Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture -->
<input type="file" accept="image/*" capture="environment">
```

### Image Compression with Progress
```typescript
// Source: https://github.com/Donaldcwl/browser-image-compression
import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 1,                 // Target ~1MB
  useWebWorker: true,           // Non-blocking
  preserveExif: false,          // Strip metadata (GPS, etc.)
  fileType: 'image/jpeg',       // Force JPEG output
  initialQuality: 0.85,         // Start at 85% quality
  onProgress: (percent) => {
    console.log(`Compression progress: ${percent}%`);
  },
};

const compressedFile = await imageCompression(originalFile, options);
```

### Convex File Storage - Generate URL
```typescript
// Source: https://docs.convex.dev/file-storage/upload-files
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
```

### Convex File Storage - Get Serving URL
```typescript
// Source: https://docs.convex.dev/file-storage/serve-files
import { query } from "./_generated/server";

export const getPhotoUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
```

### Download Image to Device (Anchor Download)
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#download
function downloadImage(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

### Workbox Background Sync Queue (Reference)
```typescript
// Source: https://developer.chrome.com/docs/workbox/modules/workbox-background-sync
// Note: May need injectManifest strategy for custom SW code
import { Queue } from 'workbox-background-sync';

const photoQueue = new Queue('photo-uploads', {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
});

// In service worker fetch handler
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/photo-upload')) {
    const bgSyncLogic = async () => {
      try {
        const response = await fetch(event.request.clone());
        return response;
      } catch (error) {
        await photoQueue.pushRequest({ request: event.request });
        throw error;
      }
    };
    event.respondWith(bgSyncLogic());
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| getUserMedia for camera | `<input capture>` for simple capture | Long established | Simpler, no permissions prompt for capture |
| Manual EXIF parsing | browser-image-compression strips by default | v2.0+ | Less code, fewer bugs |
| Store base64 in IndexedDB | Store Blob directly | Always supported | 33% smaller, faster |
| Custom retry logic | Workbox BackgroundSync + app-level fallback | Workbox 7.x | Automatic retry, IndexedDB queue |

**Deprecated/outdated:**
- navigator.camera (Cordova-only): Use HTML5 input[capture] instead
- FileReader.readAsDataURL for storage: Store Blob directly in IndexedDB

## Open Questions

Things that couldn't be fully resolved:

1. **Convex URL expiration/caching**
   - What we know: Upload URLs expire in 1 hour; serving URLs generated by getUrl()
   - What's unclear: How long serving URLs are valid, caching behavior
   - Recommendation: Generate serving URLs fresh in queries, don't cache long-term

2. **Background Sync on Safari/Firefox**
   - What we know: Background Sync API not supported; Workbox falls back to retry on SW startup
   - What's unclear: Safari's specific fallback behavior may be unreliable (known Workbox issue)
   - Recommendation: Implement additional retry on visibilitychange (app returns to foreground)

3. **Optimal compression quality for farm photos**
   - What we know: User wants quality over size, ~500KB-1MB acceptable
   - What's unclear: Best initialQuality setting for varying lighting conditions
   - Recommendation: Start with 0.85, test with real farm photos, adjust if needed

## Sources

### Primary (HIGH confidence)
- [Convex File Storage - Upload Files](https://docs.convex.dev/file-storage/upload-files) - Upload URL pattern, limits
- [Convex File Storage - Serve Files](https://docs.convex.dev/file-storage/serve-files) - Serving URLs
- [MDN - HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) - Camera input
- [MDN - Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) - API reference
- [browser-image-compression GitHub](https://github.com/Donaldcwl/browser-image-compression) - API options, EXIF handling
- [Workbox Background Sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync) - Queue class, plugin usage

### Secondary (MEDIUM confidence)
- [vite-pwa SvelteKit docs](https://vite-pwa-org.netlify.app/frameworks/sveltekit) - Custom SW configuration
- [MDN - anchor download attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#download) - Download to device

### Tertiary (LOW confidence)
- Workbox Safari fallback behavior - Known issues reported but specifics unclear

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs verified, library well-maintained
- Architecture: HIGH - Extends existing project patterns
- Pitfalls: HIGH - Well-documented in official sources and issues
- Background Sync: MEDIUM - Browser support varies, fallback behavior less documented

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain)
