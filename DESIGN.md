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
| 🟡 White (W) | `#F8F6D8` | Warm, sheltering       |
| 🔵 Blue (U)  | `#C1D7E9` | Electric, intellectual |
| ⚫ Black (B) | `#666565` | Ambitious, dark        |
| 🔴 Red (R)   | `#E49977` | Passionate, aggressive |
| 🟢 Green (G) | `#A3C095` | Natural, wild          |
| ✦ Colorless  | `#CAC5C0` | Neutral/eldrazi        |

Text on these backgrounds auto-selects warm white (`#FAF8F5`) or warm near-black
(`#1A1A1A`) based on luminance, maintaining WCAG 4.5:1 contrast.

### 2.2 UI & Shell Colors

| Token                  | Hex                | Usage                                                      |
| ---------------------- | ------------------ | ---------------------------------------------------------- |
| Background overlay     | `#1a1a1a`          | Commander damage and counters overlay backgrounds          |
| Belt / AI Judge        | `#000000`          | Spellbook belt, AI Judge modal backdrop                    |
| Modal background       | `rgba(0,0,0,0.80)` | Config modals (life, players, color picker)                |
| Danger red             | `#D50000`          | Life total ≤ 0, commander damage ≥ 21                      |
| Warm white (text)      | `#FAF8F5`          | Life / UI text on overlay & belt backgrounds               |
| Warm near-black (text) | `#1A1A1A`          | Life / UI text on light mana backgrounds                   |
| Icon silhouette dark   | `#0D0F0F`          | Silhouette fill for mana, shards, clans, guild             |
| Icon silhouette light  | `#FAF8F5`          | Silhouette fill for counters, player-actions, Planeswalker |

### 2.3 Guild & Clan Symbols (future scope — §10)

Guild and clan color blends can be added as a secondary color mode once the 5
base mana colors are stable.

### 2.4 Icon System

All MTG symbols are inline SVG React components. No external `.svg` imports.
Silhouette colors use the `iconDark` and `iconLight` tokens from §2.2.

| Icon type                | Background                      | Silhouette fill | Selected via                     |
| ------------------------ | ------------------------------- | --------------- | -------------------------------- |
| Mana                     | Solid mana color circle         | `iconDark`      | `ManaSelector`                   |
| Guild                    | 2-color hard-split circle       | `iconDark`      | `GuildSelector`                  |
| Clan / Shard             | 3-color hard-split circle       | `iconDark`      | `ClanSelector` / `ShardSelector` |
| Counter                  | None — sits directly on overlay | `iconLight`     | `CounterSelector`                |
| Player-action            | None                            | `iconLight`     | `PlayerActionSelector`           |
| Planeswalker (Commander) | None — sits directly on overlay | `iconLight`     | Direct import                    |

Faction backgrounds use `linear-gradient(to bottom right, ...)` with **hard
color stops** — no blending:

- **Guilds (2 colors):**
  `linear-gradient(to bottom right, color1 0%, color1 50%, color2 50%, color2 100%)`
  — diagonal split, colors meet along the center line.
- **Clans / Shards (3 colors):**
  `linear-gradient(to bottom right, color1 0%, color1 33.3%, color2 33.3%, color2 66.6%, color3 66.6%, color3 100%)`
  — three diagonal bands, hard edges at 33.3% and 66.6%.

Color stops are defined in `GUILD_COLORS`, `CLAN_COLORS`, and `SHARD_COLORS`.

#### Mana Symbols (`shared/components/icons/mana/`)

White, Blue, Black, Red, Green, Colorless. Used in color picker modals, player
zone indicators, and mana-cost displays. Circle background filled with the mana
color. Silhouette uses `iconDark`. Selected via `ManaSelector`.

#### Counter Symbols (`shared/components/icons/counters/`)

Poison, Energy, Experience, Time. Used in the counters overlay (§7.4). No
background — the icon sits directly on the overlay surface. Silhouette uses
`iconLight`. Selected via `CounterSelector`.

#### Commander Symbol (`shared/components/icons/PlaneswalkerSymbol.tsx`)

The MTG planeswalker icon. Used **exclusively** in the commander damage overlay
(§7.3). **Not a counter** — it bypasses `CounterSelector` and is imported
directly by the commander damage component. No background. Silhouette uses
`iconLight`.

#### Guild Symbols (`shared/components/icons/guilds/`)

All 10 Ravnica guilds. Phase 2 (§10). Circle background with a 2-color hard
diagonal split using each guild's color pair from `GUILD_COLORS`. Silhouette
uses `iconDark`. Selected via `GuildSelector`.

#### Clan Symbols (`shared/components/icons/clans/`)

Abzan, Jeskai, Mardu, Sultai, Temur. Phase 2 (§10). Circle background with a
3-color hard diagonal split from `CLAN_COLORS`. Silhouette uses `iconDark`.
Selected via `ClanSelector`.

#### Shard Symbols (`shared/components/icons/shards/`)

Bant, Esper, Grixis, Jund, Naya. Phase 2 (§10). Circle background with a 3-color
hard diagonal split from `SHARD_COLORS`. Silhouette uses `iconDark`. Selected
via `ShardSelector`.

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
┌─────────────────────┐
│                     │
│      Player 5       │  180° rotation
│         40 ★        │  → text faces TOP
│      [+]  [-]       │
│                     │
├──────────┬──────────┤
│ Player 1 │ Player 2 │  P1: −90° rotation → faces LEFT
│   40 ★   │   38 ★   │  P2: 90° rotation → faces RIGHT
├──────────┼──────────┤
│ Player 3 │ Player 4 │  P3: −90° rotation → faces LEFT
│   32 ★   │   41 ★   │  P4: 90° rotation → faces RIGHT
└──────────┴──────────┘
```

### 4.2 Player Zone Anatomy

Each player zone is a three-column grid. The entire zone is interactive: each
column handles taps and holds, while the full area detects swipe gestures.

```
┌───────────┬───────────┬───────────┐
│           │           │      ⚙️   │
│           │           │           │
│    [-]    │    40     │    [+]    │
│           │           │           │
│           │           │           │
│           │           │           │
│           │           │           │
└───────────┴───────────┴───────────┘
  ◄─────── full-zone swipe ───────►
```

| Column | Width | Content                                                                                   |
| ------ | ----- | ----------------------------------------------------------------------------------------- |
| Left   | 33.3% | **[-]** — decrement life. No border, no rounded corners. The entire column is the button. |
| Center | 33.3% | **Life total** — `--text-life`, Archivo Black 900, vertically and horizontally centered.  |
| Right  | 33.3% | **[+]** — increment life. Same borderless treatment as [-]. Entire column is the button.  |

- **Top-right:** Gear icon (color picker trigger). Sits in the right column's
  top corner, outside the button hit area.
- **[-] / [+] buttons use the full column:** No border, no `border-radius`, no
  background distinction from the player zone color. The button is
  indistinguishable from the background — only the `-` / `+` label reveals the
  hit area. Text color auto-selects warm white (`#FAF8F5`) or warm near-black
  (`#1A1A1A`) based on the player's mana color luminance, matching the life
  total.
- **Press feedback:** On `pointerdown`, the touched column's background overlays
  with `rgba(0, 0, 0, 0.08)` (8% black). The overlay fades in over 150ms and
  fades out over 150ms on `pointerup`. Implemented as a CSS transition on the
  column background — no additional DOM element, no `pointer-events`
  interference. Hold and accelerate behaviors are unaffected since the overlay
  is purely a visual property of the column itself, not a separate layer.
- **Life adjustment:** Tap [-] or [+] → ±1. Hold → accelerate (±10 after 1s).
  Double-tap the life total → opens numpad for exact entry.
- **Lethal state:** Life total turns danger red (`#D50000`) when at 0 or below.
  The +/- columns remain unaffected.
- **Swipe gestures (full player zone):** Swipe left anywhere on the zone →
  commander damage overlay. Swipe right → counters overlay. The gesture detector
  differentiates swipes from taps: any horizontal movement ≥10px detected before
  300ms is treated as a swipe. Vertical movement is ignored. Taps and holds on
  the +/- buttons are unaffected since they involve no horizontal movement.
- **After swipe (overlay open):** Swiping in either direction along the X-axis
  closes the overlay and returns to the life total view.

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
circular button displaying the MTG logo (`public/images/mtg-logo.png`). The
visual metaphor is a stretched rope with an insignia at its midpoint — a subtle
divider between top and bottom player zones.

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

Triggered by the gear icon on each player zone. 80/20 vertical split — a color
selection area above, a fixed filter strip below.

```
┌──────────────────────────┐
│                          │
│    COLOR SELECTION AREA  │  ← 80% height
│   (wheel or dual wheels) │
│                          │
├──────────────────────────┤
│ [mana] guild clan shard  │  ← 20% height, never changes
│      WUBRG  Colorless    │
└──────────────────────────┘
```

#### Filter Strip (bottom 20%)

Six fixed items in a horizontal row. This strip **never changes** — it is always
visible regardless of which wheel is shown above. The active filter is visually
highlighted (filled background, inverted text) so the user always knows which
wheel they are viewing.

| Item          | Type   | Action                                                         |
| ------------- | ------ | -------------------------------------------------------------- |
| **mana**      | Tab    | Shows the 5-color WUBRG mana wheel (default on open).          |
| **guild**     | Tab    | Shows two 5-symbol wheels side-by-side (10 Ravnica guilds).    |
| **clan**      | Tab    | Shows a single 5-symbol wheel (5 Tarkir clans).                |
| **shard**     | Tab    | Shows a single 5-symbol wheel (5 Alara shards).                |
| **WUBRG**     | Action | Applies 5-color gradient background. Closes modal immediately. |
| **Colorless** | Action | Applies colorless solid background. Closes modal immediately.  |

#### Mana Tab (default)

A circular wheel with the 5 mana symbols arranged clockwise in **WUBRG order**:
White → Blue → Black → Red → Green. Each symbol is a tappable button (≥44px),
rendered via `ManaSelector`.

- **Tap a mana symbol** → the player zone background becomes that solid mana
  color → modal closes immediately. No "Apply" button needed.

#### Guild Tab

Two 5-symbol wheels placed side-by-side (10 Ravnica guilds won't fit a single
wheel). Each symbol is rendered via `GuildSelector`.

- **Tap a guild symbol** → the player zone background becomes a
  `linear-gradient(to bottom right, color1 0%, color1 50%, color2 50%, color2 100%)`
  using that guild's two mana colors → modal closes immediately.
- A small guild badge (24×24px) appears in the bottom‑right corner of the player
  zone.

#### Clan Tab

A single 5-symbol wheel (same circular layout as the mana tab). Each symbol is
rendered via `ClanSelector`.

- **Tap a clan symbol** → the player zone background becomes a
  `linear-gradient(to bottom right, color1 0%, color1 33.3%, color2 33.3%, color2 66.6%, color3 66.6%, color3 100%)`
  using that clan's three mana colors → modal closes immediately.
- A small clan badge (24×24px) appears in the bottom‑right corner.

#### Shard Tab

Same as clan — single 5-symbol wheel, rendered via `ShardSelector`. Tap a shard
→ 3-color `linear-gradient(to bottom right, ...)` → close. Shard badge (24×24px)
in bottom‑right.

#### Behavior Summary

| Selection         | Closes modal? | Player zone result                                                                                               |
| ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Single mana color | On tap        | Solid mana color                                                                                                 |
| WUBRG             | Immediately   | 5-color `linear-gradient(to bottom right, W 0%, W 20%, U 20%, U 40%, B 40%, B 60%, R 60%, R 80%, G 80%, G 100%)` |
| Colorless         | Immediately   | Solid `#CAC5C0`                                                                                                  |
| Guild             | On tap        | 2-color gradient + guild badge (bottom‑right)                                                                    |
| Clan              | On tap        | 3-color gradient + clan badge (bottom‑right)                                                                     |
| Shard             | On tap        | 3-color gradient + shard badge (bottom‑right)                                                                    |

- No standalone "Apply" button — every selection confirms instantly.
- The player zone previews the change in real-time inside the modal.
- Faction badges are rendered via `GuildSelector`, `ClanSelector`, or
  `ShardSelector` at 24×24px and placed in the bottom‑right corner of the player
  zone.
- The filter strip always shows the highlighted active tab — no mode is hidden
  from the user.

---

## 7. GESTURES & INTERACTIONS

### 7.1 Life Adjustment

| Gesture               | Result                         |
| --------------------- | ------------------------------ |
| Tap [+]               | +1 life                        |
| Tap [-]               | -1 life                        |
| Hold [+]              | Rapid increment (±10 after 1s) |
| Hold [-]              | Rapid decrement (±10 after 1s) |
| Double-tap life total | Opens numpad for exact entry   |

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

- **Pill:** Rounded pill. Background = opponent's mana color. Center =
  `PlaneswalkerSymbol` (inline SVG, white fill on opponent's color background).
- **Damage total:** Alongside the pill. Archivo Bold. Text color auto-selects
  warm white (`#FAF8F5`) or warm near-black (`#1A1A1A`) per luminance.
- **+ button:** Tap = +1 commander damage. Hold = accelerate (+10 after 1s) —
  same criteria as §7.1 life adjustment.
- **Life reduction:** Each point of commander damage also reduces the current
  player's life total by the same amount. `adjustCommanderDamage(+3)` → life −3,
  commander damage +3.
- **Lethal indicator:** When any opponent's commander damage reaches 21+, the
  current player loses the game — both the commander damage value and the
  current player's life total turn lethal red (`#D50000`).

### 7.4 Counters Overlay

Always a 2-column grid. Each column is a counter type with an icon, value, +/-
controls, and a delete button.

**Background:** Solid `#1a1a1a` (near-black, warm undertone). Counter icons sit
directly on the background — **no pill, no rounded container.**

**Default counters (always present as placeholders):**

- ☠️ Poison (max 10 = lethal)
- ⚡ Energy
- ✦ Experience
- ⏳ Time / Suspend

**Note:** `PlaneswalkerSymbol` is not a counter — it belongs to the commander
damage overlay (§7.3).

**Layout per column:**

```
┌────────────────────────────────────────────┐
│  ☠️    3    [-]  [+]  [✕]                   │  ← Icon, value, controls, delete
└────────────────────────────────────────────┘
```

- **Icon:** Counter symbol drawn with `iconLight` (`#FAF8F5`) silhouette. Sits
  directly on the overlay background (`#1a1a1a`). No pill, no background
  container.
- **Value:** Alongside the icon. Archivo Bold. Text color auto-selects warm
  white (`#FAF8F5`) per luminance.
- **[-] [+] buttons:** Tap = ±1. Hold = accelerate (±10 after 1s).
- **[✕] delete button:** Removes the counter column. Shown on every counter.
- **+ button (bottom-right):** Opens a prompt asking for the custom counter name
  (initial value is always 0). Custom counters use a rounded pill — background
  `#CAC5C0` (colorless), icon `iconDark` (`#0D0F0F`) — displaying the first
  letter of their name. This visually distinguishes custom counters from the
  pill-free default counters.
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
| Offline AI rules engine                | Phase 3 |

---

_End of DESIGN.md_
