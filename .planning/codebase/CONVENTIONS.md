# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `+page.svelte`, `+layout.svelte`)
- Library files: camelCase (e.g., `index.ts`)
- Assets: kebab-case (e.g., `favicon.svg`)
- Configuration files: kebab-case with dots (e.g., `svelte.config.js`, `tsconfig.json`, `eslint.config.js`)

**Functions:**
- Event handlers: camelCase with $ prefix in Svelte context (e.g., `let { children } = $props()`)
- Import statements use destructuring with explicit names

**Variables:**
- Component props: camelCase with `$props()` rune in Svelte 5
- Standard variables: camelCase

**Types:**
- Global type declarations in `src/app.d.ts` as namespace declarations
- Interface definitions in global App namespace

## Code Style

**Formatting:**
- Tool: Prettier 3.4.2
- Key settings from `.prettierrc`:
  - Use tabs (not spaces): `"useTabs": true`
  - Single quotes: `"singleQuote": true`
  - Trailing comma: `"trailingComma": "none"`
  - Print width: 100 characters
  - Svelte support: `"prettier-plugin-svelte"` enabled

**Linting:**
- Tool: ESLint 9.22.0 (flat config format)
- Configuration: `eslint.config.js`
- Extends: `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, Prettier rules
- Global variables: Both browser and Node.js globals enabled
- Key rule: `no-undef` disabled (TypeScript handles undefined checking)

## Import Organization

**Order:**
1. Framework/library imports (e.g., Svelte components, Node.js modules)
2. Project imports using path aliases (e.g., `$lib/assets/favicon.svg`)
3. Local component/file imports

**Path Aliases:**
- `$lib` - Maps to `src/lib` directory (for shared utilities, assets, components)
- Configured via SvelteKit's built-in alias system (not in tsconfig)
- Assets imported via `$lib` path: e.g., `import favicon from '$lib/assets/favicon.svg'`

## Error Handling

**Patterns:**
- Type-safe error handling through TypeScript strict mode (`"strict": true`)
- Global App namespace for typed errors (currently commented out but available):
  ```typescript
  // interface Error {}  // Available in App namespace
  ```

## Logging

**Framework:** Browser console (implicit in this frontend framework)

**Patterns:**
- No explicit logging framework configured
- Standard browser console available for debugging
- No production logging setup detected

## Comments

**When to Comment:**
- Documentation comments linking to external resources (e.g., Svelte docs)
- No JSDoc/TSDoc patterns enforced, but TypeScript strict mode encourages explicit types

**JSDoc/TSDoc:**
- Not actively used in this codebase
- TypeScript type system is primary documentation method

## Function Design

**Size:** No explicit size constraints configured

**Parameters:**
- Svelte rune pattern: `let { children } = $props()` for props destructuring
- Explicit prop typing encouraged through TypeScript

**Return Values:**
- Svelte snippets use `{@render children?.()}` pattern for component composition

## Module Design

**Exports:**
- Library barrel file: `src/lib/index.ts` (currently empty, serves as export aggregation point)
- Component exports: Through SvelteKit file-based routing (+page.svelte, +layout.svelte)

**Barrel Files:**
- `src/lib/index.ts` exists as conventional barrel file for library exports
- Not currently utilized but follows SvelteKit best practices

---

*Convention analysis: 2026-02-01*
