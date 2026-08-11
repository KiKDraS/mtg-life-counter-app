<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before Next.js work, read relevant doc in `node_modules/next/dist/docs/`.
Training data outdated — docs are truth.

<!-- END:nextjs-agent-rules -->

# Agent Context

**MTG Life Counter App** — PWA for Magic. Life tracking + AI Judge. **Next.js
16** (App Router), **React 19** (RSC default), **TypeScript 5** (strict),
**Tailwind CSS 4**, **@openrouter/sdk**, **pnpm**, **ESLint**, **Playwright**.

---

## Project Structure

```
app/          # App Router — RSC default
features/     # life-counter/, ai-judge/
shared/       # components/, lib/ (cn, constants, state, types)
public/       # Static assets
tests/        # Playwright (e2e/, components/)
DESIGN.md     # Design contract (visual + interaction)
SPEC.md       # Application logic contract (behavior + data model)
.opencode/    # agents/, skills/
```

---

## Contract Hierarchy

SPEC.md < DESIGN.md. DESIGN.md wins on conflicts. All agents read both before
work. `@code-review` verifies against both.

---

## Git Flow

- **main** — prod. Merges from release/_ or hotfix/_ only.
- **develop** — integration. Feature branches merge here.
- **feature/\*** — from develop → develop.
- **release/\*** — from develop → main + back-merge to develop.
- **hotfix/\*** — from main → main + back-merge to develop.

All merges via PRs only. Branch ops by `@release-manager`.

---

## Agent Responsibility Matrix

| Agent                        | Responsible For                              | Must Read                     |
| ---------------------------- | -------------------------------------------- | ----------------------------- |
| `@orchestrator`              | Planning, delegation, gates, DESIGN.md       | AGENTS.md, DESIGN.md, SPEC.md |
| `@frontend-dev`              | React components, Tailwind, game layout      | DESIGN.md §1–9, SPEC.md       |
| `@ai-engineer`               | AI Judge route, OpenRouter SDK, RAG pipeline | DESIGN.md §6.4, SPEC.md       |
| `@code-review`               | Compliance audit vs DESIGN.md + SPEC.md      | DESIGN.md, SPEC.md            |
| `@playwright-test-planner`   | Test scenarios from component tree           | DESIGN.md §4–9                |
| `@playwright-test-generator` | Test code                                    | DESIGN.md §4–9                |
| `@playwright-test-healer`    | Test execution                               | DESIGN.md §4–9                |
| `@release-manager`           | Git ops, PRs, tags                           | —                             |

---

## Enforcement

> This doc + DESIGN.md + SPEC.md are binding contracts. Violations rejected by
> `@code-review`. Pipeline halts.

## State Module Structure (enforced by ESLint `state/no-state-spaghetti`)

`features/<name>/state/` — one concern per file. No `*-context.tsx` megafiles.

```
features/game-shell/state/     features/player-zone/state/
  types.ts                        types.ts
  constants.ts                    constants.ts
  actions.ts                      actions.ts
  reducer.ts                      reducer.ts
  context.ts                      context.ts
  GameProvider.tsx                PlayerProvider.tsx
  hooks.ts                        hooks.ts
```

- `types.ts` — state/action/context-value interfaces. Type-only.
- `constants.ts` — action type consts + init state.
- `actions.ts` — action creators. Pure.
- `reducer.ts` — reducer. Pure.
- `context.ts` — `createContext` only. `"use client"`.
- `<Name>Provider.tsx` — provider + effects. `"use client"`.
- `hooks.ts` — consumer hooks. `"use client"`.

`createContext` + `useReducer` same file → `pnpm lint` REJECT (rule
`state/no-state-spaghetti`, scope `features/**/state/**/*.{ts,tsx}`).
No barrel `index.ts` re-exports — import direct from concern file.

**Change proposal:** `@orchestrator` presents, user approves
("Approved"/"Aprobado"), then updates doc, notifies all agents.
