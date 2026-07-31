# Agent Skills Rules

## Ponytail + Skills (Intersectional Golden Rule)

> No complex abstractions. Rely on platform, Next.js, stdlib. RSC for static,
> native `<dialog>` for modals, CSS scroll-snap for carousels, TS stdlib before
> custom code or npm deps.

**Override:** Tailwind utility-first mandatory. Ponytail's _fewest files
possible_ prevents unrequested features, redundant helpers. Must NOT replace
Tailwind classes with separate CSS per component.

---

## Rules

**Caveman ON (full).** Sub-agents inherit. Off: "stop caveman". Drop
articles/filler/pleasantries/hedging. Fragments OK. Pattern:
`[thing] [action] [reason].` Spec: `.opencode/skills/caveman/SKILL.md`

**Caveman ultra enforced** on edits to `AGENTS.md`, `DESIGN.md*`,
`.opencode/agents/*.md`. Max compression. These are meta files — no prose, no
explanations, no pleasantries. If reading: caveman ultra. If writing: caveman
ultra.

**Context7 MCP mandatory.** `resolve-library-id` → `query-docs` for
lib/framework/API/CLI questions. Spec: `.opencode/skills/context7-mcp/SKILL.md`

**CodeGraph mandatory.** `.codegraph/` in root? **USE CODEGRAPH FIRST.** No
grep/find/Read before. MCP `codegraph_codegraph_explore`: source + line nums +
call paths + dynamic-dispatch grep misses. Fallback chain: MCP → shell
`codegraph explore` → grep/Read. No `.codegraph/` dir? Skip. Indexing user
choice.

---
