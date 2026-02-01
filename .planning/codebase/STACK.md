# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- TypeScript 5.x - Full codebase (frontend components, configuration)
- Svelte 5.x - UI framework and components (`src/routes/*.svelte`, `src/lib/`)
- HTML/CSS - Markup and styling in Svelte components

**Secondary:**
- JavaScript - Configuration files (`svelte.config.js`, `vite.config.ts`, `eslint.config.js`)

## Runtime

**Environment:**
- Node.js (version not pinned, required by dependencies)

**Package Manager:**
- Bun (lockfile: `bun.lock` present)
- npm/yarn compatible (es module type: "module")

## Frameworks

**Core:**
- SvelteKit 2.22.0 - Full-stack framework for routing, SSR, and deployment
- Svelte 5.0.0 - Reactive UI component framework
- Vite 7.0.4 - Build tool and development server

**Build/Dev:**
- @sveltejs/vite-plugin-svelte 6.0.0 - Svelte integration with Vite
- @sveltejs/adapter-auto 6.0.0 - Automatic deployment adapter selection
- vite-plugin-devtools-json 1.0.0 - Development tools JSON generation

## Key Dependencies

**Critical:**
- @sveltejs/kit 2.22.0 - Framework metapackage with routing, SSR, and adapters
- typescript 5.0.0 - TypeScript compiler and type system
- vite 7.0.4 - Bundler and dev server

**Development Tooling:**
- @types/node 22.x - Node.js type definitions
- eslint 9.22.0 - Linter
- prettier 3.4.2 - Code formatter
- typescript-eslint 8.20.0 - TypeScript linting
- eslint-plugin-svelte 3.0.0 - Svelte component linting
- prettier-plugin-svelte 3.3.3 - Svelte formatting
- svelte-check 4.0.0 - Svelte-specific type checker

**Config/Standards:**
- @eslint/js 9.22.0 - ESLint base config
- @eslint/compat 1.2.5 - ESLint compatibility utilities
- eslint-config-prettier 10.0.1 - Prettier integration for ESLint
- globals 16.0.0 - Global variable definitions

## Configuration

**Environment:**
- No `.env` files detected at project root
- engine-strict=true configured in `.npmrc`
- Module type: ES6 modules ("type": "module")

**Build:**
- `vite.config.ts` - Vite configuration with SvelteKit and devtools plugins
- `svelte.config.js` - SvelteKit configuration with auto adapter
- `tsconfig.json` - TypeScript compiler options with strict mode enabled
  - Source maps enabled
  - ES module interop enabled
  - JSON module resolution enabled
  - Bundler module resolution

**Code Quality:**
- `.prettierrc` - Prettier config: tabs, single quotes, 100 char width, trailing comma: none
- `.prettierignore` - Files excluded from formatting
- `eslint.config.js` - ESLint flat config with TypeScript, Svelte, and Prettier support

## Package Manager

**Commands:**
```bash
npm run dev              # Start Vite dev server
npm run build            # Build production bundle
npm run preview          # Preview production build
npm run prepare          # Sync SvelteKit types and generate config
npm run check            # Type-check and validate Svelte components
npm run check:watch      # Watch mode for type checking
npm run format           # Auto-format with Prettier
npm run lint             # Check formatting and run ESLint
```

## Platform Requirements

**Development:**
- Node.js (exact version not pinned in package.json)
- npm, yarn, or bun package manager
- Supported on macOS, Linux, Windows

**Production:**
- Auto-adapter determines target (Node.js, serverless, static hosting, etc.)
- Default: adapter-auto selects based on detected environment

---

*Stack analysis: 2026-02-01*
