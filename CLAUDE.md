# Kitchen Sink Farm - Development Guidelines

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

## Tech Stack

- SvelteKit 2.x with Svelte 5 (runes: $state, $derived, $effect, $props)
- Convex backend with @convex-dev/auth for authentication
- convex-svelte for Svelte integration
- TailwindCSS for styling
- PWA with service worker (workbox)
