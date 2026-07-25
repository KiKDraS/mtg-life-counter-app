<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in
`node_modules/next/dist/docs/`. Your training data is outdated — the docs are
the source of truth.

<!-- END:nextjs-agent-rules -->

# Agent Context

**MTG Life Counter App** — PWA for Magic: The Gathering. Life total tracking
and AI-powered Judge. **Next.js 16** (App Router), **React 19** (RSC by
default), **TypeScript 5** (strict), **Tailwind CSS 4**, **@openrouter/sdk**,
**pnpm**, **ESLint**, **Playwright**.

---

## Project Structure

```bash
├── app/                 # Next.js App Router — RSC by default
│   ├── api/judge/       # AI Judge streaming endpoint
│   ├── layout.tsx       # Root layout — metadata, fonts, global shell
│   ├── page.tsx         # Home page (life counter UI)
│   └── globals.css      # Tailwind imports + global design tokens
├── features/
│   ├── life-counter/    # Life tracking, counters, overlays
│   │   ├── components/  # Game board, player zones, overlays
│   │   ├── hooks/       # use-life-adjustment, use-swipe, use-player-state
│   │   ├── utils/       # Feature-specific utilities
│   │   ├── types/       # Types shared within this feature
│   │   └── constants/   # Constants shared within this feature
│   └── ai-judge/        # AI-powered MTG rules Q&A
│       ├── components/  # Judge chat UI, streaming message bubbles
│       └── lib/         # Prompts, RAG, citations, history
├── shared/
│   ├── components/      # UI primitives (DialogShell, icons)
│   └── lib/             # Shared utilities (cn, constants, services, state, types)
├── public/              # Static assets (sw.js)
├── tests/               # Playwright suites (e2e/, components/)
├── DESIGN.md            # Design contract — overrides generic rules
├── .opencode/agents/    # Sub-agent definitions
└── .opencode/skills/    # Installed skill files
```

---

## DESIGN.md as Authoritative Source

When DESIGN.md conflicts with a generic skill rule, **DESIGN.md wins.** All
agents read DESIGN.md before implementing UI. `@code-review` verifies against
DESIGN.md, not generic rules.

---

## Git Flow

- **`main`** — production. Merges only from `release/*` or `hotfix/*`.
- **`develop`** — integration. Feature branches merge here.
- **`feature/*`** — from `develop`, merge back to `develop`.
- **`release/*`** — from `develop`, merge to `main` + back-merge to `develop`.
- **`hotfix/*`** — from `main`, merge to `main` + back-merge to `develop`.

All merges via Pull Requests only. Branch management by `@release-manager`.

---

## Agent Responsibility Matrix

| Agent                        | Responsible For                                 | Must Read      |
| ---------------------------- | ----------------------------------------------- | -------------- |
| `@orchestrator`              | Planning, delegation, gates, DESIGN.md          | AGENTS.md      |
| `@frontend-dev`              | React components, Tailwind styling, game layout | DESIGN.md §1–9 |
| `@ai-engineer`               | AI Judge route, OpenRouter SDK, RAG pipeline    | DESIGN.md §6.4 |
| `@code-review`               | Compliance audit against DESIGN.md              | DESIGN.md      |
| `@playwright-test-planner`   | Test scenarios from component tree              | DESIGN.md §4–9 |
| `@playwright-test-generator` | Test code                                       | DESIGN.md §4–9 |
| `@playwright-test-healer`    | Test execution                                  | DESIGN.md §4–9 |
| `@release-manager`           | Git ops, PRs, tags                              | —              |

---

## Ponytail + Skills (Intersectional Golden Rule)

> Do not create complex abstractions. Rely on platform, Next.js, or standard
> library natively. RSC for static content, native `<dialog>` for modals, CSS
> scroll-snap for carousels, TypeScript stdlib before custom code or npm deps.

**Override:** Tailwind utility-first is mandatory styling. Ponytail's _fewest
files possible_ prevents unrequested features, redundant helpers. Must NOT
replace Tailwind classes with separate CSS per component.

---

## Caveman Mode

Caveman active unless user says "stop caveman" or "normal mode".

Respond terse. Technical substance exact. Drop articles, filler, hedging.
Fragments OK. Pattern: `[thing] [action] [reason]. [next step].`

Default: full. `/caveman lite|full|ultra|wenyan|wenyan-lite|wenyan-ultra` switch
intensity. Code, commits, PRs, destructive actions, security — normal clarity
when compression risks misread.

Skills: `caveman`, `caveman-commit`, `caveman-review`, `caveman-help`,
`caveman-compress`.

---

## Framework & Library Docs (Context7)

Fetch current docs via Context7 MCP before implementing any library/framework
feature. Training data may be stale. Don't use for business logic or general
programming.

---

## Useful Commands

- `pnpm dev` — Next.js dev server on port 3000.
- `pnpm build` — production build in `.next/`.
- `pnpm start` — production server.
- `pnpm lint` — ESLint across the project.

---

## Enforcement

> **This document and DESIGN.md are binding contracts.** Violations rejected by
> `@code-review`. Pipeline halts. No exceptions.

**To propose a change:** `@orchestrator` presents to user, gets explicit
approval ("Approved" or "Aprobado"), then updates the relevant document and
notifies all agents.
