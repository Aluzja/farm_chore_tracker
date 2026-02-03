# Kitchen Sink Farm - Development Guidelines

## Styling

**DO NOT use Tailwind CSS** unless:
1. It already exists in the project (check package.json)
2. User explicitly asks to add it

Use plain CSS with Svelte's scoped `<style>` blocks instead. This project does NOT have Tailwind installed.

**TODO:** The auth pages currently have non-functional Tailwind classes that need to be replaced with proper CSS.

## SvelteKit Navigation Pattern

**Always use `resolve()` from `$app/paths` for navigation** (available since SvelteKit 2.26):

```svelte
<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
</script>

<!-- For <a> tags -->
<a href={resolve('/admin/keys')}>Admin Keys</a>

<!-- For programmatic navigation -->
<button onclick={() => goto(resolve('/settings'))}>Settings</button>

<!-- For full page reloads -->
window.location.href = resolve('/admin/keys');
```

**Why:**
- Correctly handles base paths when app is deployed to a subdirectory
- During SSR, base path is relative and depends on the page being rendered
- Replaces deprecated `base` variable pattern

**Route ID with parameters:**
```ts
const url = resolve('/blog/[slug]', { slug: 'hello-world' });
// Results in: /blog/hello-world (with base path if configured)
```

## Async Image Loading Pattern

**Use `{#await}` with image preloading** instead of manual `$state` tracking for loading states:

```svelte
<script lang="ts">
  // Preload image and return promise that resolves when loaded
  function preloadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  // Derived promise reacts to URL changes automatically
  const imagePromise = $derived(photoUrl ? preloadImage(photoUrl) : null);
</script>

{#if imagePromise}
  {#await imagePromise}
    <span class="loading-spinner"></span>
  {:then url}
    <img src={url} alt="Description" />
  {:catch}
    <span class="error-placeholder">Failed to load</span>
  {/await}
{/if}
```

**Why:**
- Svelte's `{#await}` handles pending/fulfilled/rejected states declaratively
- `$derived` creates new promise when URL changes, triggering loading state automatically
- No manual state tracking (`let loaded = $state(false)`) or `$effect` resets needed
- Prevents flash of old content when URL changes (e.g., replacing an image)

## Reusable Components

**Create reusable components instead of duplicating code.** When the same UI pattern appears in multiple places, extract it into a component in `src/lib/components/`.

Example: `AdminNav.svelte` provides consistent admin navigation across all admin pages and the main app (for admin users). Changes to navigation links only need to be made in one place.

```svelte
<!-- Usage in any page -->
<script>
  import AdminNav from '$lib/components/AdminNav.svelte';
</script>

<AdminNav />
```

**Guidelines:**
- Place shared components in `src/lib/components/`
- Components should be self-contained with their own styles
- Use `$props()` for configuration when needed
- If you find yourself copying styles or markup between files, consider extracting a component

## Tech Stack

- SvelteKit 2.x with Svelte 5 (runes: $state, $derived, $effect, $props)
- Convex backend with @convex-dev/auth for authentication
- convex-svelte for Svelte integration
- PWA with service worker (workbox)
