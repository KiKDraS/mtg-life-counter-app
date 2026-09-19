# Changelog

## v1.1.1 - 2026-09-19

- Reasoning-effort knob (OPEN_ROUTER_REASONING_EFFORT: none/low/medium/high) — controls hidden chain-of-thought latency on reasoning models (#166)

## v1.1.0 - 2026-09-18

### Telemetry & observability

- Phase timings + Axiom ingest; probe script (#155)
- Context split metrics (scryfall/rules ms), Axiom failure events, probe derived metrics + history battery (#157)
- Probe timeout aligned to server budget (130s), per-run progress (#163)

### RAG & retrieval

- Topic-prefix boost, rulings trim (cap 3), ES terms, real CR few-shot citations (#156)
- Parallel Scryfall card lookup, history cap 10k (#159)

### Streaming & UX

- Answer-first streaming: plain answer + `<<<CITATIONS>>>` delimiter, server-side citation assembly, no-reasoning prompt (#158)
- Status events: "Searching rules… / Thinking…" phase progress in judge modal (#161)

### Infra

- Committed CR rules bundle (kills cold-start fetch), `pnpm rules:refresh`, weekly CI refresh PR (#160)
- Rules-refresh PR notifies owner (#162)

## [1.0.4] - 2026-08-14

### Added

- Color picker: every color selection adds to the color array; default `["r"]` no longer replaced — SPEC §8.5.1 (#146)

### Fixed

- Custom counter pill sizing, cqmin wheel, fixed add button (#145)

- Test suite: 201 passing (2 pre-existing PWA-environment failures out of scope)

## [1.0.3] - 2026-08-13

### Added

- Splash screen covers PWA standalone launch with body scroll lock (#139/#140)
- Commander damage decrement [−] button with hold-to-repeat and floor-0 clamp; life restored by applied delta (#141)

### Fixed

- Commander damage overlay swipe-to-close when content scrolls on small devices — dialog-level scroll + rotation-matched touch-action (Counters pattern), min-width anti-shrink; CDP-touch regression coverage (OVF-01..04)

- Test suite: 209 passing

## [1.0.2] - 2026-08-13

### Added

- Vercel Web Analytics (#135)
- CommanderDamage and Counters UI — cqmin zone-scaling typography, flex-wrap overlay layouts, DESIGN.md contract updates (#136)

### Changed

- Restore user's overlay UI as canonical; docs + tests matched (#137)

### Fixed

- Test suite hardened for prod-build runs, Vercel-benign console filters; 198 passing

## [1.0.1] - 2026-08-12

### Changed

- README: live demo link → alpha deployment
- AI Judge httpReferer default → alpha deployment URL

## [1.0.0] - 2026-08-12

### Added

- First release of MTG Life Counter PWA: life counter with commander damage, counters, swipe gestures, spellbook belt, extended splash, PWA install, portrait lock.
- AI Judge via OpenRouter (streaming SSE), RAG rules engine.
- Playwright test suite.
- Agent pipeline (AGENTS.md, DESIGN.md, SPEC.md).
