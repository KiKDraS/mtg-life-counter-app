# DESIGN.md — Project Design Contract

**Status:** Active Contract — All agents MUST comply

> Scope: visual & interaction design. For workflow/agent protocols see
> AGENTS.md.

---

## 1. PROJECT IDENTITY & DESIGN PHILOSOPHY

### 1.1 Purpose

PWA for MTG. Track life 2-6 players. Dynamic layouts, per-player color identity,
AI Judge. Session-only. No accounts.

### 1.2 Core Premise

**"Typographic Brutalism + Color Identity"** — life total IS interface. Massive
geometric numbers, no chrome, no noise. Faster than dice.

| Principle       | Decision                                                                   |
| --------------- | -------------------------------------------------------------------------- |
| Aesthetic       | Typographic Brutalism + MTG Color Identity                                 |
| Font            | **Archivo** — Black 900 life totals, Medium 500 UI                         |
| Color           | Warm parchment base. Player identity via mana colors.                      |
| Layout          | Grid-based zones. 2p vertical, 4p 2×2, 6p 2×3. Top rows rotated 180°.      |
| BG Treatment    | Solid mana color per zone. Base = warm parchment.                          |
| Motion          | Minimal. Opacity/scale for modals. Staggered reveal. Swipe spring physics. |
| Differentiation | Massive typography + mana color blocks. AI Judge = secret weapon.          |

### 1.3 Anti-Patterns (Forbidden)

- ❌ Generic purple gradient on white
- ❌ Inter / Roboto / Arial / System font stacks
- ❌ Centered hero + 3-column card grid
- ❌ Subtle gray-on-gray text
- ❌ Generic rounded cards with soft shadows
- ❌ Player names — color + position only identifier
- ❌ Cookie-cutter "AI slop" aesthetics

---

## 2. COLOR PALETTE — MTG MANA COLORS

### 2.1 Player Identity Colors

Color FILLS zone background. No name — color is identity.

| Mana      | Hex       | Role                   |
| --------- | --------- | ---------------------- |
| White (W) | `#F8F6D8` | Warm, sheltering       |
| Blue (U)  | `#C1D7E9` | Electric, intellectual |
| Black (B) | `#666565` | Ambitious, dark        |
| Red (R)   | `#E49977` | Passionate, aggressive |
| Green (G) | `#A3C095` | Natural, wild          |
| Colorless | `#CAC5C0` | Neutral/eldrazi        |

Text auto-selects `#FAF8F5` (warm white) or `#1A1A1A` (warm near-black) via
luminance. WCAG 4.5:1.

### 2.2 UI & Shell Colors

| Token                 | Hex                | Usage                                        |
| --------------------- | ------------------ | -------------------------------------------- |
| BG overlay            | `#1a1a1a`          | Commander damage & counters overlay BG       |
| Belt / AI Judge       | `#000000`          | Spellbook belt, AI Judge modal backdrop      |
| Modal BG              | `rgba(0,0,0,0.80)` | Config modals                                |
| Danger red            | `#D50000`          | Life ≤ 0, commander ≥ 21                     |
| Text warm white       | `#FAF8F5`          | Life/UI text on overlay & belt BGs           |
| Text warm near-black  | `#1A1A1A`          | Life/UI text on light mana BGs               |
| Icon silhouette dark  | `#0D0F0F`          | Mana fills                                   |
| Icon silhouette light | `#FAF8F5`          | Counters, player-actions, Planeswalker fills |
| System bubble BG      | `#666565`          | AI Judge system bubble — text `#FAF8F5`      |
| User bubble BG        | `#CAC5C0`          | AI Judge user bubble — text `#1A1A1A`        |

### 2.3 Icon System

All MTG symbols = inline SVG React components. No external `.svg` imports.

| Icon type     | BG                 | Silhouette  | Selector               |
| ------------- | ------------------ | ----------- | ---------------------- |
| Mana          | Solid color circle | `iconDark`  | `ManaSelector`         |
| Counter       | None — on overlay  | `iconLight` | `CounterSelector`      |
| Player-action | None               | `iconLight` | `PlayerActionSelector` |
| Planeswalker  | None — on overlay  | `iconLight` | Direct import          |

### 2.5 Symbol Files

- **Mana:** `shared/components/icons/mana/` — W,U,B,R,G,Colorless. Color-filled
  circle + iconDark silhouette. Used by ManaSelector.
- **Counters:** `shared/components/icons/counters/` — Poison, Energy,
  Experience, Time. No BG, iconLight. Used by CounterSelector.
- **Commander:** `shared/components/icons/PlaneswalkerSymbol.tsx` — exclusive to
  commander damage overlay. Not a counter. iconLight.

---

## 3. TYPOGRAPHY

### 3.1 Font Loading

```tsx
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700", "800", "900"],
});
```

### 3.2 Type Scale

Life total = hero. All else secondary.

| Token            | Value                        | Weight      | Usage                       |
| ---------------- | ---------------------------- | ----------- | --------------------------- |
| `--text-life`    | `clamp(3.5rem, 15vw, 6rem)`  | Black 900   | Life total number           |
| `--text-display` | `clamp(2.5rem, 6vw, 5rem)`   | Black 900   | Commander damage big number |
| `--text-heading` | `clamp(1.5rem, 3vw, 2.5rem)` | Bold 700    | Modal titles                |
| `--text-body`    | `1rem`                       | Medium 500  | UI labels, buttons          |
| `--text-body-sm` | `0.875rem`                   | Regular 400 | Captions                    |
| `--text-caption` | `0.75rem`                    | Regular 400 | Small badges                |

### 3.3 Line Heights

```css
--leading-none: 0.9; /* Life */
--leading-tight: 1.1; /* Commander damage */
--leading-base: 1.4; /* Body */
```

---

## 4. LAYOUT SYSTEM

### 4.1 Player Zone Grids

Auto-adapts to player count + orientation. Spellbook belt divides screen.

**2 Players (Portrait)**

```
┌──────────────────┐
│    Player 1      │ 180° rotation
│   40 ★           │
│  [+]  [-]        │
├────────M─────────┤
│    Player 2      │
│   37 ★           │
│  [+]  [-]        │
└──────────────────┘
```

**3 Players (Portrait — asymmetric)**

```
┌───────────────────────────────────┐
│            Player 1               │ 180° → text faces TOP
│              40 ★                 │
│           [+]  [-]                │
├────────────────M──────────────────┤
│   Player 2     │   Player 3       │
│   37 ★         │   41 ★           │
│  [+]  [-]      │  [+]  [-]        │ P2: 90°, P3: −90°
└────────────────┴──────────────────┘
```

**4 Players (Landscape — 2×2)**

```
┌──────────┬──────────┐
│ Player 1 │ Player 2 │ P1: 90°, P2: −90°
│   40 ★   │   38 ★   │
├──────────M──────────┤
│ Player 3 │ Player 4 │ P3: 90°, P4: −90°
│   32 ★   │   41 ★   │
└──────────┴──────────┘
```

**5 Players (Portrait — 1 full + 2×2)**

```
┌─────────────────────┐
│      Player 1       │ P1: 180° → text faces TOP
│         40 ★        │
│      [+]  [-]       │
├──────────┬──────────┤
│ Player 2 │ Player 3 │ P2: 90°, P3: −90°
│   40 ★   │   38 ★   │
├──────────M──────────┤
│ Player 4 │ Player 5 │ P4: 90°, P5: −90°
│   32 ★   │   41 ★   │
└──────────┴──────────┘
```

**6 Players (Landscape — 2×3)**

```
┌─────────────────────┐
│      Player 1       │ P1: 180° → text faces TOP
│         40 ★        │
│      [+]  [-]       │
├──────────┬──────────┤
│ Player 2 │ Player 3 │ P2: 90°, P3: −90°
│   40 ★   │   38 ★   │
├──────────M──────────┤
│ Player 4 │ Player 5 │ P4: 90°, P5: −90°
│   32 ★   │   41 ★   │
├──────────┴──────────┤
│      Player 6       │ P6: 0
│         40 ★        │
│      [+]  [-]       │
└─────────────────────┘
```

- **M** = Spellbook menu position.

### 4.2 Zone Anatomy

3-column grid. Each column = interactive. Full zone detects swipe.

```
┌───────────┬───────────┬───────────┐
│           │           │      ⚙️   │
│    [-]    │    40     │    [+]    │
│           │           │           │
└───────────┴───────────┴───────────┘
  ◄─────── full-zone swipe ───────►
```

| Col    | Width | Content                                                    |
| ------ | ----- | ---------------------------------------------------------- |
| Left   | 33.3% | **[-]** decrement. Borderless. Entire col = button.        |
| Center | 33.3% | **Life total** `--text-life`, Archivo Black 900, centered. |
| Right  | 33.3% | **[+]** increment. Borderless. Entire col = button.        |

- **Gear icon (⚙️):** Top-right of right column. Outside button hit area.
- **[-]/[+] buttons:** No border, no `border-radius`, no BG distinction from
  zone color. Text auto-selects per luminance.
- **Press feedback:** `pointerdown` → col BG overlays `rgba(0,0,0,0.08)`. 150ms
  fade in/out on col BG itself — no extra DOM.
- **Tap:** ±1. **Hold:** ±10 after 1s.
- **Lethal:** Life ≤ 0 → `#D50000`. ± cols unaffected.
- **Swipe (player-relative):** From each player's own perspective, swipe left =
  Commander damage overlay; swipe right = Counters overlay. Physical screen
  direction flips on rotated slots (§4.3: P1 top slot = 180° → invert the swipe
  direction you physically make). Threshold: ≥10px before 300ms. Vertical
  ignored.
- **Overlay open:** Either X-direction swipe closes overlay → return to life.

### 4.3 Zone Rotation

Text readable from table side. Wrapper — interior layout identical.

| Rotation | Angle         | CSS              | Applies                                        |
| -------- | ------------- | ---------------- | ---------------------------------------------- |
| 180°     | Full flip     | `rotate(180deg)` | Top-side: P1 (2p,3p,5p,6p)                     |
| 90°      | Quarter right | `rotate(90deg)`  | Left-side: P2 (3p), P1/P3 (4p), P2/P4 (5p,6p)  |
| −90°     | Quarter left  | `rotate(-90deg)` | Right-side: P3 (3p), P2/P4 (4p), P3/P5 (5p,6p) |
| None     | —             | —                | Bottom-side facing user: P2 (2p), P6 (6p)      |

### 4.4 Extended Splash

Launch state. Covers pre-hydration. Belt visible beneath; zones empty until hydrate.

- **Dialog:** dedicated modal `<dialog>` (`extended-splash`). NOT DialogShell (dismiss paths). Top layer via `showModal()`.
- **Visual:** fullscreen. bg `#292A2A` = manifest `background_color` (seamless OS-splash → DOM). Centered MTG logo (`mtg-logo.png`) + app name. No animations.
- **Timing:** opens at first paint — inline script after dialog in SSR HTML → covers JS load + hydration hold. Opens whenever `!isHydrated`.
- **Close:** hard cut on `isHydrated`. No Escape (cancel guard). No backdrop close. No ✕.
- **Page bg:** body `#292A2A` (same token) — seamless under dialog; fallback if inline script blocked (CSP).
- **Semantics:** `aria-label="Loading game"`, `aria-modal="true"`, `data-testid="extended-splash"`.

---

## 5. CENTRAL SPELLBOOK MENU

### 5.1 Visual — Stretched Rope

```
┌──────────────────────────────────────────┐
│            Player zones above            │
│  ══════════════════●══════════════════   │  ← Full-width line, M at center
│                     M                    │  ← 56×56px MTG logo
│            Player zones below            │
└──────────────────────────────────────────┘
```

Line: dark stroke, low opacity, edge-to-edge. Permanent dividing boundary. Zones
never cross it.

M logo: 56×56px (≥44px min touch target). Fixed screen center. Z-index: 50.

### 5.2 Interaction — Boxer Belt

Tap M → black belt expands full width. M stays centered. 4 icons spread:

```
         ╔═══ player zones above ═══╗
┌══════════════════════════════════════┐
│  ██████████████████████████████████  │  Black belt, ~72px
│  █  ⚙️    ⟳    ● M ●    ⚖️    👥  █  │
│  ██████████████████████████████████  │
└══════════════════════════════════════┘
         ╚═══ player zones below ═══╝
```

- **Left (near→far):** ⟳ Restart Life, ⚙️ Initial Life
- **Right (near→far):** ⚖️ AI Judge, 👥 Players
- **Close:** Tap M or outside → icons collapse, belt retracts. Tapping any
  action icon also collapses the belt.

| Icon | Action       | Side        | Modal?       |
| ---- | ------------ | ----------- | ------------ |
| ⟳    | Restart Life | Left, near  | No — instant |
| ⚙️   | Initial Life | Left, far   | Yes — modal  |
| ⚖️   | AI Judge     | Right, near | Yes — modal  |
| 👥   | Players      | Right, far  | Yes — modal  |

Gameplay (⟳, ⚖️) near center. Setup (⚙️, 👥) outer edges.

---

## 6. MODAL SYSTEM

### 6.1 Dialog Pattern

Native `<dialog>` with `aria-modal="true"`. No modal library.

| Modal                                 | Backdrop                     |
| ------------------------------------- | ---------------------------- |
| Initial Life / Players / Color Picker | `rgba(0, 0, 0, 0.35)`        |
| AI Judge                              | `#000000` solid — full focus |

```html
<dialog aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Initial Life</h2>
</dialog>
```

Selection modals omit ✕ close button — close via backdrop tap or Escape. Focus
lands on first selectable item (`autofocus` on first preset cell or first SVG).

### 6.2 Initial Life Selector

2-column grid. Each cell = preset value. Tap selects.

```
┌──────────┬──────────┐
│    20    │    30    │
│ Standard │   2HG    │
├──────────┼──────────┤
│    40    │    60    │
│ Commander│   2HG    │
└──────────┴──────────┘
    [+] Add custom value
```

- **Presets:** 20, 30, 40, 60. Each shows number large (--text-display) + format
  label below (--text-caption).
- **[+] Add custom value:** Below grid. Opens numpad for exact entry.
- **Selection:** Tap preset → value selected, modal closes. Tap [+] → numpad,
  Enter → closes.
- **Close:** Tap backdrop or Escape. **No ✕ close button.**

### 6.3 Player Selector

2-column grid. Each cell = SVG layout preview. SVG IS the button — no text
labels.

```
┌──────────┬──────────┐
│          │          │
│  [svg]   │  [svg]   │
│   2p     │   3p     │
│          │          │
├──────────┼──────────┤
│          │          │
│  [svg]   │  [svg]   │
│   4p     │   5p     │
│          │          │
└──────────┴──────────┘
    [svg] 6p
```

- **SVGs:** Layout diagrams matching §4.1 (zone positions, rotation). Each SVG
  fills its cell. The SVG itself is the tap target (≥44×44px).
- **No text:** SVG must communicate player count visually. No labels like "2
  Players".
- **Rows:** 2p, 3p in row 1. 4p, 5p in row 2. 6p centered below grid (odd
  column).
- **Selection:** Tap SVG → player count selected, modal closes.
- **Close:** Tap backdrop or Escape. **No ✕ close button.**

### 6.4 AI Judge

Chat window. Maximized modal, `#000` backdrop (§6.1). AI = left, user = right.
Streaming response.

```
┌──────────────────────────────────────────┐
│                                  [✕]     │  ← heading row, --text-body
│  ┌──────────────────┐                    │  System bubble — MANA.b BG
│  │ Rules question…  │                    │  text #FAF8F5, left-aligned
│  └──────────────────┘                    │
│                    ┌──────────────────┐  │  User bubble — MANA.c BG
│                    │ Ask about card…  │  │  text #1A1A1A, right-aligned
│                    └──────────────────┘  │
│  ┌─────────────┐  (typing indicator)     │  Streaming state
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Ask about a card or rule…     ⏎   │  │  Input, docked bottom
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

- **Bubbles:** max-width ~75% of modal. No border-radius on aligned side.
  System: BG `MANA.b` (`#666565`), text `#FAF8F5`. User: BG `MANA.c`
  (`#CAC5C0`), text `#1A1A1A`. High contrast both.
- **Answer text only:** system bubble shows model answer text — never raw JSON.
- **Header:** "AI Judge" `--text-heading sr-only`. ✕ close button — Escape too.
- **Streaming:** Response renders incrementally in system bubble. Typing
  indicator (3 dots) while waiting. Input disabled while streaming.
- **Input:** Docked bottom. Placeholder "Ask about a card or rule…" (50% white
  opacity). Enter/⏎ sends. Auto-scroll to newest message.
- **Keyboard:** Escape closes. Focus on input on open.
- **History persistence:** chat survives modal close AND page reload (IndexedDB,
  SPEC §9.9). New game (⟳ / ⚙️ / 👥 reset) → fresh chat. Old games pruned.

#### 6.4.0 Offline Fallback (until local engine lands)

Offline → chat read-only. No typing, no send. Alert explains why.

```
│  ⚠️  You're offline — AI Judge needs internet.  ← alert row
│  ┌──────────────────────────────────────────┐
│  │  Ask about a card or rule…          ⏎    │  ← input disabled
│  └──────────────────────────────────────────┘
```

- **Alert row:** full-width, above input. BG `MANA.b`, text `#FAF8F5`,
  `--text-body-sm`. Copy: "You're offline — AI Judge needs internet."
- **Input:** disabled — no focus, no send, placeholder unchanged.
- **History:** still visible + scrollable. Read-only.
- **Online return:** state clears, input re-enables. No reload.

#### 6.4.1 Answer Formatting

Markdown subset, rendered client-side (no dependency):

- Paragraphs: blank-line separated → `<p>` blocks.
- **Bold:** `**term**` → `<strong>`. Unmatched `**` (mid-stream) → literal.
- Bullets: consecutive `- ` lines → one `<ul>`. Numbered `1. ` → `<ol>`.
- List tolerance: lists recognized WITHOUT preceding blank line — any run of
  consecutive `- ` / `• ` / `1. ` lines inside a block → one list; surrounding
  text lines → their own `<p>` (e.g. `Intro\n- a\n- b\nOutro` → `<p>` +
  `<ul>` + `<p>`).
- Paragraphize fallback: one long text block (>300 chars, no lists, no
  blank-line separation) → sentence-boundary split into `<p>` (~2 sentences,
  ≤240 chars each). Sentence split refuses after `.<digit>`, so rule ids
  like `CR 405.1a` stay unsplit.
- Rule references: inline `CR|rule|regla <num>` refs extracted from
  paragraph text → appended at end as ` - <i>CR 405.1</i>` (comma-joined
  multiple), italic, `#FAF8F5` 75% opacity (high contrast on MANA.b, less
  solid than body).
- No headings/tables/code blocks/links. Escape via React text nodes — no
  `dangerouslySetInnerHTML`.
- Streaming: partial markdown renders as-is (unclosed `**` passes through).

### 6.5 Color Picker (per player)

Triggered by gear icon on zone. Width = fit-content

```
┌───────────────────────┐
│                       │
│                       │
│                       │
│        [C] [W]        │
│      [G] [✓] [U]      │
│        [R] [B]        │
│                       │
│                       │
│                       │
└───────────────────────┘

```

#### COLOR SELECTION WHEEL

Circular wheel, WUBRG order + Colorless clockwise.

### 6.6 Modal: Custom Counter Name

Triggered by [+] on Counters overlay (§7.4). Quick name entry — no chrome.

```
┌───────────────────────────────┐
│    Custom Counter             │  ← --text-heading, Archivo Bold 700
│                               │
│ ┌─────────────────────────┐   │
│ │  Counter                │   │  ← Input, auto-focused, placeholder
│ └─────────────────────────┘   │
│                               │
│         [  + Add  ]           │  ← Confirm, borderless, warm white
│                               │
└───────────────────────────────┘
```

**Backdrop:** `rgba(0,0,0,0.35)` — matches §6.1 light modals.

**Close mechanisms:**

- Tap backdrop → cancel, no counter created
- Escape key → cancel
- Tap [+ Add] or Enter → name validated, dialog closes, counter added

**Input:**

- Placeholder: "Counter" (50% white opacity)
- Text: warm white `#FAF8F5`, Archivo Medium 500, `1rem`
- `maxlength="35"` via HTML attribute
- Auto-focused on open

**Validation:**

- Name trimmed. Empty → button does nothing (no error UI).
- Non-empty → dialog closes, counter appears in §7.4 grid.

---

## 7. GESTURES & INTERACTIONS

### 7.1 Life Adjustment

| Gesture        | Result       |
| -------------- | ------------ |
| Tap [+] / [-]  | +1 / -1 life |
| Hold [+] / [-] | ±10 after 1s |

### 7.2 Swipe

| Gesture                               | Result                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Swipe left on zone (player-relative)  | Commander damage overlay. Physical direction flips on rotated slots (§4.3) |
| Swipe right on zone (player-relative) | Counters overlay. Physical direction flips on rotated slots (§4.3)         |
| X-axis swipe on overlay               | Closes overlay, returns to life. Either direction                          |

### 7.3 Commander Damage

One column per commander in play (every opponent + player's own). Tracks damage
each commander deals to current player.

- BG: `#1a1a1a`

```
┌──────────────────────┐
│   ┌──────┐           │
│   │  ⚔️  │  12  [+]  │  Pill (commander player's color) + symbol + total + + button
│   └──────┘           │
└──────────────────────┘
```

Data model: see SPEC.md §4 `CommanderDamage`. Player 1 (playerId: 0) sees
columns for playerId 0 (own commander), 1, 2, 3 (opponents).

- **Pill:** Rounded. Commander owner's mana color. `PlaneswalkerSymbol` inside
  (white fill).
- **Total:** Archivo Bold. Text per luminance.
- **+ button:** Tap +1, hold ±10 after 1s. Borderless.
- **Life reduction:** Each commander damage point also −1 life.
  `adjustCommanderDamage(+3)` → life -3.
- **Lethal:** Any commander ≥21 → current player loses. Value + life total →
  `#D50000`.
- **Zone label:** When commander ≥21 & life >0 → small "Commander Damage Lethal"
  in danger red under life total.

### 7.4 Counters Overlay

Always 2-column grid. BG: `#1a1a1a`.

**Default counters (always present):** ☠️ Poison, ⚡ Energy, ✦ Experience, ⏳
Time

- `PlaneswalkerSymbol` is NOT a counter — belongs to commander overlay only.

```
┌───────────────────────┐
│  ☠️    3    [-]  [+]  │  Icon, value, controls
└───────────────────────┘
```

- **Icon:** `iconLight` silhouette. No pill, no BG container.
- **Value:** Archivo Bold, warm white per luminance.
- **[-]/[+] buttons:** Tap ±1, hold ±10 after 1s. Borderless.
- **New counter (+):** Bottom-right → opens Custom Counter Name modal (§6.6).
  Starts at 0. Custom counters: rounded pill `#CAC5C0`, `iconDark`, first letter
  displayed.
- **Poison Lethal:** 10+ → player loses. Poison value + life total → `#D50000`.
  Zone shows small "Poison Lethal" under life total.
- **Grid:** 2 columns. Left-to-right, top-to-bottom. Defaults fill rows 1-2.

---

## 8. RESPONSIVE

### 8.1 Breakpoints (Tailwind)

| BP      | Width    | Behavior                  |
| ------- | -------- | ------------------------- |
| Default | < 480px  | Single column, portrait   |
| `sm:`   | ≥ 480px  | 2-column grid possible    |
| `md:`   | ≥ 768px  | 2×2 grid for landscape    |
| `lg:`   | ≥ 1024px | Full 2×3 grid for 6p      |
| `xl:`   | ≥ 1440px | Larger life, more spacing |

### 8.2 Orientation

- **Portrait:** 2p, 3p, 5p — stacked + asymmetric. Text rotated per position.
- **Landscape:** 4p, 6p — grids. Top row 180°.
- **Lock:** `"orientation": "portrait"` in manifest +
  `screen.orientation.lock()`. Player count determines internal layout.

### 8.3 Touch Targets

All interactive: ≥44×44px (48×48px preferred).

---

## 9. ACCESSIBILITY — WCAG 2.2 AA

- **Contrast:** 4.5:1 text, 3:1 large text. Auto-select warm white/near-black
  via luminance.
- **Touch:** ≥44×44px.
- **Keyboard:** Tab through all controls. Visible focus rings.
- **Screen reader:** Zone announces "Player 1: 40 life". Buttons: "+1 life", "-1
  life". Swipes have button alternatives.
- **Reduced motion:** `prefers-reduced-motion: reduce` → no swipe animations,
  instant show/hide.

---

## 10. APPLICATION STATE

## Data model, defaults, persistence: see SPEC.md §1–6.

_End of DESIGN.md_
