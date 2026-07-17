# DESIGN.md — Project Design Contract

**Version:** 1.0  
**Date:** 2026-07-16  
**Status:** Active Contract — All agents MUST comply  
**Location:** `/DESIGN.md` (project root)

---

## 1. PROJECT IDENTITY & DESIGN PHILOSOPHY

### 1.1 Project Purpose

**MTG Life Counter App** — A Progressive Web Application for Magic: The
Gathering players. Tracks life totals for 2-6 players with dynamic layouts,
per-player MTG color identity, and an AI-powered Judge for rules resolution. No
accounts, no cloud — the app is session-only, disappears into the table, and
leaves only the numbers and colors.

### 1.2 Primary Audience

MTG players aged 16-40+ — casual kitchen-table pods, Commander nights at LGS,
tournament grinders. They want something that _feels_ like the game they love,
not a spreadsheet.

### 1.3 Core Action

Track life totals and resolve rules disputes without breaking the game's flow.
The app should be _faster than dice._

### 1.4 Design Philosophy

> **"Typographic Brutalism + Color Identity"** — The life total IS the
> interface. Massive, unapologetic geometric numbers. The app disappears —
> leaving only the numbers and each player's chosen color identity. No chrome,
> no noise.

| Principle                | Decision                                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aesthetic Direction**  | Typographic Brutalism + MTG Color Identity                                                                                                                                                                      |
| **Typography**           | **Archivo** (geometric sans-serif) — Black 900 for life totals, Medium 500 for UI, variable weight                                                                                                              |
| **Color Strategy**       | Warm parchment base (light) / near-black felt (dark). Player identity via MTG mana colors. Light + dark mode.                                                                                                   |
| **Layout Approach**      | Grid-based player zones. 2p (vertical split), 4p (2×2), 6p (2×3). Top/left rows rotated 180°. Responsive to orientation.                                                                                        |
| **Background Treatment** | Solid block color per player zone — the color IS the background. Base shell is neutral parchment/dark.                                                                                                          |
| **Motion Choreography**  | Minimal. Fast opacity/scale transitions for modals. Staggered reveal of player zones on game start. Gesture-driven swipe overlays with spring physics.                                                          |
| **Differentiation**      | **Massive typography + MTG mana color identity** — every player's zone is an uncompromising block of their chosen color with a life total you can read from across the room. The AI Judge is the secret weapon. |

### 1.5 Anti-Patterns (Forbidden)

- ❌ Generic purple gradient on white
- ❌ Inter / Roboto / Arial / System font stacks
- ❌ Centered hero + 3-column card grid
- ❌ Subtle gray-on-gray text
- ❌ Generic rounded cards with soft shadows
- ❌ Player names — color + position is the only identifier
- ❌ Cookie-cutter "AI slop" aesthetics

---

## 2. NEXT.JS + TAILWIND CSS 4 ARCHITECTURE

### 2.1 Tailwind CSS Configuration

Design tokens live in `app/globals.css` via the `@theme` directive. No hardcoded
values in components.

```css
@import "tailwindcss";

@theme inline {
  /* Typography */
  --font-display: var(--font-archivo);
  --font-body: var(--font-archivo);
  --font-mono: var(--font-archivo);

  /* Spacing scale (4px base) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;
  --space-9: 6rem;
  --space-10: 8rem;

  /* Motion */
  --duration-fast: 100ms;
  --duration-base: 200ms;
  --duration-slow: 350ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 2.2 Base Colors (Light Mode)

```css
:root {
  --color-bg: #f5f0e8; /* Warm parchment — old card stock */
  --color-bg-alt: #ede8de;
  --color-bg-elevated: #ffffff;
  --color-text: #1a1a1a;
  --color-text-muted: #6b645c;
  --color-border: #d4cfc5;
  --color-border-strong: #a8a296;
  --color-focus: #3b8eff;
}
```

### 2.3 Base Colors (Dark Mode)

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #121212; /* Near-black — playmat felt */
    --color-bg-alt: #1e1e1e;
    --color-bg-elevated: #2a2a2a;
    --color-text: #f0ede8;
    --color-text-muted: #9e9a94;
    --color-border: #333333;
    --color-border-strong: #555555;
    --color-focus: #5ba0ff;
  }
}
```

### 2.4 CSS Rules (for any custom CSS beyond Tailwind)

- **Tailwind utility classes ONLY** in JSX — no `@apply`, no separate CSS files
  per component
- **Custom CSS** permitted only in `globals.css` for: `@keyframes`, `@font-face`
  fallbacks, complex animations Tailwind can't express
- **Container queries** preferred over media queries for component
  responsiveness
- **Dark mode** via `dark:` variant (class-based strategy on `<html>`)

---

## 3. COLOR PALETTE — MTG MANA COLORS

### 3.1 Player Identity Colors

Each player selects a mana color. The color FILLS their zone background. No
player name — the color is their identity.

| Mana         | Hex (Light Mode) | Hex (Dark Mode) | Role                   |
| ------------ | ---------------- | --------------- | ---------------------- |
| 🟡 White (W) | `#F8E7B0`        | `#D4C08A`       | Warm, sheltering       |
| 🔵 Blue (U)  | `#3B8EFF`        | `#1E6FD9`       | Electric, intellectual |
| ⚫ Black (B) | `#5C4E4E`        | `#8B7D7D`       | Ambitious, dark        |
| 🔴 Red (R)   | `#E53935`        | `#C62828`       | Passionate, aggressive |
| 🟢 Green (G) | `#43A047`        | `#2E7D32`       | Natural, wild          |
| ✦ Colorless  | `#9E9E9E`        | `#757575`       | Neutral/eldrazi        |

Text on these backgrounds uses high-contrast white or black depending on
luminance (WCAG 4.5:1).

### 3.2 Guild Color Combos (future scope — §14)

Guild blend colors can be added as a secondary color mode once the 5 base mana
colors are stable.

---

## 4. TYPOGRAPHY

### 4.1 Font Loading

```tsx
// app/layout.tsx
import { Archivo } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700", "800", "900"],
});
```

### 4.2 Type Scale

The life total is the hero. Everything else is secondary.

| Token            | Value                        | Weight      | Usage                       |
| ---------------- | ---------------------------- | ----------- | --------------------------- |
| `--text-life`    | `clamp(4rem, 15vw, 12rem)`   | Black 900   | Life total number           |
| `--text-display` | `clamp(2.5rem, 6vw, 5rem)`   | Black 900   | Commander damage big number |
| `--text-heading` | `clamp(1.5rem, 3vw, 2.5rem)` | Bold 700    | Modal titles                |
| `--text-body`    | `1rem`                       | Medium 500  | UI labels, buttons          |
| `--text-body-sm` | `0.875rem`                   | Regular 400 | Captions, secondary labels  |
| `--text-caption` | `0.75rem`                    | Regular 400 | Small badges                |

### 4.3 Line Heights

```css
--leading-none: 0.9; /* Life totals — tight, massive */
--leading-tight: 1.1; /* Commander damage */
--leading-base: 1.4; /* Body text */
```

---

## 5. LAYOUT SYSTEM

### 5.1 Player Zone Grids

The layout auto-adapts to player count and screen orientation.

**2 Players (Portrait)**

```
┌──────────────────┐
│    Player 1      │  180° rotation
│   40 ★           │
│  [+]  [-]        │
├──────────────────┤
│    Player 2      │
│   37 ★           │
│  [+]  [-]        │
└──────────────────┘
```

**4 Players (Landscape — 2×2)**

```
┌──────────┬──────────┐
│ Player 1 │ Player 2 │  Top row: 180° rotation
│   40 ★   │   38 ★   │
├──────────┼──────────┤
│ Player 3 │ Player 4 │
│   32 ★   │   41 ★   │
└──────────┴──────────┘
```

**6 Players (Landscape — 2×3 or 3×2)**

```
┌─────┬─────┬─────┐
│ P1  │ P2  │ P3  │  Top row: 180° rotation
├─────┼─────┼─────┤
│ P4  │ P5  │ P6  │
└─────┴─────┴─────┘
```

**3 Players (Portrait — asymmetric)**

```
┌──────────────────┐
│     Player 1     │  180° rotation
│      40 ★        │
├────────┬─────────┤
│Player2 │ Player3 │
│  37 ★  │  41 ★   │
└────────┴─────────┘
```

**5 Players** — 3×2 with a centered singleton, or 3+2 split depending on
orientation.

### 5.2 Player Zone Anatomy

Each player zone contains:

```
┌─────────────────────────┐
│                    ⚙️   │  ← Top-right gear (color picker)
│                         │
│         40              │  ← Life total (Archivo Black, --text-life)
│                         │
│    [-]            [+]   │  ← Life adjustment buttons (large, ≥44px)
│                         │
│  ◄──── swipe ────►      │  ← Swipe left: commander damage
│                         │     Swipe right: counters overlay
└─────────────────────────┘
```

- **Life adjustment:** Tap = ±1. Hold = accelerate (±5, ±10).
- **Swipe left:** Overlays commander damage grid — per-opponent damage trackers,
  compact.
- **Swipe right:** Overlays counters — poison, energy, experience, etc.
- **Gear icon:** Opens modal color picker with mana symbols, light/dark
  variants.
- **Double-tap life total:** Opens numpad for direct input.

### 5.3 180° Rotation

Zones that face an opposite-side player are rotated 180° via CSS
`transform: rotate(180deg)`. This applies to:

- **2 players:** Top panel
- **4 players:** Both top panels
- **6 players:** Top row
- **3 players:** The single top panel

The rotation is applied to the zone container's wrapper — the interior layout is
identical, just flipped.

---

## 6. CENTRAL SPELLBOOK MENU

### 6.1 Trigger

A floating circular button in the screen center. Shows stylized "M"
(planeswalker symbol silhouette or abstract geometric M).

**Size:** 56×56px (≥44px minimum touch target)  
**Position:** Fixed center of screen, above all player zones  
**Z-index:** 50 (above game board, below modals)

### 6.2 Interaction

Tap → splits the screen vertically, revealing a half-screen control panel. The
player zones compress to the left half; the spellbook menu fills the right half.

```
┌──────────┬──────────────────┐
│          │    ⟳ Restart     │  ← Instant action, no modal
│  Player  │                  │
│  Zones   │  ⚙️ Initial Life │  → Modal: 20/30/40/60/custom
│  (scaled │                  │
│   down)  │   👥 Players     │  → Modal: select 2-6 players
│          │                  │
│          │   ⚖️ AI Judge    │  → Modal: chat with rules engine
│          │                  │
└──────────┴──────────────────┘
```

### 6.3 Menu Items

| Button          | Action                              | Modal?       |
| --------------- | ----------------------------------- | ------------ |
| ⟳ Restart Life  | Resets all life to initial value    | No — instant |
| ⚙️ Initial Life | Opens numeric selector              | Yes — modal  |
| 👥 Players      | Opens player count/color assignment | Yes — modal  |
| ⚖️ AI Judge     | Opens judge chat interface          | Yes — modal  |

Tap the center button again or tap outside the menu to close.

---

## 7. MODAL SYSTEM

### 7.1 Dialog Pattern

All modals use the native `<dialog>` element with `aria-modal="true"`. No custom
modal library.

```html
<dialog aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Initial Life</h2>
  <!-- content -->
  <button aria-label="Close" autofocus>✕</button>
</dialog>
```

### 7.2 Modal: Initial Life Selector

- Grid of preset buttons: **20** (Standard), **30** (2HG), **40** (Commander),
  **60** (Two-Headed Giant), **Custom** (numpad)
- Each button shows the number large, with format label below
- Selected state highlighted

### 7.3 Modal: Player Selector

- Stepper or grid: 2 | 3 | 4 | 5 | 6 players
- Each player slot shows a mana color picker (5 dots: W, U, B, R, G)
- "Start Game" button to confirm

### 7.4 Modal: AI Judge

- Chat-style interface with message bubbles
- Text input at bottom
- Streaming response display
- "Ask about a card or rule…" placeholder
- Maximized modal — takes almost full screen for readability

### 7.5 Modal: Color Picker (per player)

- Triggered by gear icon on player zone
- Shows 5 mana symbols as large tappable options
- Optional guild color grid below (future)
- Preview of how the zone will look
- "Apply" button

---

## 8. GESTURES & INTERACTIONS

### 8.1 Life Adjustment

| Gesture               | Result                                           |
| --------------------- | ------------------------------------------------ |
| Tap [+]               | +1 life                                          |
| Tap [-]               | -1 life                                          |
| Hold [+]              | Rapid increment (accelerates: +5 → +10 after 1s) |
| Hold [-]              | Rapid decrement (accelerates: -5 → -10 after 1s) |
| Double-tap life total | Opens numpad for exact entry                     |

### 8.2 Swipe Gestures

| Gesture                | Result                                            |
| ---------------------- | ------------------------------------------------- |
| Swipe left on zone     | Reveals commander damage overlay                  |
| Swipe right on zone    | Reveals counters overlay (poison, energy, etc.)   |
| Swipe down from center | Clears commander damage overlay (returns to life) |

### 8.3 Commander Damage Overlay

Compact grid showing opponents' names (by color) and damage dealt. Tap + on any
row to add commander damage. Auto-tracks lethal (21 for Commander).

### 8.4 Counters Overlay

Scrollable list of counter types:

- ☠️ Poison (10 = dead)
- ⚡ Energy
- ✦ Experience
- ⏳ Time / suspend
- Custom counter (name your own)

Each counter has +/- and a value display.

---

## 9. RESPONSIVE BEHAVIOR

### 9.1 Breakpoints (via Tailwind)

| Breakpoint | Width    | Behavior                                  |
| ---------- | -------- | ----------------------------------------- |
| Default    | < 480px  | Single-column stack, portrait-only        |
| `sm:`      | ≥ 480px  | 2-column grid possible                    |
| `md:`      | ≥ 768px  | 2×2 grid, landscape mode activates        |
| `lg:`      | ≥ 1024px | Full 2×3 grid for 6 players               |
| `xl:`      | ≥ 1440px | Larger life totals, more generous spacing |

### 9.2 Orientation

- **Portrait (< md):** 2 players (stacked) or 3 players (asymmetric)
- **Landscape (≥ md):** 4-6 players (grid)
- **Auto-rotate:** The layout adapts to orientation changes live

### 9.3 Minimum Touch Targets

Every interactive element: **≥ 44×44px** (48×48px preferred per WCAG).

---

## 10. COMPONENT TREE

```
app/
├── layout.tsx              ← Root layout, Archivo font loading, metadata
├── page.tsx                ← Game board entry point (Client Component)
├── globals.css             ← Tailwind imports, design tokens, animations
└── api/
    └── judge/
        └── route.ts        ← AI Judge streaming endpoint

components/
├── ui/
│   ├── button.tsx          ← Primitive button (variants: primary, icon, pill)
│   └── dialog.tsx           ← Modal wrapper (native <dialog>)
└── features/
    ├── game-board.tsx       ← Layout grid orchestrator (2-6 players)
    ├── player-zone.tsx      ← Single player's life/controls/swipe zone
    ├── spellbook-menu.tsx   ← Central floating button + half-screen menu
    ├── life-display.tsx     ← Life total number (Archivo Black, massive)
    ├── life-buttons.tsx     ← +/- controls with hold acceleration
    ├── commander-damage.tsx ← Swipe overlay for commander damage tracking
    ├── counters-overlay.tsx ← Swipe overlay for poison/energy/etc.
    ├── color-picker.tsx     ← Mana color/guild selector modal
    ├── initial-life-modal.tsx
    ├── player-selector-modal.tsx
    ├── judge-chat.tsx       ← AI Judge chat interface
    └── dice-roller.tsx      ← D6/D20/D10 roller (bonus feature)

lib/
├── state/
│   └── game-state.ts       ← Discriminated union state machine
├── types.ts                ← Shared TypeScript types
└── services/
    └── scryfall.ts          ← Card art search / autocomplete

hooks/
├── use-life-adjustment.ts  ← Tap/hold acceleration logic
├── use-swipe.ts            ← Swipe gesture detection
└── use-game-state.ts       ← State machine hook

public/
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service worker
├── favicon/                ← Favicon bundle
└── robots.txt
```

---

## 11. AI JUDGE — INTEGRATION POINTS

### 11.1 Route

`app/api/judge/route.ts` — streaming POST endpoint using `@openrouter/sdk`.

### 11.2 Client Component

`components/features/judge-chat.tsx` — `'use client'` for interactivity.

### 11.3 State Boundaries

- Judge chat is ephemeral (session state only)
- No chat history persists beyond the session
- Game state is in `lib/state/` — also session-local

### 11.4 Voice Assistant (future scope — §14)

Voice input button in the judge chat input bar. Uses Web Speech API (native, no
library). No offline AI — the speech-to-text and LLM judge both require
connectivity for v1.

---

## 12. PERFORMANCE BUDGETS

| Metric                       | Budget                    |
| ---------------------------- | ------------------------- |
| **Total JS (gzipped)**       | < 100 KB                  |
| **Total CSS (gzipped)**      | < 20 KB (Tailwind purged) |
| **LCP**                      | < 2.5s                    |
| **INP**                      | < 200ms                   |
| **CLS**                      | < 0.1                     |
| **Lighthouse Performance**   | ≥ 90                      |
| **Lighthouse Accessibility** | 100                       |

---

## 13. ACCESSIBILITY REQUIREMENTS

WCAG 2.2 Level AA:

- **Color contrast:** 4.5:1 text, 3:1 large text. Auto-select white/black text
  on mana-colored backgrounds based on luminance.
- **Touch targets:** ≥ 44×44px minimum.
- **Keyboard navigation:** Tab through all controls, visible focus rings.
- **Screen reader:** Player zones announce "Player 1: 40 life" on focus. Buttons
  announce "+1 life", "-1 life". Swipe gestures have button alternatives.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables ALL swipe
  animations, uses instant show/hide.

---

## 14. FUTURE SCOPE (Designated for Later Phases)

These are recognized in the design but deferred:

| Feature                                | Phase   |
| -------------------------------------- | ------- |
| Guild color combos (10 2-color blends) | Phase 2 |
| Voice input for AI Judge               | Phase 2 |
| Card art backgrounds from Scryfall     | Phase 2 |
| Match history & statistics             | Phase 2 |
| Turn tracker / timer                   | Phase 2 |
| Dice roller (D6, D20, coin flip)       | Phase 2 |
| Game state undo/redo stack             | Phase 2 |
| Offline AI rules engine                | Phase 3 |
| Planechase / Archenemy support         | Phase 3 |

---

## 15. AGENT RESPONSIBILITY MATRIX

| Agent                        | Responsible For                                 | Must Read |
| ---------------------------- | ----------------------------------------------- | --------- |
| `@orchestrator`              | Planning, delegation, gates, DESIGN.md          | §1-15     |
| `@frontend-dev`              | React components, Tailwind styling, game layout | §2-10     |
| `@ai-engineer`               | AI Judge route, OpenRouter SDK, RAG pipeline    | §11       |
| `@code-review`               | Compliance audit against this contract          | §1-15     |
| `@playwright-test-planner`   | Test scenarios from component tree (§10)        | §5-10     |
| `@playwright-test-generator` | Test code                                       | §5-10     |
| `@playwright-test-healer`    | Test execution                                  | §5-10     |
| `@release-manager`           | Git ops, PRs, tags                              | —         |

---

## 16. CHANGE LOG

| Version | Date       | Author        | Changes                                            |
| ------- | ---------- | ------------- | -------------------------------------------------- |
| 1.0     | 2026-07-16 | @orchestrator | Initial design contract from Design Thinking phase |

---

## 17. ENFORCEMENT

> **This document is a binding contract.** Any agent violating these rules will
> have their output rejected by `@code-review` and the pipeline will halt. No
> exceptions.

**To propose a change:** `@orchestrator` presents the change to the user,
receives explicit approval ("Approved" or "Aprobado"), then updates this
document and notifies all agents.

---

_End of DESIGN.md_
