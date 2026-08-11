# Performance-Reliability

## Objective

Code style rule: LOW cognitive difficulty + HIGH perf (O(1)/O(n) lookup). Binding for write (`@frontend-dev`, `@ai-engineer`) + review (`@code-review`). Violation = REJECT.

---

## Cognitive difficulty

- FLAT > nested. Depth ≤2. Deeper → extract fn.
- Early return. Guard first. Happy path flat.
- Named predicate. `const isLethal = life <= 0`. Never inline `if (life <= 0)`.
- Small fn. ≤20 lines. One job. Name = verb + noun.
- No clever. No one-liner golf, no trick ternary, no fancy reduce.
- Explicit > implicit. No hidden state, no surprise side-effect.
- One concern per fn. Layout XOR logic XOR IO.
- Obvious > clever. 3am reader must get it first pass.

## Performance (lookup)

- Lookup = Map/Set/object. NEVER array scan for membership/key.
- `indexOf`/`includes`/`find` in loop = O(n²). REJECT. Build Map once, reuse.
- Dedupe = Set. Not `filter + indexOf`.
- Hoist lookup out of loop/render. One Map build, many reads.
- Static data → module const. Derived → `useMemo`. Cache repeat work.
- No re-scan in render. Build lookup once outside render body.
- `Promise.all` over sequential await. No waterfall.
- Big-O documented: O(1)/O(n) norm. O(n²) needs written justification.

## Write checklist (frontend-dev, ai-engineer)

- [ ] Depth ≤2. Guard returns first.
- [ ] Predicates named. No inline magic condition.
- [ ] Fn ≤20 lines. One job.
- [ ] Lookup via Map/Set. Zero array-scan-in-loop.
- [ ] Hoisted + cached. No rebuild per call/render.
- [ ] Big-O stated for non-trivial fn.

## Review checklist (code-review)

- [ ] Array scan for membership/key → REJECT. Demand Map/Set.
- [ ] `indexOf`/`find`/`includes` in loop → REJECT. O(n²).
- [ ] Nested >2, no guard return → REJECT.
- [ ] Inline magic predicate → REJECT. Name it.
- [ ] Lookup rebuilt per call/render → REJECT. Hoist/cache.
- [ ] Clever golf → REJECT. Boring wins.

## Reject format

```
[PERF-REL] file:line — problem. Fix: solution.
```

## Priority

Perf-reliability ≥ style. Both ≥ speed of writing. Contract = AGENTS.md + DESIGN.md + SPEC.md first; this doc refines, never overrides.
