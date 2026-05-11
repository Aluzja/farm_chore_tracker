# App-Load Reliability — Follow-ups

Investigation context: users reported white-screen-on-load ~30% of the time, recovered with 2–3 app restarts. The initial deep dive landed three fixes (see commit history): moved `setConvexClient`/`connectionStatus.init` to script init in the root layout, added `cleanupOutdatedCaches: true` to the Workbox config, and added a 6s boot-failure fallback UI in `app.html`.

The items below were identified during that investigation but deferred for later because they touch protected flows or change UX in non-obvious ways. Revisit when you have time.

---

## 1. Convex `setAuth()` thrash during init

**Where:** `src/routes/+layout.svelte:30`, `src/lib/auth/admin.svelte.ts:66, 100, 153`

The same `ConvexClient` has `setAuth()` called up to three times in rapid succession during boot for admin users:

1. Root layout (always) — `convexClient.setAuth(async () => localStorage.getItem(...))`
2. `adminAuth.setClient` — wraps in a promise that resolves on auth-change or a 2s timeout
3. `adminAuth.checkAuth` — calls `setAuth` again before the query

Each call can reset the Convex WebSocket auth state and re-establish the connection. Piled-up calls in the same tick can cause queries to cancel/retry unpredictably.

Compounding bug at `src/routes/(app)/+layout.svelte:192-194`:

```ts
if (convexClient) {
    adminAuth.setClient(convexClient);  // returns a Promise, NOT awaited
}
await adminAuth.checkAuth();
```

The promise inside `setClient` (with the 2s timeout race) gets left dangling.

**Recommended fix:** Configure auth once on the client (root layout already does this). Have `adminAuth` push token changes via the existing localStorage getter rather than calling `setAuth` again. Drop the second/third `setAuth` calls in `admin.svelte.ts`.

---

## 2. `dailyChoresQuery` subscribes before access is validated

**Where:** `src/routes/(app)/+layout.svelte:40-45`

```ts
let activeAccessKey = $state<string | undefined>(getStoredAccessKey() ?? undefined);

const dailyChoresQuery = browser
    ? useQuery(api.dailyChores.getOrCreateDailyList, () => ({
            date: getTodayDateString(),
            accessKey: activeAccessKey
        }))
    : null;
```

For users with a stored-but-revoked key, this fires a doomed query against Convex before `onMount` validates the key. When validation eventually succeeds with a different key (e.g., from a fresh URL), the subscription re-fires. Wasted traffic and a brief error window.

**Recommended fix:** Gate `useQuery` on a reactive `hasAccess` signal. Either:
- Don't pass `accessKey` until validation finishes (server returns nothing), or
- Wrap `useQuery` in a `$derived` that only subscribes once `hasAccess` is true.

Touches the data flow, so verify daily-list hydration still works on cold load, URL-key load, and offline-cached-key load.

---

## 3. Unguarded `localStorage` reads

**Where:** `src/lib/auth/access-key.ts:19, 25, 31-32, 38`, `src/lib/auth/admin.svelte.ts:13-14, 20, 25, 32-33`, `src/routes/(app)/+page.svelte:29, 43`

Every `localStorage.getItem`/`setItem` call is direct, no try/catch. iOS Safari in private mode (and on full storage) throws synchronously on access. A throw at script-init time = unrecoverable white screen.

**Recommended fix:** Wrap `getStoredAccessKey` and friends in try/catch returning `null` on failure. Same for `storeAccessKey`. The boot fallback UI added in this round will catch the user-visible symptom, but the underlying read should be defensive.

---

## 4. Switch `registerType` from `'prompt'` to `'autoUpdate'`

**Where:** `vite.config.ts:16` and the SW update UX in `src/lib/sync/status.svelte.ts`

Currently, when a new service worker is detected, `onNeedRefresh()` flips `connectionStatus.updateAvailable = true` and a banner prompts the user to update. Until the user accepts, they stay on the old SW + old cached assets.

This is the source of the longest-tail cache staleness — users who dismiss/ignore the prompt for days end up with badly out-of-date precaches when eviction kicks in.

**Recommended fix:** Switch to `registerType: 'autoUpdate'`, drop the `onNeedRefresh` / `notifyUpdateAvailable` / `applyUpdate` plumbing in `status.svelte.ts`, and remove any UI that surfaces `updateAvailable`. Trade-off: users no longer get an explicit prompt — the app silently reloads on the next idle moment. For a PWA used multiple times a day, this is usually the right default.

---

## 5. Duplicate `requestPersistentStorage()` call

**Where:** `src/routes/+layout.svelte:39-41` (now non-awaited) and `src/lib/sync/engine.svelte.ts:98-103`

Called once at boot and again inside `syncEngine.init()`. Harmless but redundant. Pick one location — probably the layout, since it's earlier — and drop the other.

---

## 6. No `+error.svelte`

**Where:** entire `src/routes/` tree

SvelteKit falls back to its default error page when a route throws, but the default is bare-bones and doesn't surface a "reload / clear cache" affordance. Worth adding a project-styled `+error.svelte` at the root for consistency with the boot fallback we just shipped.
