# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
kitchen_sink_farm/
├── src/                       # All source code and templates
├── static/                    # Static files (robots.txt, etc)
├── .svelte-kit/              # SvelteKit generated configuration (excluded from commits)
├── node_modules/             # Dependencies (excluded from commits)
├── .planning/                # GSD planning documents
├── .git/                      # Git repository
├── package.json              # NPM dependencies and scripts
├── svelte.config.js          # SvelteKit configuration
├── vite.config.ts            # Vite build configuration
├── tsconfig.json             # TypeScript configuration
├── eslint.config.js          # ESLint configuration
├── .prettierrc                # Prettier formatting rules
├── .prettierignore            # Files to ignore when formatting
├── .npmrc                     # NPM configuration
├── .gitignore                # Git ignore rules
└── README.md                 # Project documentation
```

## Directory Purposes

**src/:**
- Purpose: Contains all application source code, components, routes, and type definitions
- Contains: Svelte components, TypeScript files, routes, layouts, type definitions
- Key files: `app.html`, `app.d.ts`

**src/routes/:**
- Purpose: File-based routing directory for SvelteKit; each file maps to a URL route
- Contains: Svelte page components (`+page.svelte`), layout components (`+layout.svelte`)
- Key files: `+page.svelte` (home page), `+layout.svelte` (root layout)

**src/lib/:**
- Purpose: Shared library code and utilities accessible via `$lib` alias throughout the application
- Contains: TypeScript utilities, shared components, assets
- Key files: `index.ts` (barrel export), `assets/` (favicon and other shared assets)

**src/lib/assets/:**
- Purpose: Static assets used across the application
- Contains: SVG files, images, and other binary/media assets
- Key files: `favicon.svg` (site icon)

**static/:**
- Purpose: Static files served as-is without processing or bundling
- Contains: `robots.txt` and other public static files
- Key files: `robots.txt` (search engine crawling directives)

**.svelte-kit/:**
- Purpose: Auto-generated SvelteKit configuration and type definitions
- Generated: Yes (auto-generated on `npm run prepare`)
- Committed: No (excluded via `.gitignore`)

## Key File Locations

**Entry Points:**
- `src/app.html`: Base HTML template for all routes; contains meta tags and SvelteKit mount point
- `src/routes/+layout.svelte`: Root layout wrapper applied to all pages
- `src/routes/+page.svelte`: Home page (`/` route)

**Configuration:**
- `svelte.config.js`: SvelteKit framework configuration (adapter, preprocessing)
- `vite.config.ts`: Vite build tool configuration (plugins, build options)
- `tsconfig.json`: TypeScript compiler options and path aliases
- `eslint.config.js`: ESLint linting rules
- `.prettierrc`: Code formatting rules

**Type Definitions:**
- `src/app.d.ts`: Global App namespace with interfaces for Error, Locals, PageData, PageState, Platform

**Core Logic:**
- `src/lib/index.ts`: Shared utilities and exports (currently empty comment)

## Naming Conventions

**Files:**
- Route files: `+page.svelte` for pages, `+layout.svelte` for layouts (SvelteKit convention)
- Components: PascalCase in file names when used as named exports (e.g., `Button.svelte`)
- Utilities: camelCase for TypeScript files (e.g., `utils.ts`, `helpers.ts`)
- Types: camelCase in `.d.ts` files (e.g., `app.d.ts`)

**Directories:**
- kebab-case for multi-word directories (e.g., `src/lib/assets/`)
- Lowercase for standard directory names

**Imports:**
- `$lib` alias for `src/lib/` imports: `import { foo } from '$lib'`
- Relative imports for route-specific files: `import Component from './Component.svelte'`

## Where to Add New Code

**New Feature:**
- Primary code: `src/routes/[feature]/+page.svelte` or `src/routes/[feature]/+layout.svelte` (for new routes)
- Utilities: `src/lib/[feature].ts` or `src/lib/[featureName]/index.ts`
- Tests: Companion `.test.ts` or `.spec.ts` files next to source (when testing is configured)

**New Component/Module:**
- Implementation: `src/lib/components/[ComponentName].svelte` for reusable components
- Layout: `src/routes/[path]/+layout.svelte` for layout wrappers
- Server logic: `src/routes/[path]/+page.server.ts` for server-side logic (when needed)

**Utilities:**
- Shared helpers: `src/lib/utils.ts` or `src/lib/[domain]/index.ts` for organized utility modules
- Type helpers: `src/lib/types.ts` or inline in `src/app.d.ts` for global types

**Styling:**
- Component styles: Within `<style>` blocks in `.svelte` files (scoped to component)
- Global styles: Create `src/lib/styles/global.css` and import in `src/routes/+layout.svelte`
- CSS framework: Configure in `svelte.config.js` and `vite.config.ts` as needed

**Assets:**
- Favicon and shared icons: `src/lib/assets/`
- Static files (robots.txt, manifest.json): `static/`
- Images/media for specific routes: Co-locate in route directory or `src/lib/assets/[domain]/`

## Special Directories

**.svelte-kit/:**
- Purpose: Auto-generated by SvelteKit during build; contains compiled types and configuration
- Generated: Yes (run `npm run prepare` to regenerate)
- Committed: No (in `.gitignore`)

**node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes (created by `npm install` or `bun install`)
- Committed: No (in `.gitignore`)

**Static/:**
- Purpose: Files served directly without processing (public assets)
- Generated: No (hand-crafted)
- Committed: Yes (should be in git)

---

*Structure analysis: 2026-02-01*
