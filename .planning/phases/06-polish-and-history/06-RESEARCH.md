# Phase 6: Polish and History - Research

**Researched:** 2026-02-02
**Domain:** UI/UX polish, sync status indicators, 7-day history view
**Confidence:** HIGH

## Summary

Phase 6 focuses on two primary areas: (1) enhancing sync status visibility with clear pending/synced/failed indicators, and (2) building a 7-day history view for completed chores with photos. The existing codebase has solid foundations - syncStatus enum already exists on daily chores (`pending | synced | failed`), sync engine tracks pending/failed counts, and the PhotoThumbnail component pattern can be reused for history.

**Mobile-First Priority:** The app is 80% phone use, 20% desktop. Admin may use desktop for initial master chore list entry, but daily worker use is almost entirely mobile. All UX decisions should optimize for phone-first (touch, viewport, thumb zones) while remaining usable on desktop.

For UI polish, the standard approach is leveraging Svelte 5's built-in transition system (`svelte/transition`) for smooth animations, using CSS-based skeleton loaders for perceived performance, and optimizing touch targets for field use (minimum 44x44px per accessibility standards). The history view should use Convex's indexed date queries for efficient 7-day lookups.

Key insight: This phase is primarily CSS/UX work with minimal new backend logic. The Convex schema already supports date-based queries via `by_date` index, and sync status tracking is fully implemented. Focus should be on visual polish, touch-friendly interactions, and adding a history query endpoint.

**Primary recommendation:** Use Svelte's built-in transitions for animations (no external libraries), CSS-only skeleton loaders for performance, and leverage existing sync engine state for status indicators.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte/transition | 5.x built-in | Entry/exit animations | Zero bundle cost, CSS-based (off main thread), already available |
| svelte/animate | 5.x built-in | List reordering animations | Works with transitions, uses FLIP technique |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS custom properties | Native | Skeleton shimmer, status colors | Zero runtime, theme-friendly |
| CSS `touch-action` | Native | Prevent unwanted gestures | Already used in photo view |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| svelte/transition | Motion One, GSAP | Would add bundle size for simple fade/slide animations; overkill |
| CSS skeleton | library (e.g., react-loading-skeleton) | No Svelte equivalent needed; pure CSS is simpler and faster |
| Pull-to-refresh | Framework7/egjs-axes | Complexity not needed for this use case; manual refresh button sufficient |

**Installation:**
```bash
# No new packages required - all features are built into Svelte 5 and CSS
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── routes/
│   └── (app)/
│       ├── +page.svelte           # Enhanced with better sync indicators
│       └── history/
│           └── +page.svelte       # New: 7-day history view
├── lib/
│   ├── components/
│   │   ├── SyncStatusBadge.svelte # Reusable sync status indicator
│   │   └── HistoryCard.svelte     # Daily summary card for history
│   └── styles/
│       └── skeleton.css           # Skeleton loader utilities (optional)
└── convex/
    └── dailyChores.ts             # Add getHistory query
```

### Pattern 1: Svelte Transition Directive
**What:** Use `transition:` directive for enter/exit animations on elements
**When to use:** When elements appear/disappear due to `{#if}` or `{#each}` conditionals
**Example:**
```svelte
<!-- Source: https://svelte.dev/docs/svelte/transition -->
<script>
  import { fade, slide } from 'svelte/transition';
  let visible = $state(true);
</script>

{#if visible}
  <div transition:fade={{ duration: 200 }}>
    Fades in and out smoothly
  </div>
{/if}

{#each items as item (item.id)}
  <div transition:slide={{ duration: 150 }}>
    {item.text}
  </div>
{/each}
```

### Pattern 2: CSS-Only Skeleton Loader
**What:** Animated placeholder using CSS gradients, no JavaScript
**When to use:** While loading async data (photos, history)
**Example:**
```css
/* Source: Verified CSS technique from multiple sources */
.skeleton {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Pattern 3: Sync Status Indicator with CSS Animation
**What:** Visual indicator showing pending (pulsing), synced (static), failed (alert) states
**When to use:** Next to each chore item that has local changes
**Example:**
```svelte
<script>
  type SyncStatus = 'pending' | 'synced' | 'failed';
  interface Props {
    status: SyncStatus;
  }
  const { status }: Props = $props();
</script>

<span class="sync-indicator sync-indicator--{status}" aria-label={status}>
  {#if status === 'pending'}
    <span class="sync-dot"></span>
  {:else if status === 'failed'}
    <span class="sync-alert">!</span>
  {/if}
</span>

<style>
  .sync-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
  }

  .sync-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #f59e0b;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  .sync-indicator--failed .sync-alert {
    color: #dc2626;
    font-weight: bold;
    font-size: 0.875rem;
  }

  .sync-indicator--synced {
    /* Hidden or show subtle checkmark */
    opacity: 0;
  }
</style>
```

### Pattern 4: Convex Date Range Query
**What:** Query dailyChores for a date range using index
**When to use:** History view - past 7 days
**Example:**
```typescript
// Source: https://docs.convex.dev/database/reading-data/indexes/
export const getHistory = query({
  args: { daysBack: v.optional(v.number()) },
  handler: async (ctx, { daysBack = 7 }) => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Use by_date index with filter for completed only
    const chores = await ctx.db
      .query("dailyChores")
      .withIndex("by_date", (q) => q.gte("date", startDateStr))
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    return chores;
  },
});
```

### Pattern 5: Touch-Friendly Large Targets
**What:** Minimum 44x44px touch targets with adequate spacing
**When to use:** All interactive elements on mobile
**Example:**
```css
/* Source: https://www.nngroup.com/articles/touch-target-size/ */
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
  /* Inner icon/text can be smaller */
}

/* For items in a list, use padding on the clickable area */
.chore-item button {
  min-height: 48px;
  padding: 12px 16px;
  /* Accounts for bottom nav bar on mobile */
}
```

### Anti-Patterns to Avoid
- **JavaScript-based animations for simple transitions:** Use CSS transforms, they run off main thread
- **Loading spinners everywhere:** Use skeleton loaders that match content shape instead
- **Hiding sync status until hover:** On mobile, always show status (no hover state)
- **Small tap targets:** Never use targets smaller than 44px on mobile
- **Blocking scroll during sync:** Keep UI responsive, sync in background

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting for history | Custom date parser | `toLocaleDateString()` | Locale-aware, handles timezone |
| List animations | Custom FLIP | `svelte/animate` with `animate:flip` | Svelte handles calculation |
| Status icon SVGs | Custom paths | Existing SVGs from codebase | Already have check, camera icons |
| Pull-to-refresh | Touch gesture detection | Manual refresh button | Simpler, more accessible |

**Key insight:** The codebase already has working patterns for most UI elements. Reuse PhotoThumbnail pattern, existing SVG icons, and scoped CSS approach.

## Common Pitfalls

### Pitfall 1: Animations Blocking Interaction
**What goes wrong:** Heavy animations cause jank on mid-range devices
**Why it happens:** JavaScript-based animations run on main thread
**How to avoid:** Use CSS transforms/opacity only; set `will-change` sparingly
**Warning signs:** Choppy scrolling, delayed tap response

### Pitfall 2: Sync Status Flicker
**What goes wrong:** Status rapidly toggles pending->synced causing visual noise
**Why it happens:** Optimistic updates immediately show synced, then pending when queued
**How to avoid:** Debounce status display; show pending only if still pending after 200ms
**Warning signs:** Status badge flashing on every tap

### Pitfall 3: History Query Returns Too Much Data
**What goes wrong:** Loading all 7 days of photos causes slow load and memory issues
**Why it happens:** Photo URLs are fetched eagerly for all items
**How to avoid:** Lazy load photos; only fetch URLs for visible items
**Warning signs:** Slow history page load, high memory on mobile

### Pitfall 4: Touch Target Too Small in Dense Lists
**What goes wrong:** Users accidentally tap wrong chore on mobile
**Why it happens:** List items packed tightly without sufficient padding
**How to avoid:** Enforce minimum 48px row height; add horizontal padding
**Warning signs:** Rage taps, accidental completions

### Pitfall 5: History Date Navigation Confusion
**What goes wrong:** Users don't know what day they're viewing
**Why it happens:** Date headers blend in with content
**How to avoid:** Use sticky date headers; highlight "today" and relative dates
**Warning signs:** Users asking "what day is this?"

## Code Examples

Verified patterns from official sources:

### Slide Transition for List Items
```svelte
<!-- Source: https://svelte.dev/docs/svelte/svelte-transition -->
<script>
  import { slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  let items = $state([...]);
</script>

{#each items as item (item._id)}
  <div
    transition:slide={{ duration: 150 }}
    animate:flip={{ duration: 200 }}
  >
    {item.text}
  </div>
{/each}
```

### Fade Transition for Conditional Content
```svelte
<!-- Source: https://svelte.dev/docs/svelte/svelte-transition -->
<script>
  import { fade } from 'svelte/transition';

  let showDetails = $state(false);
</script>

<button onclick={() => showDetails = !showDetails}>
  Toggle Details
</button>

{#if showDetails}
  <div transition:fade={{ duration: 200 }}>
    Additional information here
  </div>
{/if}
```

### History Card with Photo Thumbnail
```svelte
<script>
  import PhotoThumbnail from '$lib/components/PhotoThumbnail.svelte';
  import type { DailyChore } from '$lib/db/schema';

  interface Props {
    chore: DailyChore;
  }
  const { chore }: Props = $props();

  function formatTime(isoString: string | undefined): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div class="history-card">
  <div class="history-content">
    <span class="history-text">{chore.text}</span>
    <span class="history-meta">
      {chore.completedBy} at {formatTime(chore.completedAt)}
    </span>
  </div>
  {#if chore.photoStorageId}
    <PhotoThumbnail choreId={chore._id} storageId={chore.photoStorageId} />
  {/if}
</div>
```

### Native Date Selector for History Navigation
```svelte
<script>
  let selectedDate = $state(new Date().toISOString().split('T')[0]);

  // Calculate min date (7 days ago)
  const minDate = $derived(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });

  // Calculate max date (today)
  const maxDate = new Date().toISOString().split('T')[0];
</script>

<input
  type="date"
  bind:value={selectedDate}
  min={minDate}
  max={maxDate}
  class="date-picker"
/>

<style>
  .date-picker {
    font-size: 1rem;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    min-height: 44px;
  }
</style>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JS animation libraries | CSS animations + Svelte transitions | Svelte 5 (2024) | Better performance, smaller bundles |
| Spinner loading indicators | Skeleton screens | 2022+ standard | Reduced perceived load time by 20-30% |
| 44px touch targets | 48px recommended minimum | WCAG 2.2 (2023) | Better accessibility |
| hover states for status | Always-visible indicators | Mobile-first shift | Works on touch devices |

**Deprecated/outdated:**
- `svelte/motion` `tweened`/`spring` for simple UI transitions: Use CSS transitions instead; reserve motion stores for complex value interpolation
- Explicit `tabindex` on buttons: Buttons are focusable by default

## Open Questions

Things that couldn't be fully resolved:

1. **History photo loading strategy**
   - What we know: Lazy loading is best practice for lists with images
   - What's unclear: Whether to use IntersectionObserver or simpler scroll-based approach
   - Recommendation: Start with native `loading="lazy"` on img tags; add IntersectionObserver if needed

2. **Date range in history - fixed 7 days vs. scrollable**
   - What we know: Requirement says "past 7 days"
   - What's unclear: Whether user needs calendar picker or just scroll through days
   - Recommendation: Start with day-by-day scroll with sticky headers; add date picker if requested

3. **Sync retry UI location**
   - What we know: Failed syncs need retry button; syncEngine has `retryFailed()` method
   - What's unclear: Where retry button should live (header? toast? per-item?)
   - Recommendation: Add to header next to sync indicator; failed items show inline warning

## Sources

### Primary (HIGH confidence)
- [Svelte transition docs](https://svelte.dev/docs/svelte/transition) - Directive syntax, available transitions
- [Svelte svelte/transition module](https://svelte.dev/docs/svelte/svelte-transition) - All 7 transition functions
- [Convex indexes documentation](https://docs.convex.dev/database/reading-data/indexes/) - Date range queries
- [NN/g Touch Target Size](https://www.nngroup.com/articles/touch-target-size/) - 44-48px minimum

### Secondary (MEDIUM confidence)
- [SvelteKit images docs](https://svelte.dev/docs/kit/images) - Loading attribute, LCP optimization
- [Svelte compiler warnings](https://svelte.dev/docs/svelte/compiler-warnings) - Accessibility checks

### Tertiary (LOW confidence)
- Various web search results on skeleton loaders, sync indicators - Patterns verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Built-in Svelte features, verified in official docs
- Architecture: HIGH - Follows existing codebase patterns, leverages existing sync engine
- Pitfalls: MEDIUM - Based on common mobile UX issues, some specific to this app's patterns

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain, established patterns)
