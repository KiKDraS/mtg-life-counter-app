<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before Next.js work, read relevant doc in
`node_modules/next/dist/docs/`. Training data outdated — docs are
truth.

<!-- END:nextjs-agent-rules -->

# Agent Context

**MTG Life Counter App** — PWA for Magic. Life tracking + AI Judge.
**Next.js 16** (App Router), **React 19** (RSC default),
**TypeScript 5** (strict), **Tailwind CSS 4**, **@openrouter/sdk**,
**pnpm**, **ESLint**, **Playwright**.

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

SPEC.md < DESIGN.md. DESIGN.md wins on conflicts.
All agents read both before work. `@code-review` verifies against both.

---

## Git Flow

- **main** — prod. Merges from release/* or hotfix/* only.
- **develop** — integration. Feature branches merge here.
- **feature/*** — from develop → develop.
- **release/*** — from develop → main + back-merge to develop.
- **hotfix/*** — from main → main + back-merge to develop.

All merges via PRs only. Branch ops by `@release-manager`.

---

## Agent Responsibility Matrix

| Agent                        | Responsible For                                 | Must Read      |
| ---------------------------- | ----------------------------------------------- | -------------- |
| `@orchestrator`              | Planning, delegation, gates, DESIGN.md          | AGENTS.md, DESIGN.md, SPEC.md |
| `@frontend-dev`              | React components, Tailwind, game layout         | DESIGN.md §1–9, SPEC.md       |
| `@ai-engineer`               | AI Judge route, OpenRouter SDK, RAG pipeline    | DESIGN.md §6.4, SPEC.md       |
| `@code-review`               | Compliance audit vs DESIGN.md + SPEC.md         | DESIGN.md, SPEC.md            |
| `@playwright-test-planner`   | Test scenarios from component tree              | DESIGN.md §4–9 |
| `@playwright-test-generator` | Test code                                       | DESIGN.md §4–9 |
| `@playwright-test-healer`    | Test execution                                  | DESIGN.md §4–9 |
| `@release-manager`           | Git ops, PRs, tags                              | —              |

---

## Ponytail + Skills (Intersectional Golden Rule)

> No complex abstractions. Rely on platform, Next.js, stdlib.
> RSC for static, native `<dialog>` for modals, CSS scroll-snap for
> carousels, TS stdlib before custom code or npm deps.

**Override:** Tailwind utility-first mandatory. Ponytail's _fewest files
possible_ prevents unrequested features, redundant helpers. Must NOT
replace Tailwind classes with separate CSS per component.

---

## Caveman Mode

Active unless "stop caveman". Default: full.
`/caveman lite|full|ultra|wenyan|wenyan-lite|wenyan-ultra` switch intensity.
Code/commits/PRs/security: normal clarity when compression risks misread.
Skills: `caveman`, `caveman-commit`, `caveman-review`, `caveman-help`, `caveman-compress`.

### Mandatory: ultra on core files

Editing AGENTS.md, DESIGN.md, SPEC.md, or `.opencode/agents/*.md` → **caveman ultra** forced. No lite, no full. Rationale: these files read every session. Token density matters.

---

## Context7 (Library Docs)

Fetch current docs via Context7 MCP before implementing lib/framework
features. Training data stale. Don't use for business logic.

---



## Enforcement

> This doc + DESIGN.md + SPEC.md are binding contracts. Violations rejected by
> `@code-review`. Pipeline halts.

**Change proposal:** `@orchestrator` presents, user approves ("Approved"/"Aprobado"),
then updates doc, notifies all agents.
