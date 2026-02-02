# Phase 3: Auth and Access - Research

**Researched:** 2026-02-02
**Domain:** Authentication and Access Control with Convex + SvelteKit
**Confidence:** MEDIUM

## Summary

This phase requires implementing two distinct authentication patterns: (1) admin authentication using email/password via Convex Auth, and (2) anonymous user access via URL-based access keys stored in localStorage. The challenge is that Convex Auth has **no official SvelteKit support** - it is designed for React and React Native only. However, the underlying `ConvexClient.setAuth()` API works framework-agnostically, enabling a manual integration.

The recommended approach is to use Convex Auth for admin login (leveraging its Password provider) while implementing a custom "access key" system for anonymous users. Access keys are short-lived tokens stored in localStorage that grant read/write access without requiring a full authentication flow. This pattern is simpler than Convex's Anonymous provider and avoids its security pitfalls.

**Primary recommendation:** Implement Convex Auth with Password provider for admin login, and build a separate access key system with localStorage persistence for worker access. Both systems flow through `ConvexClient.setAuth()` but use different token types.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @convex-dev/auth | Latest | Admin authentication | Official Convex auth library |
| @auth/core | 0.37.0 | Auth primitives | Required dependency for Convex Auth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jose | Latest | JWT generation/verification | For custom access key JWT tokens |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Convex Auth | Better Auth + convex-better-auth-svelte | More features but adds complexity; community package not official |
| Custom access keys | Convex Anonymous provider | Anonymous provider requires CAPTCHA to prevent abuse; more complex |
| localStorage keys | HTTP-only cookies | Cookies more secure but breaks offline-first PWA model |

**Installation:**
```bash
npm install @convex-dev/auth @auth/core@0.37.0 jose
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── convex/
│   ├── auth.config.ts       # Convex auth provider config
│   ├── auth.ts              # Convex Auth setup (signIn, signOut, etc.)
│   ├── http.ts              # HTTP router with auth routes
│   ├── schema.ts            # Schema with authTables spread
│   ├── accessKeys.ts        # Access key CRUD mutations
│   └── users.ts             # User-related queries
├── lib/
│   ├── auth/
│   │   ├── admin.svelte.ts  # Admin auth state and methods
│   │   ├── access-key.ts    # Access key validation and storage
│   │   └── guard.ts         # Route protection utilities
│   └── ...
└── routes/
    ├── admin/
    │   ├── +layout.svelte   # Protected layout (requires admin)
    │   ├── login/+page.svelte
    │   └── keys/+page.svelte # Key management UI
    └── (app)/
        ├── +layout.svelte   # Public layout (validates access key)
        └── ...
```

### Pattern 1: Admin Authentication Flow
**What:** Email/password login for admin using Convex Auth Password provider
**When to use:** Admin routes requiring full authentication
**Example:**
```typescript
// convex/auth.ts
import { convexAuth } from "@convex-dev/auth/server";
import Password from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
```

```typescript
// src/lib/auth/admin.svelte.ts
import { useConvexClient } from 'convex-svelte';
import { browser } from '$app/environment';

class AdminAuth {
  isAuthenticated = $state(false);
  isLoading = $state(true);
  userId = $state<string | null>(null);

  async signIn(email: string, password: string) {
    const client = getConvexClient();
    // Call Convex Auth signIn mutation
    const result = await client.mutation(api.auth.signIn, {
      provider: 'password',
      params: { email, password, flow: 'signIn' }
    });
    // setAuth will be called with returned token
  }

  async signOut() {
    const client = getConvexClient();
    await client.mutation(api.auth.signOut);
    this.isAuthenticated = false;
    this.userId = null;
  }
}

export const adminAuth = new AdminAuth();
```

### Pattern 2: Access Key Flow
**What:** URL-based access keys for workers without login
**When to use:** Share-able links like `/app?key=abc123`
**Example:**
```typescript
// src/lib/auth/access-key.ts
const ACCESS_KEY_STORAGE = 'kitchen_sink_access_key';

export function getStoredAccessKey(): string | null {
  if (!browser) return null;
  return localStorage.getItem(ACCESS_KEY_STORAGE);
}

export function storeAccessKey(key: string): void {
  localStorage.setItem(ACCESS_KEY_STORAGE, key);
}

export function clearAccessKey(): void {
  localStorage.removeItem(ACCESS_KEY_STORAGE);
}

export async function validateAccessKey(key: string): Promise<boolean> {
  const client = getConvexClient();
  // Validate key against Convex accessKeys table
  const result = await client.query(api.accessKeys.validate, { key });
  return result.valid;
}
```

```typescript
// convex/accessKeys.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const validate = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const accessKey = await ctx.db
      .query("accessKeys")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!accessKey) return { valid: false };
    if (accessKey.revokedAt) return { valid: false, reason: 'revoked' };
    return { valid: true, displayName: accessKey.displayName };
  },
});
```

### Pattern 3: Dual Auth Guard
**What:** Check either admin auth OR valid access key
**When to use:** Routes that allow both admin and workers
**Example:**
```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { adminAuth } from '$lib/auth/admin.svelte';
  import { getStoredAccessKey, storeAccessKey, validateAccessKey } from '$lib/auth/access-key';

  let hasAccess = $state(false);
  let isLoading = $state(true);

  onMount(async () => {
    // Check for key in URL first
    const urlKey = $page.url.searchParams.get('key');
    if (urlKey) {
      const valid = await validateAccessKey(urlKey);
      if (valid) {
        storeAccessKey(urlKey);
        hasAccess = true;
        isLoading = false;
        return;
      }
    }

    // Check stored key
    const storedKey = getStoredAccessKey();
    if (storedKey) {
      const valid = await validateAccessKey(storedKey);
      if (valid) {
        hasAccess = true;
        isLoading = false;
        return;
      }
    }

    // Check admin auth
    if (adminAuth.isAuthenticated) {
      hasAccess = true;
    }

    isLoading = false;
  });
</script>
```

### Anti-Patterns to Avoid
- **Storing secrets in URL permanently:** Extract key from URL and store in localStorage, then redirect to clean URL
- **Using Convex Anonymous provider without CAPTCHA:** Opens database to abuse
- **Mixing admin and worker contexts:** Keep admin state separate from worker access key state
- **Blocking offline access on key validation:** Cache validation result; re-validate when online

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt implementation | Convex Auth Password provider | Uses Scrypt from Lucia, handles salting properly |
| JWT generation | Manual JWT signing | jose library | Handles key management, algorithm selection, claims validation |
| Session management | Custom session tracking | Convex Auth authSessions table | Automatic expiry, device tracking, revocation |
| Password reset | Email-based reset from scratch | Convex Auth Password reset option | Handles token generation, expiry, email integration |

**Key insight:** Convex Auth, despite lacking official SvelteKit support, handles the hard parts of authentication (password hashing, session management, token generation). The SvelteKit integration is primarily about calling mutations and managing client state - work that can be done manually using `ConvexClient`.

## Common Pitfalls

### Pitfall 1: Treating Access Keys Like JWTs
**What goes wrong:** Developers try to sign access keys as JWTs and use `ConvexClient.setAuth()` with them
**Why it happens:** Convex docs suggest all auth flows through `setAuth` with JWTs
**How to avoid:** Access keys are simpler - they're just lookup tokens. Validate them in your Convex queries/mutations by passing the key as an argument, not through JWT auth
**Warning signs:** Getting "provider not recognized" errors when calling setAuth

### Pitfall 2: Blocking Offline Access
**What goes wrong:** App becomes unusable offline because every action requires access key validation
**Why it happens:** Validation queries require network connectivity
**How to avoid:** Cache validation result in localStorage with timestamp; allow operations offline; re-validate when connectivity returns
**Warning signs:** Users complain app doesn't work without internet

### Pitfall 3: Forgetting Convex Auth Environment Variables
**What goes wrong:** Auth endpoints return 500 errors
**Why it happens:** Missing SITE_URL, JWT_PRIVATE_KEY, or JWKS environment variables
**How to avoid:** Run key generation script, set all three variables in Convex dashboard before testing
**Warning signs:** "Failed to verify token" or "Missing configuration" errors

### Pitfall 4: SSR Complications with Auth State
**What goes wrong:** Hydration mismatches, auth state flickers
**Why it happens:** Server doesn't know auth state, client does
**How to avoid:** Already handled - the project uses `ssr = false` in +layout.ts
**Warning signs:** "Hydration failed" console errors, flash of unauthenticated content

### Pitfall 5: Access Key Leakage
**What goes wrong:** Access keys end up in server logs, shared URLs, browser history
**Why it happens:** Keys passed in URL query params
**How to avoid:** Immediately extract key from URL, store in localStorage, redirect to clean URL using `replaceState`
**Warning signs:** Keys visible in browser address bar after initial load

## Code Examples

Verified patterns from official sources:

### Convex Auth Setup (Manual for SvelteKit)
```typescript
// convex/auth.config.ts
// Source: https://labs.convex.dev/auth/setup/manual
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

```typescript
// convex/auth.ts
// Source: https://labs.convex.dev/auth/setup/manual
import { convexAuth } from "@convex-dev/auth/server";
import Password from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
```

```typescript
// convex/http.ts
// Source: https://labs.convex.dev/auth/setup/manual
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
```

### Schema with Auth Tables
```typescript
// convex/schema.ts
// Source: https://labs.convex.dev/auth/setup
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Access keys for URL-based worker access
  accessKeys: defineTable({
    key: v.string(),           // The shareable key (e.g., "abc123")
    displayName: v.string(),   // Human-readable name ("John's Phone")
    createdAt: v.number(),
    createdBy: v.id("users"),  // Admin who created this key
    revokedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_key", ["key"]),

  // Existing tables...
  chores: defineTable({
    // ... existing chore fields
  }),
});
```

### ConvexClient.setAuth for Admin Auth
```typescript
// src/lib/auth/admin.svelte.ts
// Source: https://docs.convex.dev/api/classes/browser.ConvexClient
import type { ConvexClient } from 'convex/browser';
import { getConvexClient } from '$lib/sync/engine.svelte';

export function setupAdminAuth() {
  const client = getConvexClient();
  if (!client) return;

  // setAuth takes a function that returns a JWT token
  client.setAuth(
    async ({ forceRefreshToken }) => {
      // Fetch token from Convex Auth session
      // This is called automatically when token expires
      const response = await fetch('/api/auth/token');
      if (!response.ok) return null;
      const { token } = await response.json();
      return token;
    },
    (isAuthenticated) => {
      // Called when auth state changes
      adminAuth.isAuthenticated = isAuthenticated;
    }
  );
}
```

### Access Key Generation
```typescript
// convex/accessKeys.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user is admin (implement based on your user schema)
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin access required");

    // Generate secure random key
    const key = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    return await ctx.db.insert("accessKeys", {
      key,
      displayName,
      createdAt: Date.now(),
      createdBy: userId,
    });
  },
});

export const revoke = mutation({
  args: { id: v.id("accessKeys") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(id, { revokedAt: Date.now() });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.query("accessKeys").collect();
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Clerk/Auth0 for all Convex auth | Convex Auth for simple cases | 2024 (beta) | No third-party dependency for basic auth |
| Svelte 4 stores for auth state | Svelte 5 $state runes | 2024 | Cleaner reactive auth state |
| SSR with auth | CSR-only (ssr=false) for PWAs | Project decision | Avoids hydration issues entirely |

**Deprecated/outdated:**
- `convex-auth` Svelte adapter: Does not exist officially; community adapter available but not production-ready
- Using Anonymous provider without CAPTCHA: Officially discouraged due to abuse potential

## Open Questions

Things that couldn't be fully resolved:

1. **Exact Convex Auth integration with SvelteKit**
   - What we know: ConvexClient.setAuth() works, auth mutations exist
   - What's unclear: Exact flow for token refresh with Convex Auth in non-React context
   - Recommendation: Test integration thoroughly; may need custom token fetch endpoint

2. **Access key offline validation caching strategy**
   - What we know: Need to cache validation to work offline
   - What's unclear: How long to cache? How to handle key revocation while offline?
   - Recommendation: Cache for 24 hours; re-validate on reconnect; accept some delay in revocation propagation

3. **Admin user identification**
   - What we know: Need to distinguish admin from worker
   - What's unclear: Store in users table? Hardcode first user? Separate admins table?
   - Recommendation: Add `isAdmin` boolean to users table; first user is admin by default

## Sources

### Primary (HIGH confidence)
- [Convex Auth Documentation](https://labs.convex.dev/auth) - Setup, Password provider, configuration
- [Convex Auth Manual Setup](https://labs.convex.dev/auth/setup/manual) - Environment variables, file structure
- [ConvexClient API](https://docs.convex.dev/api/classes/browser.ConvexClient) - setAuth method signature
- [Custom JWT Provider](https://docs.convex.dev/auth/advanced/custom-jwt) - JWT requirements

### Secondary (MEDIUM confidence)
- [convex-svelte GitHub](https://github.com/get-convex/convex-svelte) - useConvexClient returns ConvexClient
- [Authorization Best Practices](https://stack.convex.dev/authorization) - Row-level security patterns

### Tertiary (LOW confidence)
- [convex-auth Svelte Issue #89](https://github.com/get-convex/convex-auth/issues/89) - Community discussion on SvelteKit support
- [convex-better-auth-svelte](https://www.npmjs.com/package/@mmailaender/convex-better-auth-svelte) - Third-party solution (not verified in production)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Convex Auth works but SvelteKit integration is manual
- Architecture: MEDIUM - Patterns derived from React docs, adapted for Svelte
- Pitfalls: HIGH - Well-documented in Convex Auth docs and community discussions

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - Convex Auth is in beta, may change)
