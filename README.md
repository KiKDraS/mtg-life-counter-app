<div align="center">

<img src="features/spellbook/images/mtg-logo.png" alt="MTG Life Counter logo" width="96" />

# MTG Life Counter

**A tabletop-first Magic: The Gathering companion. Life tracking at dice speed — plus an AI rules judge that settles disputes without anyone leaving the table.**

</div>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" />
  <img alt="OpenRouter SDK" src="https://img.shields.io/badge/OpenRouter_SDK-000000?style=for-the-badge" />
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />
</p>

---

## Why this app exists

Magic: The Gathering is played on kitchen tables, in game stores, and in
tournament halls — and every one of those games needs the same thing: a fast,
reliable way to track life totals. The existing solutions all compromise
somewhere.

### The market

| App | What it does well | What it misses |
| --- | ----------------- | -------------- |
| **MTG Companion** (official) | Tournament pairing, match structure | Account- and event-centric. Overkill for casual play. No in-game rules help. |
| **MTG Familiar** | Card database, Oracle text, prices, rules all in one | Dense utility UI. Life tracking is an afterthought. Ads, dated design. |
| **Dragon Shield Life Counter** | Simple, clean, reliable | Single-purpose tap counter. Generic design. No commander damage, no multiplayer depth. |
| **Stone Blade / generic life apps** | Tap ±1 works | One screen, one format. No overlays, no layout intelligence, no rules engine. |

### The differentiator

This app was built for the actual gameplay loop — players hunched over a
table, phones face-up, game state changing every few seconds:

- **The life total IS the interface.** Typographic Brutalism with Archivo
  Black 900 numerals and MTG mana-color identity per player. No chrome, no
  noise — readable at a glance in a dim room, from across the table.
- **Gesture-first control.** Tap ±1, hold for ±10, swipe for commander damage
  and counters overlays. Faster than dice, faster than any competing app.
- **The AI Judge.** An LLM judge grounded in the actual Comprehensive Rules
  and Scryfall card data. A rules dispute mid-game becomes a question, not an
  argument. No other life counter ships this.
- **A real PWA.** Installable, fully offline for game tracking, no accounts,
  no ads, no telemetry. The whole game survives a dead connection.
- **Up to 6 players** with auto-rotating layouts, per-player mana color
  identity, commander damage tracking, poison, energy, experience, time, and
  custom counters.

---

## Features

### Current

**Game tracking**
- 2–6 players with adaptive layouts: portrait/landscape, zones auto-rotated
  180°/90° so every player reads their own screen
- Tap ±1 / hold ±10 life adjustment, swipe gestures for overlays
- Commander damage per commander with 21-damage lethal rule
- Counters: poison (10 lethal), energy, experience, time + unlimited custom
  counters
- Per-player color identity via the WUBRG color wheel (multi-color gradients)
- Initial life presets (20/30/40/60) or custom, one-tap restart
- State persists in IndexedDB — survives reloads, works fully offline

**AI Judge**
- Streaming chat (SSE) with incremental rendering and typing indicator
- RAG pipeline over the official Comprehensive Rules (mtg.wtf) + Scryfall
  card data and rulings, with inline rule citations (`CR 702.12a`)
- Multi-model routing through the OpenRouter SDK: primary + fallback model,
  automatic failover, zero-data-retention
- Bilingual: answers in English or Spanish (Spanish retrieval via MTG term
  dictionary)
- Rate limiting, timeouts, graceful degradation — a card lookup failure never
  blocks a rules answer
- Chat history survives reloads (IndexedDB); read-only offline fallback

**Engineering**
- Server-side only AI route: thin route handler, one concern per module,
  validated env config
- Accessibility to WCAG 2.2 AA: contrast, keyboard, screen reader, reduced
  motion
- Automated E2E suite: 17 Playwright specs covering layouts, gestures,
  modals, persistence, and the AI Judge

### Roadmap

| Feature | Status |
| ------- | ------ |
| Semantic retrieval with embeddings (`OPEN_ROUTER_EMBEDDING_MODEL`) | Phase 2 |
| AI Judge voice input | Phase 2 |
| Card art backgrounds from Scryfall | Phase 2 |
| Offline AI rules engine — full rules corpus in the service worker | Phase 3 |

---

## How it was built

### A curated agent system, not a magic button

This project is developed with a **multi-agent engineering pipeline**
(`.opencode/agents/`) where each agent has a single, enforced responsibility:

| Agent | Responsibility |
| ----- | -------------- |
| **Orchestrator** | Planning, delegation, quality gates, contract authoring |
| **Frontend Dev** | React components, Tailwind, game layout, gestures, state |
| **AI Engineer** | OpenRouter integration, RAG pipeline, `/api/judge`, streaming |
| **Code Review** | Compliance audit against the design and spec contracts |
| **Playwright Planner / Generator / Healer** | Scenario design, test code, execution + self-healing |
| **Release Manager** | Branching, PRs, tags, changelogs |

The discipline that makes it reliable: **contract-driven development**.
`DESIGN.md` (visual + interaction) and `SPEC.md` (behavior + data model) are
binding contracts. Every delivery is audited against them by the code-review
agent before it can merge. The result is a codebase where the design language
and the data model never drift apart — and every feature ships with a
matching automated test.

### OpenRouter SDK — one API, many models

The AI Judge uses the official `@openrouter/sdk` with production-grade
patterns:

- Models configured via environment, never hardcoded — primary and fallback
  judge models, optional embedding model for semantic retrieval
- Automatic failover on 5xx/timeouts/provider errors, streaming token output,
  per-request cost tracking
- Zero-data-retention provider preference
- The RAG pipeline fetches real data (Comprehensive Rules from mtg.wtf,
  cards + rulings from Scryfall), versions it by content hash, and injects
  only retrieved, cited context into the prompt — the model answers from the
  rules, not from memory

### How it's being updated

Every change follows the same pipeline: plan → branch (`feature/*`) → build →
audit → full Playwright E2E pass → PR → merge → release (`release/*` → `main`
→ back-merge). Nothing merges without the automated QA gate. Features land
incrementally with their specs and tests — see the roadmap above for what's
next.

---
