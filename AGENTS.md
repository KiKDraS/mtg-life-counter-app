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

## Rule References (no copies)

Agent files + meta files reference docs/skills/DESIGN/SPEC by pointer. Never
copy rules into another file — copies go stale. Edit source only.

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
`state/no-state-spaghetti`, scope `features/**/state/**/*.{ts,tsx}`). No barrel
`index.ts` re-exports — import direct from concern file.

## Route Module Structure (enforced by `@code-review`)

`app/api/**` route handlers: thin shells. One concern per file. No megafiles.

`app/api/judge/` canonical — other API routes mirror:

```
app/api/judge/
  route.ts      — thin shell: parse/validate → pipeline → stream out. ≤~90 lines. No business logic.
  config.ts     — env validation + constants + SDK instances.
  rate-limit.ts — sliding-window limiter.
  sessions.ts   — session store.
  sse.ts        — SSE encode/error helpers.
  context.ts    — data-source assembly (degradable).
  stream.ts     — model streaming, fallback, timeouts.
```

Violations → `@code-review` REJECT: route.ts >150 lines, business logic in
route.ts, concern mixing, new concern without dedicated file. No barrel
`index.ts`.

**Change proposal:** `@orchestrator` presents, user approves
("Approved"/"Aprobado"), then updates doc, notifies all agents.
