# DESIGN.md — Project Design Contract

**Version:** 1.0  
**Date:** 2026-07-16  
**Status:** Active Contract — All agents MUST comply  
**Location:** `/DESIGN.md` (project root)

> **Scope:** This document defines the visual and interaction design contract.
> For project structure, configuration, workflows, and agent protocols, see
> `AGENTS.md`.

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
| **Color Strategy**       | Warm parchment base. Player identity via MTG mana colors.                                                                                                                                                       |
| **Layout Approach**      | Grid-based player zones. 2p (vertical split), 4p (2×2), 6p (2×3). Top/left rows rotated 180°. Responsive to orientation.                                                                                        |
| **Background Treatment** | Solid block color per player zone — the color IS the background. Base shell is warm parchment.                                                                                                                  |
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

## 2. COLOR PALETTE — MTG MANA COLORS

### 2.1 Player Identity Colors

Each player selects a mana color. The color FILLS their zone background. No
player name — the color is their identity.

| Mana         | Hex       | Role                   |
| ------------ | --------- | ---------------------- |
| 🟡 White (W) | `#F8E7B0` | Warm, sheltering       |
| 🔵 Blue (U)  | `#3B8EFF` | Electric, intellectual |
| ⚫ Black (B) | `#5C4E4E` | Ambitious, dark        |
| 🔴 Red (R)   | `#E53935` | Passionate, aggressive |
| 🟢 Green (G) | `#43A047` | Natural, wild          |
| ✦ Colorless  | `#9E9E9E` | Neutral/eldrazi        |

Text on these backgrounds auto-selects warm white (`#FAF8F5`) or warm near-black
(`#1A1A1A`) based on luminance, maintaining WCAG 4.5:1 contrast.

### 2.2 UI & Shell Colors

| Token                  | Hex                | Usage                                             |
| ---------------------- | ------------------ | ------------------------------------------------- |
| Background overlay     | `#1a1a1a`          | Commander damage and counters overlay backgrounds |
| Belt / AI Judge        | `#000000`          | Spellbook belt, AI Judge modal backdrop           |
| Modal backdrop         | `rgba(0,0,0,0.35)` | Config modals (life, players, color picker)       |
| Danger red             | `#D50000`          | Life total ≤ 0, commander damage ≥ 21             |
| Warm white (text)      | `#FAF8F5`          | Life / UI text on dark mana backgrounds           |
| Warm near-black (text) | `#1A1A1A`          | Life / UI text on light mana backgrounds          |

### 2.3 Guild Color Combos (future scope — §10)

Guild blend colors can be added as a secondary color mode once the 5 base mana
colors are stable.

---

## 3. TYPOGRAPHY

### 3.1 Font Loading

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

### 3.2 Type Scale

The life total is the hero. Everything else is secondary.

| Token            | Value                        | Weight      | Usage                       |
| ---------------- | ---------------------------- | ----------- | --------------------------- |
| `--text-life`    | `clamp(4rem, 15vw, 12rem)`   | Black 900   | Life total number           |
| `--text-display` | `clamp(2.5rem, 6vw, 5rem)`   | Black 900   | Commander damage big number |
| `--text-heading` | `clamp(1.5rem, 3vw, 2.5rem)` | Bold 700    | Modal titles                |
| `--text-body`    | `1rem`                       | Medium 500  | UI labels, buttons          |
| `--text-body-sm` | `0.875rem`                   | Regular 400 | Captions, secondary labels  |
| `--text-caption` | `0.75rem`                    | Regular 400 | Small badges                |

### 3.3 Line Heights

```css
--leading-none: 0.9; /* Life totals — tight, massive */
--leading-tight: 1.1; /* Commander damage */
--leading-base: 1.4; /* Body text */
```

---

## 4. LAYOUT SYSTEM

### 4.1 Player Zone Grids

The layout auto-adapts to player count and screen orientation. In all
configurations, the spellbook belt (§5) divides the screen: top-row players sit
above the line, bottom-row players sit below it.

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
┌───────────────────────────────────┐
│                                   │
│            Player 1               │  180° rotation
│              40 ★                 │  → text faces TOP
│           [+]  [-]                │
│                                   │
├────────────────┬──────────────────┤
│   Player 2     │   Player 3       │
│   37 ★         │   41 ★           │  P2: −90° rotation → faces LEFT
│  [+]  [-]      │  [+]  [-]        │  P3: 90° rotation → faces RIGHT
└────────────────┴──────────────────┘
```

**5 Players (Portrait — 1 full-width + 2×2 grid)**

```
┌──────────────────────────────────────┐
│                                      │
│              Player 5                │  180° rotation
│                40 ★                  │  → text faces TOP
│             [+]  [-]                 │
│                                      │
├──────────┬──────────┤
│ Player 1 │ Player 2 │  P1: −90° rotation → faces LEFT
│   40 ★   │   38 ★   │  P2: 90° rotation → faces RIGHT
├──────────┼──────────┤
│ Player 3 │ Player 4 │  P3: −90° rotation → faces LEFT
│   32 ★   │   41 ★   │  P4: 90° rotation → faces RIGHT
└──────────┴──────────┘
```

### 4.2 Player Zone Anatomy

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
- **Lethal state:** Life total turns danger red (`#D50000`) when at 0 or below.
- **Swipe left:** Overlays commander damage grid — per-opponent damage trackers,
  compact.
- **Swipe right:** Overlays counters — poison, energy, experience, etc.
- **Gear icon:** Opens modal color picker with mana symbols.
- **Double-tap life total:** Opens numpad for direct input.

### 4.3 Zone Rotation

Player zones are rotated so text is readable from the table side each player
occupies. Three rotation values are used:

| Rotation | Angle              | CSS              | Applies to                                                       |
| -------- | ------------------ | ---------------- | ---------------------------------------------------------------- |
| 180°     | Full flip          | `rotate(180deg)` | Top-side players: P1 (2p, 3p), P1/P2 (4p), top row (6p), P5 (5p) |
| −90°     | Quarter turn left  | `rotate(-90deg)` | Left-side players: P2 (3p), P1/P3 (5p)                           |
| 90°      | Quarter turn right | `rotate(90deg)`  | Right-side players: P3 (3p), P2/P4 (5p)                          |
| None     | —                  | —                | Bottom-side players facing the user                              |

Rotation is applied to the zone container's wrapper — the interior layout is
identical, just oriented for the player's side of the table.

---

## 5. CENTRAL SPELLBOOK MENU

### 5.1 Visual — The Stretched Rope

```
┌──────────────────────────────────────────┐
│             Player zones above           │
│  ══════════════════●══════════════════   │  ← Horizontal line, full width
│                     M                    │  ← M logo, 56×56px, centered
│             Player zones below           │
└──────────────────────────────────────────┘
```

A horizontal line spans the full screen width, broken at the center by a
circular button displaying the stylized "M" (planeswalker symbol silhouette or
abstract geometric M). The visual metaphor is a stretched rope with an insignia
at its midpoint — a subtle divider between top and bottom player zones.

**Line:** Dark stroke, low opacity. Extends edge-to-edge. The belt line is the
permanent dividing boundary between top and bottom player zones — player zones
never cross it, whether the belt is open or closed.

**M Logo:** 56×56px (≥44px minimum touch target). Fixed at screen center.
Z-index: 50 (above game board, below modals).

### 5.2 Interaction — The Boxer Belt

Tap M → a black horizontal band expands across the full screen width. The M
stays anchored at center. Four action icons spread outward — two to the left,
two to the right. The visual metaphor is a championship belt: an opaque black
band creating stark contrast against the colored player zones behind it.

```
│            (Player zones above)          │
┌──────────────────────────────────────────┐
│  ██████████████████████████████████████  │  ← Black belt, full width (~72px)
│  █  ⚙️    ⟳    ● M ●    ⚖️    👥  █   │  ← Icons flanking M
│  ██████████████████████████████████████  │
├──────────────────────────────────────────┤
│            (Player zones below)          │
```

- **Belt height:** ~72px. Opaque black (`#000000` or near-black).
- **M stays centered.** Does not move — it anchors the composition.
- **Left side (near → far):** ⟳ Restart Life, ⚙️ Initial Life
- **Right side (near → far):** ⚖️ AI Judge, 👥 Players
- **Close:** Tap M again or tap outside the belt → icons collapse back to
  center, belt retracts.

### 5.3 Menu Items

| Icon | Action       | Side          | Modal?       |
| ---- | ------------ | ------------- | ------------ |
| ⟳    | Restart Life | Left, near M  | No — instant |
| ⚙️   | Initial Life | Left, far     | Yes — modal  |
| ⚖️   | AI Judge     | Right, near M | Yes — modal  |
| 👥   | Players      | Right, far    | Yes — modal  |

Gameplay actions (⟳ restart, ⚖️ judge) sit closer to center for quick thumb
access. Setup actions (⚙️ life, 👥 players) sit on the outer edges.

---

## 6. MODAL SYSTEM

### 6.1 Dialog Pattern

All modals use the native `<dialog>` element with `aria-modal="true"`. No custom
modal library.

**Backdrop:**

| Modal                                       | Backdrop                                              |
| ------------------------------------------- | ----------------------------------------------------- |
| Initial Life, Player Selector, Color Picker | Black at 35% opacity (`rgba(0,0,0,0.35)`)             |
| AI Judge                                    | Solid black (`#000000`) — full focus, no game visible |

```html
<dialog aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Initial Life</h2>
  <!-- content -->
  <button aria-label="Close" autofocus>✕</button>
</dialog>
```

### 6.2 Modal: Initial Life Selector

- Grid of preset buttons: **20** (Standard), **30** (2HG), **40** (Commander),
  **60** (Two-Headed Giant), **Custom** (numpad)
- Each button shows the number large, with format label below
- Selected state highlighted

### 6.3 Modal: Player Selector

- Stepper or grid: 2 | 3 | 4 | 5 | 6 players
- Each player slot shows a mana color picker (5 dots: W, U, B, R, G)
- "Start Game" button to confirm

### 6.4 Modal: AI Judge

- Chat-style interface with message bubbles
- Text input at bottom
- Streaming response display
- "Ask about a card or rule…" placeholder
- Maximized modal — takes almost full screen for readability
- Backdrop: solid black (`#000000`) — total focus on the Judge

### 6.5 Modal: Color Picker (per player)

- Triggered by gear icon on player zone
- Shows 5 mana symbols as large tappable options
- Optional guild color grid below (future)
- Preview of how the zone will look
- "Apply" button

---

## 7. GESTURES & INTERACTIONS

### 7.1 Life Adjustment

| Gesture               | Result                                           |
| --------------------- | ------------------------------------------------ |
| Tap [+]               | +1 life                                          |
| Tap [-]               | -1 life                                          |
| Hold [+]              | Rapid increment (accelerates: +5 → +10 after 1s) |
| Hold [-]              | Rapid decrement (accelerates: -5 → -10 after 1s) |
| Double-tap life total | Opens numpad for exact entry                     |

### 7.2 Swipe Gestures

| Gesture                       | Result                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| Swipe left on zone            | Reveals commander damage overlay                                 |
| Swipe right on zone           | Reveals counters overlay (poison, energy, etc.)                  |
| Swipe along X-axis on overlay | Closes the overlay (returns to life) — works in either direction |

### 7.3 Commander Damage Overlay

Each player tracks how much commander damage they have taken from each
commander. One column per commander (one per opponent). 2 columns for 2–4
players, 3 columns for 5–6 players.

**Background:** Solid `#1a1a1a` (near-black, warm undertone).

Each column:

```
┌──────────────────────┐
│   ┌──────┐           │
│   │  ⚔️  │  12  [+]  │  ← Pill (opponent's color), symbol, total, + button
│   └──────┘           │
└──────────────────────┘
```

- **Pill:** Rounded pill. Background = opponent's mana color. Center = commander
  symbol (⚔️).
- **Damage total:** Alongside the pill. Archivo Bold. Text color auto-selects
  warm white (`#FAF8F5`) or warm near-black (`#1A1A1A`) per luminance.
- **+ button:** Tap = +1 commander damage. Hold = accelerate (±5 → +10 after 1s)
  — same criteria as §7.1 life adjustment.
- **Lethal indicator:** When any opponent's commander damage reaches 21+, the
  current player loses the game — both the commander damage value and the
  current player's life total turn lethal red (`#D50000`).

### 7.4 Counters Overlay

Always a 2-column grid. Each column is a counter type with a pill, value, +/-
controls, and a delete button.

**Background:** Solid `#1a1a1a` (near-black, warm undertone).

**Default counters (always present as placeholders):**

- ☠️ Poison (max 10 = lethal)
- ⚡ Energy
- ✦ Experience
- ⏳ Time / Suspend

**Layout per column:**

```
┌──────────────────────────────────────┐
│  ┌──────┐                            │
│  │  ☠️  │  3  [-]  [+]  [✕]          │  ← Pill (colorless #9E9E9E), icon, value, controls, delete
│  └──────┘                            │
└──────────────────────────────────────┘
```

- **Pill:** Rounded pill. Background = colorless (`#9E9E9E`). Center = counter
  icon (☠️/⚡/✦/⏳ for defaults, first letter of name for custom counters).
- **Value:** Alongside the pill. Archivo Bold. Text color auto-selects warm
  white (`#FAF8F5`) or warm near-black (`#1A1A1A`) per luminance.
- **[-] [+] buttons:** Tap = ±1. Hold = accelerate (±5 → ±10 after 1s) — same
  criteria as §7.1 life adjustment.
- **[✕] delete button:** Removes the counter column. Shown on every counter —
  defaults and custom alike.
- **+ button (bottom-right):** Opens a prompt to add a custom counter (name +
  initial value). Custom counters use the first letter of their name as the pill
  icon instead of a symbol.
- **Lethal indicator:** Poison at 10+ turns both the poison counter value
  **and** the player's life total lethal red (`#D50000`).

**Grid:** Always 2 columns. Rows fill left-to-right, top-to-bottom. The 4
defaults occupy the first 2 rows. Custom counters fill subsequent rows.

---

## 8. RESPONSIVE BEHAVIOR

### 8.1 Breakpoints (via Tailwind)

| Breakpoint | Width    | Behavior                                  |
| ---------- | -------- | ----------------------------------------- |
| Default    | < 480px  | Single-column stack, portrait-only        |
| `sm:`      | ≥ 480px  | 2-column grid possible                    |
| `md:`      | ≥ 768px  | 2-column layouts, 2×2 grid for landscape  |
| `lg:`      | ≥ 1024px | Full 2×3 grid for 6 players               |
| `xl:`      | ≥ 1440px | Larger life totals, more generous spacing |

### 8.2 Orientation

- **Portrait (2, 3, and 5 players):** Stacked and asymmetric split layouts. Text
  rotated per player position using −90°, 90°, or 180° transforms.
- **Landscape (4 and 6 players):** Grid layouts. Top row rotated 180°.
- **Orientation lock:** The accelerometer is disabled — the app locks to
  portrait via the PWA manifest (`"orientation": "portrait"`) and
  `screen.orientation.lock()`. Player count determines whether the layout
  renders as portrait or landscape within that locked viewport.

### 8.3 Minimum Touch Targets

Every interactive element: **≥ 44×44px** (48×48px preferred per WCAG).

---

## 9. ACCESSIBILITY REQUIREMENTS

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

## 10. FUTURE SCOPE (Designated for Later Phases)

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

_End of DESIGN.md_
