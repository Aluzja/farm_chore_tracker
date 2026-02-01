# Phase 1: Foundation - Research

**Researched:** 2026-02-01
**Domain:** PWA + Real-time Database (SvelteKit, vite-plugin-pwa, Convex)
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundation for a PWA-enabled SvelteKit application with real-time data synchronization via Convex. The research identifies three core integration points: PWA manifest and service worker via @vite-pwa/sveltekit, real-time database connectivity via convex-svelte, and the critical service worker configuration that allows Convex WebSocket traffic to bypass caching.

The standard approach uses @vite-pwa/sveltekit for zero-config PWA support with SvelteKit 2, combined with convex-svelte for declarative real-time subscriptions. The key insight is that WebSocket connections (used by Convex) are NOT intercepted by service workers by design - they only handle HTTP/HTTPS fetch requests. However, HTTP API calls to Convex endpoints should be excluded from caching using `navigateFallowDenylist` to prevent stale data issues.

**Primary recommendation:** Use @vite-pwa/sveltekit with generateSW strategy, configure workbox to exclude `convex.cloud` and `convex.site` domains from caching, and initialize Convex client-side only using SvelteKit's `onMount` or `browser` guard.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @vite-pwa/sveltekit | ^0.6.7+ | PWA manifest, service worker generation | Official vite-pwa integration for SvelteKit 2, zero-config with customization |
| convex | latest | Backend-as-a-service with real-time sync | Official Convex client library |
| convex-svelte | ^0.0.12 | Svelte 5 reactive subscriptions | Official Convex integration for Svelte with declarative hooks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workbox | (bundled) | Service worker runtime | Automatically included via vite-pwa |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @vite-pwa/sveltekit | SvelteKit native service worker | Native requires manual manifest management, more control but more work |
| convex-svelte | Raw ConvexClient | No reactive hooks, requires manual subscription management |

**Installation:**
```bash
# PWA support
npm install -D @vite-pwa/sveltekit

# Convex real-time database
npm install convex convex-svelte
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── convex/                 # Convex functions (queries, mutations, actions)
│   ├── _generated/         # Auto-generated types and API references
│   └── tasks.ts            # Example: database queries/mutations
├── lib/
│   └── convex.ts           # Optional: Convex client utilities
├── routes/
│   └── +layout.svelte      # Initialize Convex client here
├── app.html                # Add PWA meta tags
└── service-worker.js       # Optional: custom service worker (not needed with generateSW)
static/
├── pwa-192x192.png        # Required PWA icon
├── pwa-512x512.png        # Required PWA icon
├── apple-touch-icon.png   # iOS icon (180x180)
└── favicon.ico            # Favicon
```

### Pattern 1: Client-Only Convex Initialization
**What:** Initialize Convex in root layout, client-side only
**When to use:** Always - Convex uses browser-only APIs (WebSocket)
**Example:**
```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { setupConvex } from 'convex-svelte';
  import { PUBLIC_CONVEX_URL } from '$env/static/public';
  import { browser } from '$app/environment';

  // Only initialize on client side
  if (browser) {
    setupConvex(PUBLIC_CONVEX_URL);
  }
</script>

<slot />
```
Source: https://docs.convex.dev/client/svelte

### Pattern 2: PWA Virtual Module Import (SSR-Safe)
**What:** Dynamic import of PWA registration for SSR compatibility
**When to use:** When registering service worker in layout
**Example:**
```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { pwaInfo } from 'virtual:pwa-info';

  let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

  onMount(async () => {
    if (pwaInfo) {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({
        immediate: true,
        onRegistered(r) {
          console.log('SW Registered:', r);
        },
        onRegisterError(error) {
          console.log('SW registration error', error);
        }
      });
    }
  });
</script>

<svelte:head>
  {@html webManifestLink}
</svelte:head>
```
Source: https://vite-pwa-org.netlify.app/frameworks/sveltekit

### Pattern 3: useQuery with Loading States
**What:** Subscribe to Convex queries with reactive state
**When to use:** Any component needing real-time data
**Example:**
```svelte
<script lang="ts">
  import { useQuery } from 'convex-svelte';
  import { api } from '../convex/_generated/api';

  const tasks = useQuery(api.tasks.list, {});
</script>

{#if tasks.isLoading}
  <p>Loading...</p>
{:else if tasks.error}
  <p>Error: {tasks.error.message}</p>
{:else}
  {#each tasks.data ?? [] as task}
    <div>{task.name}</div>
  {/each}
{/if}
```
Source: https://github.com/get-convex/convex-svelte

### Anti-Patterns to Avoid
- **Initializing Convex during SSR:** Will fail - Convex requires browser WebSocket APIs
- **Caching Convex API responses:** Defeats real-time sync - always exclude from SW cache
- **Using $service-worker module with vite-pwa:** Conflicts - use vite-pwa's workbox instead

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PWA manifest generation | Manual manifest.json | @vite-pwa/sveltekit manifest config | Auto-injection, type-safe, includes icons |
| Service worker caching | Custom fetch handlers | Workbox via vite-pwa | Battle-tested cache strategies, precache manifest |
| Real-time subscriptions | Manual WebSocket code | convex-svelte useQuery | Handles reconnection, state management, typing |
| Icon generation | Manual resize each size | pwa-asset-generator or Favicon.io | Generates all required sizes correctly |

**Key insight:** Service workers require careful handling of cache invalidation, offline fallbacks, and update prompts. Workbox handles all edge cases that take weeks to debug manually.

## Common Pitfalls

### Pitfall 1: Convex Traffic Cached by Service Worker
**What goes wrong:** HTTP API calls to Convex get cached, returning stale data
**Why it happens:** Default workbox patterns cache all fetch requests
**How to avoid:** Add `convex.cloud` and `convex.site` to navigateFallbackDenylist and exclude from runtimeCaching
**Warning signs:** Data doesn't update after mutations, works after clearing cache

### Pitfall 2: SSR Errors with Convex/PWA Virtual Modules
**What goes wrong:** Build fails or 500 errors on server render
**Why it happens:** Convex and PWA virtual modules use browser-only APIs
**How to avoid:** Always use `browser` check or `onMount` for initialization
**Warning signs:** "window is not defined", "document is not defined" errors

### Pitfall 3: iOS PWA Missing apple-touch-icon
**What goes wrong:** App doesn't show correct icon on iOS home screen
**Why it happens:** iOS ignores manifest icons, requires apple-touch-icon meta tag
**How to avoid:** Add `<link rel="apple-touch-icon">` in app.html AND provide 180x180 PNG
**Warning signs:** Generic icon or first letter shown on iOS home screen

### Pitfall 4: Service Worker Not Updating
**What goes wrong:** Users see old version of app after deployment
**Why it happens:** SW caches aggressively, no prompt for updates
**How to avoid:** Configure `registerType: 'prompt'` or implement update notification
**Warning signs:** Bug fixes not appearing for users until cache clear

### Pitfall 5: Convex functionsDir Outside src/
**What goes wrong:** SvelteKit build fails with "cannot access files outside src"
**Why it happens:** Default Convex puts functions in root `/convex/` folder
**How to avoid:** Configure `convex.json` with `"functions": "src/convex/"`
**Warning signs:** Build error mentioning module resolution outside allowed directories

## Code Examples

Verified patterns from official sources:

### Complete vite.config.ts with PWA and Convex-Safe Configuration
```typescript
// Source: https://vite-pwa-org.netlify.app/frameworks/sveltekit
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      manifest: {
        name: 'Kitchen Sink Farm',
        short_name: 'KSF',
        description: 'Farm management application',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
        // CRITICAL: Exclude Convex domains from service worker interception
        navigateFallbackDenylist: [
          /^\/api\//,  // Local API routes if any
        ],
        runtimeCaching: [
          {
            // Exclude Convex cloud endpoints from caching
            urlPattern: /^https:\/\/.*\.convex\.cloud\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            // Exclude Convex site endpoints from caching
            urlPattern: /^https:\/\/.*\.convex\.site\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: '/'
      }
    })
  ]
});
```

### convex.json Configuration for SvelteKit
```json
{
  "functions": "src/convex/"
}
```
Source: https://docs.convex.dev/quickstart/svelte

### app.html with PWA Meta Tags
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="description" content="Farm management application" />

    <!-- iOS PWA Support -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="KSF" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />

    <!-- Favicon -->
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```
Source: https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements

### Environment Variables (.env)
```bash
# Convex deployment URL (public, safe for client)
PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SvelteKit native SW + manual manifest | @vite-pwa/sveltekit | 2023+ | Zero-config PWA with full workbox power |
| Svelte stores for Convex | convex-svelte with Svelte 5 runes | 2024 | Native reactive queries with $derived compatibility |
| Manual icon generation | vite-pwa assets generator | v0.4.0 | Auto-generates all icon sizes |

**Deprecated/outdated:**
- Using `<svelte:component>` for dynamic imports (use Svelte 5 snippets)
- SvelteKit stores ($page, etc.) prefer $app/state runes in Svelte 5

## Open Questions

Things that couldn't be fully resolved:

1. **Exact convex-svelte version compatibility with Svelte 5**
   - What we know: Package says "Svelte 5" compatible, version 0.0.12
   - What's unclear: Specific Svelte 5 runes syntax support depth
   - Recommendation: Test during implementation, fallback to stores if issues

2. **iOS Safari PWA install prompt behavior**
   - What we know: iOS doesn't show automatic install prompt
   - What's unclear: Best UX pattern for guiding iOS users to "Add to Home Screen"
   - Recommendation: Add manual instructions UI, detect iOS via user agent

## Sources

### Primary (HIGH confidence)
- [Svelte Documentation - Service Workers](https://svelte.dev/docs/kit/service-workers) - SvelteKit native SW support
- [Vite PWA - SvelteKit Integration](https://vite-pwa-org.netlify.app/frameworks/sveltekit) - Complete PWA configuration
- [Convex Svelte Quickstart](https://docs.convex.dev/quickstart/svelte) - Official setup guide
- [Convex Svelte Client Docs](https://docs.convex.dev/client/svelte) - API reference

### Secondary (MEDIUM confidence)
- [GitHub: vite-pwa/sveltekit](https://github.com/vite-pwa/sveltekit) - Example configurations
- [GitHub: get-convex/convex-svelte](https://github.com/get-convex/convex-svelte) - Svelte integration source
- [Vite PWA - Workbox generateSW](https://vite-pwa-org.netlify.app/workbox/generate-sw) - Workbox configuration

### Tertiary (LOW confidence)
- WebSearch results for iOS PWA patterns - verify with testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official packages with documented SvelteKit 2 support
- Architecture: HIGH - Patterns from official documentation
- Pitfalls: MEDIUM - Combination of official docs and community experience

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable ecosystem)
