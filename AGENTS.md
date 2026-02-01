# Agent Instructions

## btca

When you need up-to-date information about technologies used in this project, use btca to query source repositories directly.

**Available resources**: svelte, svelteKit, vite, typescript, convex, vitePwa, idb

### Usage

```bash
btca ask -r <resource> -q "<question>"
```

Use multiple `-r` flags to query multiple resources at once:

```bash
btca ask -r svelte -r convex -q "How do I integrate Convex with Svelte stores?"
```

### Resource Notes

| Resource | Use For |
|----------|---------|
| svelte | Svelte 5 runes, reactivity, component patterns |
| svelteKit | Routing, load functions, hooks, adapters, service workers |
| vite | Build config, plugins, dev server |
| typescript | Type definitions, generics, utility types |
| convex | Queries, mutations, file storage, real-time sync |
| vitePwa | PWA manifest, service worker config, SvelteKit integration |
| idb | IndexedDB wrapper API for offline storage |
