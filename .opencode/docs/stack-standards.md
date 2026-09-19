# Stack Standards

Binding: `@frontend-dev` (write) + `@code-review` (audit). Violation → rework /
REJECT. Contract = AGENTS.md structure + SPEC.md behavior + DESIGN.md
aesthetics. Refines, never overrides. Single source — no copies in agent
files.

---

## React & Next.js (RSC)

- **RSC by default.** `app/` components RSC unless `'use client'`.
- **Client boundary at leaf.** Never page-level unless mandatory.
- **Forbidden in client:** async components, server-only imports, `'use server'`.
- **Route files:** `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`,
  `not-found.tsx`.
- **Metadata:** `metadata`/`generateMetadata` on every `page.tsx` + `layout.tsx`.
- **Images:** `next/image` — explicit `width`/`height`/`alt`. `priority` for LCP.
- **Fonts:** `next/font` — localFont or Google (self-hosted). CSS variable per
  DESIGN.md §3.
- **Suspense/dynamic:** `<Suspense>` for heavy/async. `next/dynamic`(ssr:false)
  for non-critical.
- **Listeners:** browser listeners via Latest Callback Pattern (mutable refs,
  avoid re-binding).
- **Boundaries:** RSC boundaries per SPEC.md §1.

## TypeScript

- **Strict** (`"strict": true`). Zero `tsc` errors. No `any` without
  justification — `unknown` + narrowing.
- **Interfaces** for exported fn, component props, API boundaries.
  Discriminated unions for state machines.
- **JSDoc on exports:** `@description`, `@param`, `@returns`. Skip when
  name + signature self-explanatory (simple action creators, well-known
  aliases like `cn`).
- **No magic strings.** Import from constants files. No hardcoded hexes,
  labels, domain terms. `colors.ts` = color source of truth.
- **Constants per domain:** one file per concept. No catch-all
  `constants.ts`/`types.ts`/`utils.ts`/`helpers.ts`.
- **Promote:** feature constants/types used in 2+ files → `<name>/types/` or
  `<name>/constants/`. Single-file stays inline.
- **No barrel imports.** Direct source import only.
- **Read-only props:** `readonly` per prop or `Readonly<Props>`.
- `satisfies` for config objects. Generics for reusable utilities.
- **Naming:** `.tsx` PascalCase, hooks `use-` kebab-case, non-component `.ts`
  kebab-case, dirs kebab-case.
- **State modules:** per AGENTS.md **State Module Structure**.
- **Route modules:** per AGENTS.md **Route Module Structure**.
- **Keep markers:** `// keep:` lines correct as-is. Never modify.

## Tailwind & Design

- **Utility-first.** All style via Tailwind `className`. No separate CSS per
  component (exception: complex keyframe animations).
- **`cn()` composition** from `shared/lib/cn.ts`. Never manual concat.
- **Extract repeats:** same className pattern 3+ times → local component or
  `shared/components/`.
- **Design tokens** in `globals.css` via `@theme` + CSS custom properties.
  Every color/spacing/type references tokens.
- **No hardcoded hex.** `var(--color-*)`. Tokenize new colors in `colors.ts`
  first, mirror to `globals.css`.
- **`@apply` forbidden** for components. Only `globals.css` base resets.
- **Responsive:** mobile-first (`sm:`, `md:`, `lg:`).
- **Anti-generic aesthetics** per `frontend-design`: bold typography,
  asymmetry, intentional palettes, grid-breaking. No Inter/Roboto. No purple
  gradients on white.
- **Motion:** `animate-*` utilities + custom `@keyframes`. Staggered reveals
  via `animation-delay` loops.
- **DESIGN.md §1–9 + SPEC.md §1–7 binding.** DESIGN.md overrides generic skill
  rules.

## Accessibility (WCAG 2.2 AA)

- **Semantic JSX:** `<button>`, `<nav>`, `<main>`, `<dialog>` — no
  `<div>`+ARIA substitute.
- **Keyboard:** all interactive reachable + operable. Visible `focus-visible`.
- **Forms:** `<label>` associations. Clear error messaging.
- **Contrast:** text 4.5:1, large text 3:1.
- **Dynamic text** on computed backgrounds (mana, zones): `textColorFor()`
  from `shared/lib/text-color-for.ts`. Never hardcode.
- **`prefers-reduced-motion`:** disable swipe animations, instant show/hide.
- **DESIGN.md §9:** SR announcements, keyboard swipe alternatives, reduced
  motion per source doc.
- Full rules: `accessibility` skill.

## Composition

- **No boolean prop proliferation.** Compound components, explicit variants
  over `isPrimary`, `isLarge`, `isDisabled`.
- **Lift state** to providers when siblings share state.
- **React 19:** no `forwardRef` — pass `ref` as prop. `use()` over
  `useContext()`.
- **Children over render props.** Compose via `children` unless dynamic render
  control genuinely needed.
- **No inline components** defined inside other components — breaks
  reconciliation.

## Component hygiene

- **No raw string state.** const enum:
  ```ts
  const ViewType = { Grid: "grid", Numpad: "numpad" } as const;
  type ViewType = (typeof ViewType)[keyof typeof ViewType];
  ```
- **150+ line files** or 2+ distinct HTML blocks → split.
- **One concern per file.** Layout XOR logic XOR IO. Hooks/utils past 20 lines
  → own file.

## SEO

- **Metadata:** titles unique <60 chars. Descriptions 150–160 chars. No
  placeholders.
- **JSON-LD:** valid, matches page content.
- **Alt text:** meaningful — not "logo" or "image".
- **Sitemap:** verify `sitemap.xml` exists + lists all routes.
- Full rules: `seo` skill.