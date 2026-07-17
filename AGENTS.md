<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in
`node_modules/next/dist/docs/`. Your training data is outdated — the docs are
the source of truth.

<!-- END:nextjs-agent-rules -->

# Agent Context

This file defines the rules, structure, and development guidelines for the AI
assistant in this project. The goal is to build **MTG Life Counter App** — a
Progressive Web Application for Magic: The Gathering players, featuring life
total tracking and an AI-powered Judge to resolve rules questions. Built with
**Next.js 16**, **React 19**, **TypeScript 5**, and **Tailwind CSS 4**.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 (Server Components by default)
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS 4 (utility-first, CSS-first config)
- **AI:** OpenRouter SDK (`@openrouter/sdk`) for the AI Judge
- **Package Manager:** pnpm
- **Linting:** ESLint (eslint-config-next)
- **Testing:** Playwright

### Next.js Configuration (`next.config.ts`)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig;
```

---

## Project Structure

The agent must strictly respect the following file architecture:

```bash
├── app/                    # Next.js App Router (RSC by default)
│   ├── api/                # API route handlers
│   │   └── judge/          # AI Judge streaming endpoint
│   ├── layout.tsx          # Root layout — metadata, fonts, global shell
│   ├── page.tsx            # Home page (life counter UI)
│   └── globals.css         # Tailwind imports + global design tokens
├── components/             # Shared React components
│   ├── ui/                 # Primitive UI components
│   │   ├── button.tsx      # Variants: primary, icon, pill
│   │   └── dialog.tsx      # Modal wrapper (native <dialog>)
│   └── features/           # Feature-specific composed components
│       ├── game-board.tsx       # Layout grid orchestrator (2-6 players)
│       ├── player-zone.tsx      # Single player's life/controls/swipe zone
│       ├── spellbook-menu.tsx   # Central floating button + half-screen menu
│       ├── life-display.tsx     # Life total number (Archivo Black, massive)
│       ├── life-buttons.tsx     # +/- controls with hold acceleration
│       ├── commander-damage.tsx # Swipe overlay for commander damage tracking
│       ├── counters-overlay.tsx # Swipe overlay for poison/energy/etc.
│       ├── color-picker.tsx     # Mana color/guild selector modal
│       ├── initial-life-modal.tsx
│       ├── player-selector-modal.tsx
│       ├── judge-chat.tsx       # AI Judge chat interface
│       └── dice-roller.tsx      # D6/D20/D10 roller (Phase 2 per DESIGN.md §10)
├── lib/                    # Pure TypeScript utilities
│   ├── ai/                 # AI Judge — prompts, RAG, citations, history
│   │   └── rag/            # MTG rules embedding & retrieval pipeline
│   ├── services/           # External API clients (Scryfall)
│   ├── state/              # Game state machine (discriminated union)
│   ├── utils.ts            # Shared helper functions
│   └── types.ts            # Shared TypeScript interfaces & types
├── hooks/                  # Custom React hooks
│   ├── use-life-adjustment.ts  # Tap/hold acceleration logic
│   ├── use-swipe.ts            # Swipe gesture detection
│   └── use-game-state.ts       # State machine hook
├── public/                 # Static assets (served as-is)
│   ├── favicon/            # Favicon bundle files
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   └── robots.txt          # Search engine crawl directives
├── tests/                  # Playwright Test Suite
│   ├── e2e/                # End-to-End user flow tests
│   └── components/         # Component isolation tests
├── DESIGN.md               # Project Design Contract
├── DESIGN.md.template      # Design Thinking template (DO NOT EDIT)
├── playwright.config.ts    # Testing framework configuration
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── postcss.config.mjs      # PostCSS/Tailwind configuration
└── package.json            # Project dependencies and scripts
```

---

## Development Rules and Guidelines

### 1. React & Next.js Components (`app/` and `components/`)

- **Server Components by default.** Every component in `app/` is a React Server
  Component unless explicitly marked with `'use client'`. Keep data fetching
  and heavy logic in server components.
- **Client boundary discipline.** Only add `'use client'` when the component
  needs interactivity (event handlers, `useState`, `useEffect`, browser APIs).
  Push the boundary as deep as possible.
- **Strictly forbidden in Client Components:** `async` functions, server-only
  imports (`fs`, `crypto` without browser API), direct database access.
- **Route conventions:** Follow Next.js App Router file conventions:
  `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- **Metadata:** Export `metadata` or `generateMetadata` from `layout.tsx` and
  `page.tsx`. Never leave `title: "Create Next App"` placeholders.
- **Images:** Always use `next/image` over native `<img>`. Provide explicit
  `width`/`height` and meaningful `alt` text.
- **Fonts:** Use `next/font` — `localFont` for local files, `next/font/google`
  for fonts available there (Next.js downloads and self-hosts at build time — no
  runtime CDN). Reference the CSS variable in Tailwind's `@theme`. No
  Inter/Roboto/Arial/system-ui.
- **Composition patterns (per `composition-patterns`):** Avoid boolean prop
  proliferation, use compound components, lift state into providers. React 19:
  no `forwardRef`, use `use()` over `useContext()`.
- **Performance (per `react-best-practices`):** Eliminate data waterfalls with
  `Promise.all`, wrap heavy sections in Suspense boundaries, use `next/dynamic`
  for lazy-loaded components.

### 2. Styling with Tailwind CSS (`app/globals.css`)

- **Utility-first.** Style components with Tailwind utility classes directly in
  JSX `className`. No separate CSS files per component unless for complex
  keyframe animations or third-party overrides.
- **Design tokens** live in `globals.css` via `@theme` directive or CSS custom
  properties. Every color, spacing, and typography value must reference these
  tokens. See DESIGN.md §2 for the complete `@theme` token specification.
- **`@apply` is forbidden** for component styles. Only permitted in
  `globals.css` for base layer resets.
- **Responsive:** Mobile-first breakpoints (`sm:`, `md:`, `lg:`).
- **Anti-generic aesthetics:** All aesthetic decisions must follow DESIGN.md.
  Bold, intentional design direction — no Inter, Roboto, or system-ui font
  stacks. No purple gradients on white.
- **Motion:** Prefer Tailwind's `animate-*` utilities and CSS keyframes.

### DESIGN.md as Authoritative Source

When DESIGN.md specifies an aesthetic decision that conflicts with a generic
skill rule (e.g., `frontend-design`'s "avoid symmetry" vs DESIGN.md's
grid-based layout), **DESIGN.md wins.** All agents must read DESIGN.md before
implementing any UI, and `@code-review` must verify against DESIGN.md's
specific constraints, not generic rules.

### 3. TypeScript

- **Strict mode mandatory** (`"strict": true`). No compile errors.
- **No `any`** without a comment justifying why. Use `unknown` and type
  narrowing instead.
- **Explicit interfaces** for exported functions, component props, and API
  boundaries.
- **Per `typescript-advanced-types`:** Discriminated unions for state machines,
  generics for reusable utilities, `satisfies` for config objects.
- **No barrel imports** (per `bundle-barrel-imports`). Import directly from
  module files.

### 4. Asset Management

- **`public/`**: Assets served as-is — favicon, robots.txt, manifest.json,
  service worker, PWA icons.
- **Fonts:** Via `next/font` — `localFont` for local files, `next/font/google`
  for fonts available there (Next.js downloads and self-hosts at build time).
  Reference the CSS variable in `app/layout.tsx`.
- **Images:** Processed by `next/image`. Always provide `width`, `height`,
  and `alt`.
- **PWA assets:** `manifest.json`, `sw.js`, app icons in `public/`.

### 5. Accessibility

- **Per `accessibility` skill:** WCAG 2.2 Level AA mandatory.
- Semantic JSX elements — never `<div>` + ARIA role as substitute.
- All interactive elements keyboard-navigable with visible focus states.
- Forms with proper `<label>` associations and error messaging.
- Color contrast: 4.5:1 for text, 3:1 for large text.

### 6. SEO

- **Per `seo` skill:** Export `metadata` from every `page.tsx` and
  `layout.tsx`. Titles <60 characters. Descriptions 150–160 characters.
- JSON-LD structured data. `sitemap.xml` listing all routes.
- All images have descriptive `alt` text.

### 7. API Routes & AI Integration

- **API routes** live in `app/api/`. Route handlers follow Next.js conventions
  (`route.ts` with named exports for HTTP methods).
- **AI Judge** (`app/api/judge/route.ts`) uses `@openrouter/sdk` exclusively.
  ZDR enabled. Streaming via async iterator. `OPENROUTER_API_KEY` server-only.
- **Scryfall integration** (`lib/services/scryfall.ts`) for card art search
  and autocomplete. Server-side caching. Rate limit awareness.
- **No user accounts or auth.** The app is session-only. No `/api/profiles`,
  no database, no authentication layer.
- **Game state** (`lib/state/`) is session-local. Discriminated union state
  machine. Undo/redo stack. Life totals, poison counters, commander damage.
- **AI Judge UI** (`components/features/judge-chat.tsx`): `'use client'`
  chat interface with streaming response display, message bubbles, and text
  input. Maximized modal for readability per DESIGN.md §6.4.
- **State boundaries:** Judge chat is ephemeral (session state only). Game
  state in `lib/state/` is session-local. No persistence.
- **Voice assistant:** Phase 2 per DESIGN.md §10. Uses Web Speech API.
- **PWA:** `manifest.json` sets `"orientation": "portrait"`. Service worker
  caches static assets.

### 8. Performance Budgets

| Metric                       | Budget                    |
| ---------------------------- | ------------------------- |
| **Total JS (gzipped)**       | < 100 KB                  |
| **Total CSS (gzipped)**      | < 20 KB (Tailwind purged) |
| **LCP**                      | < 2.5s                    |
| **INP**                      | < 200ms                   |
| **CLS**                      | < 0.1                     |
| **Lighthouse Performance**   | ≥ 90                      |
| **Lighthouse Accessibility** | 100                       |

---

## Workflow Structure: Git Flow

To ensure project stability, all agents must strictly adhere to the Git Flow
branching model. Making direct commits to the main stability branches is
**strictly prohibited**.

### Main Branches

- **`main` (Production):** Only receives merges from `release/*` or
  `hotfix/*` branches.
- **`develop` (Integration):** The daily workspace. All completed features are
  consolidated here.

### Temporary and Working Branches

1. **`feature/`:** Origin: `develop`. Merge to: `develop`.
2. **`release/`:** Origin: `develop`. Merge to: `main` and `develop`.
3. **`hotfix/`:** Origin: `main`. Merge to: `main` and `develop`.

### Agent Protocol & Branch Permissions

1. **Workspace Sync:** `git fetch origin` before any task.
2. **@frontend-dev Exclusivity:**
   - Solely responsible for writing feature code inside `feature/*` and
     `hotfix/*` branches.
   - Checks out `develop`, pulls latest, spawns `feature/name`.
   - After committing: `git push -u origin feature/name`.
   - Forbidden from touching `main` or `develop`.
3. **@ai-engineer Responsibilities:**
   - Owns OpenRouter SDK integration, MTG rules RAG, prompt engineering,
     `/api/judge` streaming route, and citation formatting.
   - Uses `@openrouter/sdk` exclusively — ZDR enabled, provider routing,
     built-in streaming.
   - Works on the shared `feature/*` branch created by `@frontend-dev`.
     Does NOT create its own branch.
   - Invoked after `@frontend-dev` completes the UI shell.
   - Forbidden from touching React components or styling. Domain:
     `app/api/`, `lib/services/`, `lib/ai/`.
4. **@release-manager Authority:**
   - Only entity authorized to modify branch state on GitHub (PRs, merges,
     tags, branch deletion).
   - All operations mirrored to GitHub immediately.
   - All merges via Pull Requests — no direct merges to `main`/`develop`.
   - Hybrid approach: `gh` CLI primary, `curl` + REST API fallback.
   - Token: `.opencode/secrets/github-token` → git credential → `GITHUB_TOKEN`.
   - Never delete `main` or `develop`.
5. **@orchestrator Integration Powers:**
   - Only entity authorized to initiate merges or releases.
   - Only instructs merge when `@code-review` returns `STATUS: APPROVED` and
     QA pipeline passes.
   - Must get explicit user confirmation before creating `release/*` or
     merging to `main`.

### Agent Responsibility Matrix

| Agent                        | Responsible For                                 | Must Read       |
| ---------------------------- | ----------------------------------------------- | --------------- |
| `@orchestrator`              | Planning, delegation, gates, DESIGN.md          | AGENTS.md       |
| `@frontend-dev`              | React components, Tailwind styling, game layout | DESIGN.md §1–9  |
| `@ai-engineer`               | AI Judge route, OpenRouter SDK, RAG pipeline    | DESIGN.md §6.4  |
| `@code-review`               | Compliance audit against DESIGN.md              | DESIGN.md       |
| `@playwright-test-planner`   | Test scenarios from component tree              | DESIGN.md §4–9  |
| `@playwright-test-generator` | Test code                                       | DESIGN.md §4–9  |
| `@playwright-test-healer`    | Test execution                                  | DESIGN.md §4–9  |
| `@release-manager`           | Git ops, PRs, tags                              | —               |

---

## Mandatory Skills (Skills Compliance)

The agent is prohibited from generating code based on general assumptions. It
must strictly comply with the rules defined in the installed skill files:

- **Next.js Best Practices (`next-best-practices`):** File conventions, RSC
  boundaries, async patterns, route handlers, metadata, image/font optimization,
  hydration errors, Suspense boundaries, bundling.
- **React Best Practices (`react-best-practices`):** 70 performance rules —
  eliminating waterfalls, bundle size, server-side perf, client-side data
  fetching, re-render optimization, rendering, JS performance, advanced
  patterns.
- **Composition Patterns (`composition-patterns`):** Avoid boolean prop
  proliferation, compound components, lift state, explicit variants, children
  over render props. React 19: no `forwardRef`, `use()` over `useContext()`.
- **Next.js Cache Components (`next-cache-components`):** PPR, `use cache`
  directive, `cacheLife`, `cacheTag`, `updateTag` for Next.js 16+.
- **Frontend Design (`frontend-design`):** BOLD, anti-generic aesthetics.
  Distinctive typography, asymmetric layouts, creative color palettes,
  high-impact motion. No Inter/Roboto/Arial. No purple gradients on white.
- **Tailwind CSS Patterns (`tailwind-css-patterns`):** Utility-first v4.1+
  patterns — responsive design, dark mode, component composition, performance.
- **TypeScript Advanced Types (`typescript-advanced-types`):** Generics,
  conditional types, mapped types, template literal types, discriminated
  unions, type guards, assertion functions.
- **Accessibility (`accessibility`):** WCAG 2.2 Level AA — POUR principles,
  semantic JSX, keyboard navigation, ARIA, color contrast, form validation.
- **SEO Optimization (`seo`):** Technical crawling, metadata, JSON-LD, sitemap,
  content optimization, tap targets.
- **Playwright Best Practices (`playwright-best-practices`):** Execution
  constraints, selector reliability, trace review, Page Object Model, testing
  isolation.
- **Context7 MCP (`context7-mcp`):** Primary tool for OpenRouter SDK docs, LLM
  model catalogs, and embedding model references. Used by `@ai-engineer` and
  all agents.

---

## Mandatory Knowledge Update

Use Context7 MCP to fetch current documentation whenever the user asks about a
library, framework, SDK, API, CLI tool, or cloud service — even well-known ones
like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This
includes API syntax, configuration, version migration, library-specific
debugging, setup instructions, and CLI tool usage. Use even when you think you
know the answer — your training data may not reflect recent changes.

## Steps

1. Always start with `resolve-library-id` using the library name and the user's
   question, unless the user provides an exact library ID
2. Pick the best match (ID format: `/org/project`) by name match, description
   relevance, code snippet count, source reputation, and benchmark score
3. `query-docs` with the selected library ID and the user's full question
4. Answer using the fetched docs

---

### Intersectional Golden Rule: Ponytail + Skills

Ponytail's "lazy" philosophy and these design rules do not contradict each
other; they enhance one another. When building the interface:

> _"Do not create complex abstractions in React or add dependencies for
> elements that the platform, Next.js, or the standard library can resolve
> natively. Rely on React Server Components for static content, native
> `<dialog>` for modals, CSS scroll-snap for carousels, and the TypeScript
> standard library before writing custom abstractions or pulling in npm
> packages."_

**Architectural Override Rule:** Tailwind's utility-first model is the
mandatory styling contract. Ponytail's _'fewest files possible'_ restriction
applies to preventing unrequested features or redundant helpers. It **MUST NOT**
replace Tailwind classes with separate CSS files per component.

---

## Useful Commands

- `pnpm dev`: Starts the Next.js development server on port 3000.
- `pnpm build`: Generates production build in the `.next/` folder.
- `pnpm start`: Starts the production server.
- `pnpm lint`: Runs ESLint across the project.

---

## CHANGELOG

| Version | Date       | Author        | Changes                                            |
| ------- | ---------- | ------------- | -------------------------------------------------- |
| 1.0     | 2026-07-16 | @orchestrator | Initial design contract from Design Thinking phase |

---

## Enforcement

> **This document and DESIGN.md are binding contracts.** Any agent violating
> these rules will have its output rejected by `@code-review` and the pipeline
> will halt. No exceptions.

**To propose a change:** `@orchestrator` presents the change to the user,
receives explicit approval ("Approved" or "Aprobado"), then updates the
relevant document and notifies all agents.
