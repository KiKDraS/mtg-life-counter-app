<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in
`node_modules/next/dist/docs/`. Your training data is outdated — the docs are
the source of truth.

<!-- END:nextjs-agent-rules -->

# Agent Context

**MTG Life Counter App** — a Progressive Web Application for Magic: The
Gathering players, featuring life total tracking and an AI-powered Judge to
resolve rules questions. Built with **Next.js 16** (App Router), **React 19**
(RSC by default), **TypeScript 5** (strict), **Tailwind CSS 4** (utility-first),
**@openrouter/sdk**, **pnpm**, **ESLint** (eslint-config-next), **Playwright**.

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

When DESIGN.md specifies an aesthetic decision that conflicts with a generic
skill rule, **DESIGN.md wins.** All agents must read DESIGN.md before
implementing any UI, and `@code-review` must verify against DESIGN.md's specific
constraints, not generic rules.

---

## Git Flow

- **`main`** — production. Merges only from `release/*` or `hotfix/*`.
- **`develop`** — integration. Feature branches merge here.
- **`feature/*`** — from `develop`, merge back to `develop`.
- **`release/*`** — from `develop`, merge to `main` + back-merge to `develop`.
- **`hotfix/*`** — from `main`, merge to `main` + back-merge to `develop`.

All merges via Pull Requests only. Branch management is handled by
`@release-manager`.

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

Ponytail's "lazy" philosophy and the design rules do not contradict each other;
they enhance one another. When building the interface:

> _"Do not create complex abstractions in React or add dependencies for elements
> that the platform, Next.js, or the standard library can resolve natively. Rely
> on React Server Components for static content, native `<dialog>` for modals,
> CSS scroll-snap for carousels, and the TypeScript standard library before
> writing custom abstractions or pulling in npm packages."_

**Architectural Override:** Tailwind's utility-first model is the mandatory
styling contract. Ponytail's _'fewest files possible'_ applies to preventing
unrequested features or redundant helpers. It **MUST NOT** replace Tailwind
classes with separate CSS files per component.

---

## Caveman (Communication Mode)

Caveman mode active in this project unless user says "stop caveman" or "normal
mode".

Respond terse like smart caveman. Technical substance exact. Only fluff die.

Drop articles, filler, pleasantries, and hedging. Fragments OK. Use short
synonyms. Keep code, commands, quoted errors, identifiers, and security warnings
exact.

Pattern: `[thing] [action] [reason]. [next step].`

Default mode: full. `/caveman lite`, `/caveman full`, `/caveman ultra`,
`/caveman wenyan`, `/caveman wenyan-lite`, and `/caveman wenyan-ultra` switch
intensity for current session.

Code, commits, PR descriptions, destructive confirmations, and security findings
use normal clarity when compression risks misread.

Available skills:
- `caveman`: persistent terse communication mode.
- `caveman-commit`: terse Conventional Commit messages.
- `caveman-review`: one-line code review comments.
- `caveman-help`: quick reference card.
- `caveman-compress`: compress markdown memory files while preserving technical
  content.

---

## Framework & Library Docs (Context7)

Before implementing any feature involving a library, framework, SDK, or API
(React, Next.js, Tailwind, OpenRouter, etc.), fetch current documentation via
Context7 MCP — your training data may not reflect recent changes. Do not use
Context7 for general programming concepts or business logic.

---

## Caveman OpenCode Rules

Caveman mode active in this project unless user says "stop caveman" or "normal
mode".

Respond terse like smart caveman. Technical substance exact. Only fluff die.

Drop articles, filler, pleasantries, and hedging. Fragments OK. Use short
synonyms. Keep code, commands, quoted errors, identifiers, and security warnings
exact.

Pattern: `[thing] [action] [reason]. [next step].`

Default mode: full. `/caveman lite`, `/caveman full`, `/caveman ultra`,
`/caveman wenyan`, `/caveman wenyan-lite`, and `/caveman wenyan-ultra` switch
intensity for current session.

Code, commits, PR descriptions, destructive confirmations, and security findings
use normal clarity when compression risks misread.

Available OpenCode skills:

- `caveman`: persistent terse communication mode.
- `caveman-commit`: terse Conventional Commit messages.
- `caveman-review`: one-line code review comments.
- `caveman-help`: quick reference card.
- `caveman-compress`: compress markdown memory files while preserving technical
  content.

---

## Useful Commands

- `pnpm dev` — Next.js dev server on port 3000.
- `pnpm build` — production build in `.next/`.
- `pnpm start` — production server.
- `pnpm lint` — ESLint across the project.

---

## Enforcement

> **This document and DESIGN.md are binding contracts.** Any agent violating
> these rules will have its output rejected by `@code-review` and the pipeline
> will halt. No exceptions.

**To propose a change:** `@orchestrator` presents the change to the user,
receives explicit approval ("Approved" or "Aprobado"), then updates the relevant
document and notifies all agents.
