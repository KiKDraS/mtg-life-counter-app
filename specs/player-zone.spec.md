# Player Zone — Test Plan (DESIGN.md §4.1–4.3, §7.1, §8.3, §9)

## Application Overview

MTG Life Counter — Player Zone milestone (branch `feature/player-zone`). Two player zones on a full-viewport vertical split: Player 1 (blue mana #C1D7E9, rotated 180°) on top, Player 2 (red mana #E49977) on bottom, both starting at 40 life. Each zone has a massive Archivo Black life total (`--text-life: clamp(4rem, 15vw, 12rem)`, font-weight 900) with `aria-live="polite"`, and `−`/`+` buttons (min 48px) with tap = ±1 and hold acceleration (±5 after ~400ms, ±10 after 1s total hold). Life ≤ 0 turns the number danger red #D50000.

ENVIRONMENT
- baseURL http://localhost:3000 (`pnpm dev`); config viewport 1280×720 — the flex-col split works at any viewport; Scenario 1 optionally overrides to a portrait viewport (390×844) for realism.
- Seed: `tests/seed.spec.ts` navigates to `/`. Every test starts from a fresh page load (zone-local state, no persistence).

SELECTOR STRATEGY (verified against rendered SSR HTML)
- Zone: `page.getByRole('region', { name: /^Player 1:/ })` — `<section aria-label="Player 1: 40 life">` maps to role `region`. CRITICAL: both zones expose identically named buttons, so ALL button lookups MUST be scoped to a zone: `zone.getByRole('button', { name: '+1 life' })` / `{ name: '-1 life' }` (aria-label uses ASCII hyphen; the visible glyph is U+2212 `−`).
- Life total: `zone.locator('[aria-live="polite"]')` (a `<p>`, no implicit role — do not use getByRole).
- Rotation wrapper: `zone.locator('..')` (parent div carries inline `style="transform:rotate(180deg|0deg)"`).

HOLD-GESTURE TECHNIQUE (mouse, not touch emulation)
1. `const box = await button.boundingBox()` → `page.mouse.move(cx, cy)` → `page.mouse.down()` → `page.waitForTimeout(ms)` → `page.mouse.up()`.
2. Do NOT move the mouse between down/up (pointerleave would stop the hold).
3. TIMING TOLERANCES: timers fire on the page's event loop (400ms delay, 100ms repeat interval, step upgrade at 1000ms held). Assert RANGES, never exact values. Reference math from 40 life: short hold 700–800ms ⇒ gain +6 to +20 (1 tap + 2–3 repeats ×5); long hold 1600–1800ms ⇒ gain ≥ +40 (only reachable via ±10 steps; theoretical max ~+86). Widen bounds by ±5 if CI is slow.

OUT OF SCOPE (deferred features — do not test): gear icon/color picker, swipe overlays, numpad on double-tap, game state machine/undo, PWA/orientation lock.

## Test Scenarios

### 1. Player Zone — Board Rendering

**Seed:** `tests/seed.spec.ts`

#### 1.1. Board renders two zones in an equal vertical split, P1 on top

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/` (optionally set viewport to 390×844 portrait first: `page.setViewportSize({ width: 390, height: 844 })`)
    - expect: Exactly 2 elements match `page.getByRole('region', { name: /^Player \d:/ })`, both visible
  2. Read bounding boxes: `p1 = page.getByRole('region', { name: /^Player 1:/ })`, `p2 = ...Player 2...`
    - expect: p1 box top ≈ 0; p2 box top ≈ viewport.height / 2 (±2px)
    - expect: Heights equal (±2px); each ≈ 50% of viewport height
    - expect: Both widths equal the viewport width — full-bleed split per §4.1

#### 1.2. Top zone (P1) is rotated 180°, bottom zone (P2) is not rotated

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`; evaluate the wrapper of each zone: `await page.getByRole('region', { name: /^Player 1:/ }).evaluate(el => el.parentElement.style.transform)`
    - expect: P1 wrapper inline transform is `rotate(180deg)` (computed style may serialize as `matrix(-1, 0, 0, -1, 0, 0)`) — §4.3
  2. Same evaluation for the Player 2 region wrapper
    - expect: P2 wrapper transform is `rotate(0deg)` or `none`

#### 1.3. Mana background colors are applied per player

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`; assert computed background-color on each region: `await expect(p1).toHaveCSS('background-color', 'rgb(193, 215, 233)')`
    - expect: P1 (blue mana) background-color = rgb(193, 215, 233) = #C1D7E9
  2. Assert P2: `await expect(p2).toHaveCSS('background-color', 'rgb(228, 153, 119)')`
    - expect: P2 (red mana) background-color = rgb(228, 153, 119) = #E49977

### 2. Player Zone — Life Display & Tap Adjustment

**Seed:** `tests/seed.spec.ts`

#### 2.1. Both players start at 40 life with massive typography

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`; locate life totals via `p1.locator('[aria-live="polite"]')` and same for p2
    - expect: Both life totals display the exact text `40`
  2. Assert computed styles on each life `<p>`: `font-size`, `font-weight`, `font-family`
    - expect: font-size ≥ 64px (clamp(4rem, 15vw, 12rem) floor; at 1280px width it resolves to the 192px cap)
    - expect: font-weight = 900 (Archivo Black via `font-black`)
    - expect: font-family contains `Archivo`

#### 2.2. Tap + and − adjust by exactly 1, independently per player

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Click `p1.getByRole('button', { name: '+1 life' })` once; click `p2.getByRole('button', { name: '+1 life' })` three times
    - expect: P1 life total reads `41`; P2 reads `43` — single pointer tap = exactly +1, no cross-player leakage
  2. Click `p2.getByRole('button', { name: '-1 life' })` once
    - expect: P2 life total reads `42` — tap = −1
    - expect: P1 still reads `41` — zone-local state confirmed

### 3. Player Zone — Hold Acceleration (§7.1)

**Seed:** `tests/seed.spec.ts`

#### 3.1. Short hold (~700–800ms) engages the ±5 repeat step

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Get center of `p1.getByRole('button', { name: '+1 life' })` via boundingBox; `page.mouse.move(cx, cy)`; `page.mouse.down()`; `page.waitForTimeout(750)`; `page.mouse.up()`
    - expect: P1 life total is within [46, 60] — i.e. 1 (tap) + 2–3 repeats × +5
    - expect: Strictly greater than 41 (proves hold-repeat engaged); strictly less than the ±10 regime
    - expect: TOLERANCE: widen upper bound by +5 on slow CI; never assert an exact value

#### 3.2. Long hold (~1.6–1.8s) accelerates to the ±10 step

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Hold `p1` `+1 life` button down as in the short-hold scenario but wait 1700ms before `mouse.up()`
    - expect: P1 life total ≥ 80 — reachable only if the step upgraded to +10 (a pure ±5 regime caps at ~+26 in this window)
    - expect: Upper sanity bound ≤ 130 (theoretical max ≈ 126)
    - expect: TOLERANCE: if CI timers slip, lower the bound to ≥ 70 — still proof of acceleration

#### 3.3. Releasing the button stops adjustment immediately

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Hold `p1` `+1 life` for 600ms, `mouse.up()`, then read the life value V; `page.waitForTimeout(400)` and read again
    - expect: Life total after the 400ms idle wait is still exactly V — no timer leak after pointerup
    - expect: Value V itself is within [41, 56] (1 + up to 3×5)

### 4. Player Zone — Lethal State

**Seed:** `tests/seed.spec.ts`

#### 4.1. Life at or below 0 turns the total danger red; recovering restores dark text

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Hold `p1.getByRole('button', { name: '-1 life' })` while polling `p1.locator('[aria-live="polite"]')` until its number ≤ 0 (release via mouse.up as soon as ≤ 0; hard cap 5s — a ~2s hold suffices: 40 − (1+5×5+~8×10) ≈ −66)
    - expect: Life total ≤ 0
    - expect: `await expect(p1.locator('[aria-live="polite"]')).toHaveCSS('color', 'rgb(213, 0, 0)')` — danger red #D50000 per §4.2
  2. Click `p1` `+1 life` repeatedly (bounded loop, max 70 clicks) until life > 0
    - expect: Once life ≥ 1, color returns to rgb(26, 26, 26) = #1A1A1A
    - expect: P2's life total and color never changed — lethal styling is zone-local

### 5. Player Zone — Keyboard & Focus (§9)

**Seed:** `tests/seed.spec.ts`

#### 5.1. Tab reaches all four buttons in DOM order with a visible focus ring

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Press `Tab` four times, asserting focus after each press
    - expect: Tab 1 → `p1` `-1 life` button focused; Tab 2 → `p1` `+1 life`; Tab 3 → `p2` `-1 life`; Tab 4 → `p2` `+1 life` (assert via `await expect(locator).toBeFocused()`; DOM order, rotation does not affect tab order)
  2. With any button focused, read computed `outline-style` and `outline-width`
    - expect: outline-style = `solid`, outline-width = `2px` (classes `focus-visible:outline-2 outline-offset-4 outline-current`) — visible focus indicator per §9

#### 5.2. Enter and Space each adjust by exactly 1 (no acceleration from keyboard)

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Tab twice to focus `p1` `+1 life`; press `Enter`
    - expect: P1 life total reads `41` — keyboard-originated click (event.detail === 0) fires exactly +1
  2. Press `Space` once (still focused)
    - expect: P1 life total reads `42` — exactly +1 per activation, no hold-repeat from the keyboard path
    - expect: P2 unchanged at `40`

### 6. Player Zone — ARIA & Announcements (§9)

**Seed:** `tests/seed.spec.ts`

#### 6.1. Zones announce the 'Player N: X life' pattern and it stays in sync with adjustments

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Assert `page.getByRole('region', { name: 'Player 1: 40 life' })` and `... 'Player 2: 40 life'` are visible (exact names)
    - expect: Both regions resolve with exact accessible names `Player 1: 40 life` / `Player 2: 40 life`
  2. Click `p1.getByRole('button', { name: '+1 life' })` once, then re-query `page.getByRole('region', { name: 'Player 1: 41 life' })`
    - expect: Region now resolves under the updated name `Player 1: 41 life` — aria-label tracks state
    - expect: The old exact name `Player 1: 40 life` resolves to 0 elements

#### 6.2. Buttons expose correct labels; life total is a polite live region

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Within each region assert `getByRole('button', { name: '-1 life' })` and `getByRole('button', { name: '+1 life' })` are visible
    - expect: Each zone has exactly one `-1 life` and one `+1 life` button (page-wide each name matches 2 — hence zone scoping)
  2. Assert attributes on each life `<p>`: `toHaveAttribute('aria-live', 'polite')` and `toHaveAttribute('aria-atomic', 'true')`; then click `+1 life` and assert the live region's text becomes `41`
    - expect: aria-live=`polite`, aria-atomic=`true` present on both zones' life totals
    - expect: Live region content updates to `41` after the tap (the announcement itself is implicit in the DOM update — no screen-reader assertion)

### 7. Player Zone — Contrast & Touch Targets (§8.3, §9)

**Seed:** `tests/seed.spec.ts`

#### 7.1. Life text is warm near-black #1A1A1A on both mana backgrounds

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. Assert `toHaveCSS('color', 'rgb(26, 26, 26)')` on both zones' `[aria-live="polite"]` elements while life = 40
    - expect: P1: text rgb(26, 26, 26) on rgb(193, 215, 233) — WCAG contrast ≈ 11:1
    - expect: P2: text rgb(26, 26, 26) on rgb(228, 153, 119) — WCAG contrast ≈ 7:1
    - expect: Both far exceed the 4.5:1 AA requirement (luminance-based auto-select in `textColorFor`)

#### 7.2. All life buttons meet the 44×44px minimum touch target

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to `/`. For each of the 4 buttons (`p1`/`p2` × `+1 life`/`-1 life`) read `boundingBox()`
    - expect: Every button's width ≥ 44 and height ≥ 44 (expected ≈ 48px + padding/border from `min-h-12 min-w-12 px-4 border-2`) per §8.3
