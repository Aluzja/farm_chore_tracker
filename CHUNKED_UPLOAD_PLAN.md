# Chunked Resumable Upload Plan

**Status:** Future — implement if Options 1+2 don't bring upload success rate above ~90%.

## Problem Statement

On slow/flaky rural cell connections, even a 500KB photo upload can fail if the
connection drops mid-transfer. The current approach is all-or-nothing: if the
single POST fails, the entire blob must be re-uploaded from scratch.

## Goal

Upload photos in small chunks (~100KB each) so that:
- Each chunk completes in 1-2 seconds even on slow 3G
- Interrupted uploads resume from the last successful chunk
- A complete connection loss only loses 1 chunk of progress, not the whole photo

## Architecture

### Why Convex Storage Won't Work

Convex's `generateUploadUrl` → `POST blob` pattern is atomic — there's no way to
upload partial blobs and assemble them. We need an intermediate layer.

### Proposed Approach: Convex HTTP Action + Reassembly

Use a Convex HTTP action as the upload endpoint. The client splits the blob into
chunks, uploads each with metadata, and the server reassembles them into Convex
storage once all chunks arrive.

### Flow

```
Client                              Server (Convex HTTP Action)
------                              -------------------------
1. Split blob into N chunks
   (100KB each)

2. POST /api/upload/init            → Create upload session
   { totalSize, totalChunks,        ← { sessionId }
     dailyChoreClientId, ... }

3. For each chunk:
   POST /api/upload/chunk           → Store chunk in temp storage
   { sessionId, index, blob }       ← { received: true }
   (resume from last successful
    index after reconnect)

4. POST /api/upload/complete        → Reassemble chunks into single blob
   { sessionId }                    → Store in Convex storage
                                    → Attach to daily chore
                                    → Delete temp chunks
                                    ← { storageId, success: true }
```

### Client-Side Changes

#### `src/lib/photo/chunked-upload.ts` (new file)

```typescript
const CHUNK_SIZE = 100 * 1024; // 100KB per chunk

interface UploadSession {
  sessionId: string;
  totalChunks: number;
  completedChunks: number; // persisted to IndexedDB for resume
}

export async function uploadPhotoChunked(
  blob: Blob,
  dailyChoreClientId: string,
  metadata: { capturedAt: number; capturedBy: string },
  thumbnailBlob?: Blob
): Promise<{ storageId: string }> {

  // 1. Check for existing session (resume support)
  let session = await getExistingSession(dailyChoreClientId);

  if (!session) {
    // 2. Init new session
    session = await initUploadSession(blob.size, dailyChoreClientId, metadata);
  }

  // 3. Upload chunks starting from last completed
  const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
  for (let i = session.completedChunks; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, blob.size);
    const chunk = blob.slice(start, end);

    await uploadChunk(session.sessionId, i, chunk);
    await updateSessionProgress(dailyChoreClientId, i + 1);
  }

  // 4. Finalize — server reassembles and attaches to chore
  const result = await completeUpload(session.sessionId, thumbnailBlob);

  // 5. Clean up local session tracking
  await removeSession(dailyChoreClientId);

  return result;
}
```

#### IndexedDB Schema Addition

Add a `uploadSessions` store to track chunk progress:

```typescript
// In db/schema.ts
interface UploadSession {
  dailyChoreClientId: string; // keyPath
  sessionId: string;
  totalChunks: number;
  completedChunks: number;
  createdAt: number;
}
```

#### Integration with Sync Engine

Replace `uploadPhoto()` call in `processPhotoQueue()` with `uploadPhotoChunked()`.
The retry logic stays the same — but now retries resume from the last chunk instead
of restarting the entire upload.

### Server-Side Changes

#### `src/convex/http.ts` (new or extend existing)

Three HTTP action endpoints:

```typescript
// POST /api/upload/init
// Creates a session document, returns sessionId
// Session expires after 1 hour (cleanup cron)

// POST /api/upload/chunk
// Stores chunk blob in Convex storage
// Records chunk index in session document

// POST /api/upload/complete
// Reads all chunk blobs in order
// Concatenates into single Uint8Array
// Stores final blob via ctx.storage.store()
// Attaches to daily chore (same as current attachPhotoToChore)
// Deletes chunk blobs and session document
```

#### Convex Schema Addition

```typescript
// Upload session tracking
uploadSessions: defineTable({
  totalSize: v.number(),
  totalChunks: v.number(),
  dailyChoreClientId: v.string(),
  capturedAt: v.number(),
  capturedBy: v.string(),
  chunks: v.array(v.object({
    index: v.number(),
    storageId: v.id('_storage'),
  })),
  createdAt: v.number(),
  expiresAt: v.number(),
}).index('by_expiry', ['expiresAt']),
```

#### Cleanup Cron

Add a scheduled function to delete expired sessions (chunks that were never
completed) to avoid storage leaks:

```typescript
// Run every hour, delete sessions older than 1 hour
export const cleanupExpiredSessions = internalMutation({
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('uploadSessions')
      .withIndex('by_expiry', q => q.lt('expiresAt', Date.now()))
      .collect();

    for (const session of expired) {
      for (const chunk of session.chunks) {
        await ctx.storage.delete(chunk.storageId);
      }
      await ctx.db.delete(session._id);
    }
  }
});
```

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Client chunking + resume logic | ~4 hours |
| IndexedDB session tracking | ~1 hour |
| Convex HTTP actions (3 endpoints) | ~3 hours |
| Convex schema + cleanup cron | ~1 hour |
| Integration with sync engine | ~1 hour |
| Testing on slow connections | ~2 hours |
| **Total** | **~12 hours** |

## Risks & Considerations

- **Convex HTTP action limits**: Check max request body size for chunk uploads.
  If limited, may need to use smaller chunks.
- **Chunk reassembly in memory**: Concatenating all chunks into a single blob
  server-side requires holding the full image in memory. At 500KB this is fine,
  but be aware of the limit if image sizes increase.
- **Session expiry**: Must be long enough for a user with intermittent connectivity
  to eventually complete all chunks, but short enough to not leak storage.
  1 hour is a reasonable starting point.
- **Alternative: External storage**: If Convex HTTP actions prove too limiting,
  consider Cloudflare R2 with its native multipart upload support. This adds a
  dependency but gives battle-tested resumable uploads out of the box.

## Decision Criteria

Implement this if, after deploying Options 1+2:
- Upload success rate is still below 85-90%
- Failures are predominantly network timeouts (not blob eviction or auth issues)
- Users report photos "stuck uploading" for extended periods
