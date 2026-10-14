# MTG Life Counter — Modal & Interaction QA Test Plan

**App:** MTG Life Counter PWA (Next.js 16, React 19, Tailwind CSS 4)
**Spec Reference:** DESIGN.md §5–7, SPEC.md §8

---

## Test Suites

| # | Suite | Focus |
|---|-------|-------|
| 1 | General | App shell, title, console errors |
| 2 | Spellbook Belt | M logo open/close, click-outside, ARIA |
| 3 | Restart Life | Instant reset, counter/color preservation |
| 4 | Initial Life Modal | §6.2 preset grid, numpad, backdrop/escape |
| 5 | Player Selector Modal | §6.3 SVG layouts, count up/down, color preservation |
| 6 | Color Picker | §6.5 wheel, multi-select, replace/add, Colorless selected-state (`aria-pressed`), wheel ring/icon-dim/hugging focus ring |
| 7 | Counters Overlay | §7.4 default counters, custom counter modal, restart |

---

## Suite 1: General

### TC-1.1: App shell renders with correct title

**Description:** Verify the app loads with the expected title and structure.

**Steps:**
1. Navigate to `http://localhost:3000`
2. Wait for full page load
3. Read `document.title`
4. Inspect the DOM for player zone elements

**Expected Results:**
- Page loads without console errors
- `document.title` is `"MTG Life Counter"`
- Two player zones render at default 40 life each
- Each zone contains: `−` button, life total display (`40`), gear icon (Change color), `+` button
- Spellbook menu area is present with MTG logo

---

### TC-1.2: No console errors on initial load

**Description:** Confirm zero error-level console messages.

**Steps:**
1. Reload the page at `http://localhost:3000`
2. Check browser console for messages of level `error`

**Expected Results:**
- Zero error-level console messages
- Warnings are acceptable (e.g., Next.js dev warnings)

---

## Suite 2: Spellbook Belt (§5)

> Note: ⬇️ Install App renders only after the browser fires
> `beforeinstallprompt` (installability gate, SPEC §8.6 — Chrome/Edge desktop
> only; not iOS Safari). Manual verification therefore requires such a
> browser; elsewhere the icon is correctly absent and the belt shows 4 icons.

### TC-2.1: M logo opens belt with 5 icons

**Description:** Tapping the MTG logo expands the belt.

**Steps:**
1. Navigate to app (fresh 2-player state — belt closed)
2. Verify belt icons are **not** visible (no Restart/Initial Life/AI Judge/Players/Install App buttons)
3. Tap/clicks the M logo (`Open Spellbook Menu` label)
4. Wait for CSS transition (300ms)

**Expected Results:**
- Belt expands to full width with black background
- 5 icon buttons visible:
  - **Left side** (near→far): ⟳ Restart Life, ⚙️ Initial Life, ⬇️ Install App (renders only after `beforeinstallprompt` — installability gate SPEC §8.6; in browsers without the event, 4 icons, Install App absent by design)
  - **Right side** (near→far): ⚖️ AI Judge, 👥 Players
- Hidden checkbox `#spellbook-toggle` is `checked`
- M logo remains centered, z-index 50

---

### TC-2.2: M logo collapses belt

**Description:** Tapping the M logo again retracts the belt.

**Steps:**
1. Open belt via TC-2.1
2. Tap M logo (`Open Spellbook Menu`) a second time
3. Wait for CSS transition (300ms)

**Expected Results:**
- Belt collapses: width → 0, height → 0, opacity → 0
- 5 icon buttons no longer visible
- `#spellbook-toggle` is `unchecked`

---

### TC-2.3: Click outside belt collapses it

**Description:** Clicking outside the belt area closes it (CSS checkbox hack invisible overlay).

**Steps:**
1. Open belt via M logo
2. Identify the full-screen invisible `<label for="spellbook-toggle">` with `aria-label="Close menu"`
3. Click that overlay element

**Expected Results:**
- Belt collapses immediately (no animation needed for outside click)
- `#spellbook-toggle` is `unchecked`

---

### TC-2.4: Belt icon ARIA labels correct

**Description:** Verify accessibility labels on belt buttons.

**Steps:**
1. Open belt
2. Inspect each button's `aria-label` attribute

**Expected Results:**
- Restart Life button: `aria-label="Restart Life"`
- Initial Life button: `aria-label="Initial Life"`
- AI Judge button: `aria-label="AI Judge"`
- Players button: `aria-label="Players"`
- Install App button: `aria-label="Install App"` (present only after
  `beforeinstallprompt` — installability gate SPEC §8.6; absent by design in
  browsers that never fire the event)

---

## Suite 3: Restart Life (⟳)

### TC-3.1: Restart resets life to initialLife

**Description:** The ⟳ button instantly resets all players to the current initialLife.

**Steps:**
1. Open belt → tap Initial Life → select preset 30
2. Verify both players show 30
3. Tap `−` on Player 1 three times
4. Verify P1=27, P2=30
5. Open belt → tap Restart Life (⟳)

**Expected Results:**
- Both players show life value equal to `initialLife` (30)
- No modal or confirmation dialog — instant action per DESIGN.md §5.2

---

### TC-3.2: Custom counters cleared after restart

**Description:** Custom counters added via Counters overlay are removed on restart.

**Steps:**
1. Set initialLife to 40
2. Open Counters overlay for Player 1 (swipe left — P1 is 180°)
3. Verify 4 default counters visible
4. Tap `[+]` → Custom Counter modal → type "Lore" → submit
5. Verify Lore appears in counters grid (value 0)
6. Close overlay, open belt, tap Restart Life
7. Reopen Counters overlay for Player 1

**Expected Results:**
- Life totals reset to 40
- Custom counter "Lore" is **absent**
- Only the 4 default counters remain (Poison, Energy, Experience, Time)

---

### TC-3.3: Player colors preserved after restart

**Description:** Per-player color identity survives a restart.

**Steps:**
1. Open Color Picker for Player 1 (tap gear icon)
2. Tap White mana symbol → zone preview updates live (adds to default `["r"]` → red+white gradient per §8.5.1)
3. Tap CheckCircle ✓ → dialog closes
4. Verify P1 zone background changed from default solid red to red+white gradient
5. Open belt → tap Restart Life
6. Check Player 1 zone color

**Expected Results:**
- Life totals reset to initialLife
- Player 1 zone **remains red+white gradient** (color preserved)
- `playerColors` state is not affected by `restartGame` action

---

## Suite 4: Initial Life Modal (§6.2)

### TC-4.1: Modal opens from belt

**Description:** The ⚙️ button in the belt opens the Initial Life dialog.

**Steps:**
1. Open belt → tap Initial Life (⚙️)

**Expected Results:**
- Native `<dialog>` opens with `id="initial-life-modal"`
- `aria-modal="true"`, `aria-labelledby` referencing the heading
- Heading text: "Initial Life"
- No ✕ close button (per §6.1)

---

### TC-4.2: All 4 presets visible and selectable

**Description:** The modal shows a 2×2 grid of preset values.

**Steps:**
1. Open Initial Life modal

**Expected Results:**
- 4 preset buttons in a 2×2 grid:

  | Cell | Value | Label |
  |------|-------|-------|
  | Top-left | 20 | Standard |
  | Top-right | 30 | 2HG |
  | Bottom-left | 40 | Commander |
  | Bottom-right | 60 | 2HG |

- Each button shows the value in `--text-display` (large) and label in `--text-caption`
- Each button has `aria-label="Set initial life to {value}"`
- `[+] Add custom value` link below the grid

---

### TC-4.3: Tap preset updates life and closes modal

**Description:** Selecting a preset value immediately closes the modal and updates life.

**Steps:**
1. Open Initial Life modal → tap preset 30
2. Verify state

**Expected Results:**
- Modal closes
- Both players show 30 life
- `initialLife` in game state is now 30

**Repeat with:**
- Tap preset 60 → both players show 60

---

### TC-4.4: Custom numpad via [+] link

**Description:** The [+] link switches to a numpad for arbitrary values.

**Steps:**
1. Open Initial Life modal
2. Tap `[+] Add custom value`

**Expected Results:**
- Preset grid replaced by numpad view:
  - Instruction text: "Enter custom starting life"
  - `<input type="number">` with:
    - `aria-label="Custom starting life"`
    - `placeholder="40"`
    - `min={1}`
    - `autoFocus` (auto-focused on open)
  - `+ Add` submit button
3. Type `77` into the input
4. Click `+ Add` (or press Enter)

**Expected Results:**
- Modal closes
- Both players show 77 life
- `initialLife` = 77

---

### TC-4.5: Enter key submits numpad value

**Description:** Pressing Enter in the input submits the custom value.

**Steps:**
1. Open modal → tap [+] → type `50`
2. Press Enter key

**Expected Results:**
- Modal closes
- Both players show 50

---

### TC-4.6: Backdrop click closes modal without change

**Description:** Clicking on the dialog backdrop dismisses without selecting.

**Steps:**
1. Set initialLife to 40 (restart to confirm)
2. Open Initial Life modal
3. Click directly on the backdrop area (the `<dialog>` element itself, not any child)

**Expected Results:**
- Modal closes
- Life totals remain at 40 (no change)
- `initialLife` unchanged

---

### TC-4.7: Escape key closes modal without change

**Description:** Pressing Escape dismisses the modal.

**Steps:**
1. With initialLife at a known value (e.g., 40)
2. Open Initial Life modal
3. Press `Escape` key

**Expected Results:**
- Modal closes
- Life totals unchanged
- `initialLife` unchanged

---

## Suite 5: Player Selector Modal (§6.3)

### TC-5.1: Modal opens from belt

**Description:** The 👥 button opens the Player Selector dialog.

**Steps:**
1. Open belt → tap Players (👥)

**Expected Results:**
- Native `<dialog>` opens with `id="player-selector-modal"`
- `aria-modal="true"`, `aria-labelledby` referencing heading
- Heading text: "Players"
- No ✕ close button

---

### TC-5.2: All 5 SVG layouts visible

**Description:** The modal shows SVG previews for 2p–6p.

**Steps:**
1. Open Players modal

**Expected Results:**
- 2-column grid with 5 SVG layout previews:
  - **Row 1:** 2p (left), 3p (right)
  - **Row 2:** 4p (left), 5p (right)
  - **Row 3 (centered):** 6p (single cell, `col-span-2 mx-auto w-1/2`)
- Each cell is a `<button>` with `aria-label` like `"2 players"`, `"3 players"`, etc.
- Each SVG (`LayoutPreview`) renders `viewBox="0 0 120 160"` with zone rects matching §4.1 layouts (cycled WUBRG colors, top-row rotation indicators)

---

### TC-5.3: Tap 2p shows 2 players

**Description:** Selecting the 2-player layout.

**Steps:**
1. Open Players modal → tap `"2 players"` SVG

**Expected Results:**
- Modal closes
- Exactly 2 player zones visible
- Life totals at current initialLife

---

### TC-5.4: Tap 4p from 2p shows 4 players (count UP)

**Description:** Increasing from 2 to 4 players.

**Steps:**
1. With 2 players active, open Players modal
2. Tap `"4 players"` SVG

**Expected Results:**
- Modal closes
- 4 player zones visible
- Players 1 and 2 keep their existing colors
- Players 3 and 4 get default color (`DEFAULT_PLAYER_COLOR`)

---

### TC-5.5: Tap 2p from 4p shows 2 players (count DOWN)

**Description:** Decreasing from 4 to 2 players.

**Steps:**
1. With 4 players active, open Players modal
2. Tap `"2 players"` SVG

**Expected Results:**
- Modal closes
- 2 player zones visible
- Players 3 and 4 are removed per §8.4.2 (slice first N colors)

---

### TC-5.6: Colors preserved on 4p→2p→4p cycle

**Description:** Cycling player count preserves custom colors for returning players.

**Steps:**
1. With 4 players, set P1 to Blue (U), P2 to Black (B) (tap Blue / Black once — colors ADD to default `["r"]` per §8.5.1)
2. Open Players modal → select 2p
3. Verify P1=red+blue gradient, P2=red+black gradient, P3/P4 gone
4. Open Players modal → select 4p

**Expected Results:**
- P1 still red+blue gradient (`["r","u"]`)
- P2 still red+black gradient (`["r","b"]`)
- P3, P4 have default colors (newly appended per §8.4.1)

---

### TC-5.7: Backdrop/Escape closes modal

**Description:** Backdrop click or Escape dismisses without change.

**Steps:**
1. Start with 2 players
2. Open Players modal
3. Click backdrop or press Escape

**Expected Results:**
- Modal closes
- Player count unchanged (still 2)

---

## Suite 6: Color Picker (§6.5, SPEC §8.5.1)

### TC-6.1: Gear icon opens color picker dialog

**Description:** The gear icon in each player zone opens a per-player Color Picker.

**Steps:**
1. Tap gear icon (Change color) on Player 1 zone

**Expected Results:**
- Native `<dialog>` opens with `id="color-picker-0"`
- Dialog uses `aria-modal="true"` and `aria-labelledby`
- Width = fit-content

---

### TC-6.2: Circular wheel renders 6 mana symbols + CheckCircle

**Description:** The wheel shows WUBRG + Colorless clockwise + central ✓.

**Steps:**
1. Open Color Picker for any player

**Expected Results:**
- 6 mana symbol buttons arranged in a circular wheel clockwise
  - Colorless (C), White (W), Blue (U), Black (B), Red (R), Green (G)
- Each button uses `aria-pressed` to indicate selected state
- CheckCircle ✓ button centered in wheel (`aria-label="Confirm color"`)
- No filter strip — all symbols on wheel
- Default `["r"]` — Red highlighted (`aria-pressed="true"`); visual treatment
  (ring / icon dim / scale) per TC-6.6

---

### TC-6.3: Multi-select — add from default, remove, no-op on last

**Description:** Default `["r"]` persists on tap — unselected colors ADD. Remove allowed in multi-select, disallowed on last color.

**Steps:**
1. Open Color Picker for Player 1 (default `["r"]` → Red highlighted)
2. Tap White mana symbol

**Expected Results:**
- Red STAYS highlighted, White highlights (`aria-pressed="true"` on both) — add → `["r","w"]`
- Dialog stays open (no auto-close)
- Player 1 zone preview: red+white gradient (`#E49977` + `#F8F6D8`), NOT solid white

3. Tap White mana symbol again (selected, multi `["r","w"]`)

**Expected Results:**
- White un-highlights (`aria-pressed="false"`) — remove → `["r"]`
- Player 1 zone preview: back to solid red (`#E49977`)

4. Tap Red mana symbol (now the only selected color — `["r"]`)

**Expected Results:**
- NO-OP: Red stays highlighted (`aria-pressed="true"`), zone stays solid red (cannot remove last, §8.5.1)

5. Tap Blue mana symbol, then tap Blue again

**Expected Results:**
- After first tap: Blue highlights, zone preview red+blue gradient (`#E49977` + `#C1D7E9`)
- After second tap: Blue un-highlights, zone preview back to solid red

---

### TC-6.4: Colorless closes immediately, CheckCircle closes

**Description:** Colorless = single-tap-apply. ✓ = confirm close.

**Steps:**
1. Open Color Picker for Player 1 (default `["r"]`)
2. Tap White → Red STAYS highlighted, White highlights — add `["r","w"]` (dialog stays open)
3. Tap Blue → all three highlighted — add `["r","w","u"]` (dialog stays open, 3-color gradient preview)
4. Tap Colorless (C) mana symbol

**Expected Results:**
- Dialog closes immediately
- Player 1 zone solid colorless (`#CAC5C0`)
- `PlayerState.color` = `["c"]`

5. Reopen the Color Picker for Player 1 (`["c"]`)

**Expected Results:**
- Colorless button: `aria-pressed="true"` + selected treatment (button opacity 1, icon wrapper full opacity, solid `--color-ui-textLight` ring, slight scale-up) — §6.5/§8.5.1 mirror Colorless state
- All WUBRG buttons: `aria-pressed="false"`; the 40% dim is on each button's icon wrapper `<span>` — the button's own computed `opacity` stays 1 (rings/focus render solid; TC-6.6/TC-6.7)

6. Tap White → selected-colorless REPLACE per SPEC §8.5.1

**Expected Results:**
- White gains the selected treatment; Colorless drops to icon-wrapper 40% (button opacity 1) / `aria-pressed="false"`
- Zone preview shows white mana (`#F8F6D8`)

7. Open Color Picker for Player 2 (default `["r"]`)
8. Tap White → zone preview updates to red+white gradient (dialog stays open)
9. Tap CheckCircle ✓

**Expected Results:**
- Dialog closes
- Player 2 zone remains red+white gradient (color already applied)

---

### TC-6.6: [NEW] Wheel selection states — ring + scale on the button; 40% dim on the ICON wrapper

**Description:** §6.5 COLOR SELECTION WHEEL: selected = icon full opacity + solid
`--color-ui-textLight` ring + slight scale-up; unselected = **icon wrapper at 40%
opacity — the button-level opacity stays 1** so rings/focus render solid.
Colorless mirrors the same treatment and exposes `aria-pressed`.

**Steps:**
1. Open Color Picker for Player 1 (default `["r"]`)

**Expected Results:**
- Red button: `aria-pressed="true"`, computed `opacity` = 1, ring present
  (Tailwind `ring-4 ring-ui-textLight` → `box-shadow` includes `rgb(250, 248, 245)`), scaled up (Tailwind `scale-110` → computed `scale` = 1.1, or boundingBox ≈ 10% larger than an unselected button), stacked above siblings (`z-10`)
- W / U / B / G buttons AND Colorless: `aria-pressed="false"`, **button** computed `opacity` = 1 (NOT 0.4), no ring, no scale — the 40% dim lives on the button's icon wrapper `<span>` (its computed `opacity` = 0.4; it is the button's only `span` child)

2. Tap White (multi-select → `["r","w"]`)

**Expected Results:**
- Red AND White both show full button opacity + ring + scale; Blue/Black/Green
  icon wrappers stay at 40% (button opacity 1)
- Both selected buttons expose `aria-pressed="true"`

3. Tap White again (remove → `["r"]`)

**Expected Results:**
- White back to `aria-pressed="false"` + icon wrapper 40% (button opacity 1, no
  ring, no scale)
- Red keeps the selected treatment

4. Tap Colorless (C) → single-tap apply, dialog closes; reopen the picker

**Expected Results:**
- Colorless: `aria-pressed="true"` + selected treatment (button opacity 1, ring, scale-up)
- All WUBRG buttons: `aria-pressed="false"` + icon wrapper 40% (button opacity 1)
- Old expectation INVERTED: Colorless previously had no `aria-pressed` — it now mirrors its state (§6.5)

> **Generator note:** `tests/e2e/color-picker.spec.ts` is already correct at HEAD
> (`0321b69`): button computed `opacity` 1 everywhere, 40% on the icon wrapper
> `span`; Colorless comment reflects `aria-pressed="true"` when current = `["c"]`.
> Keep as-is.

---

### TC-6.5: Backdrop/Escape closes (colors already applied)

**Description:** WYSIWYG — dismissing keeps applied colors. No discard.

**Steps:**
1. Open Color Picker for Player 1
2. Tap Blue → zone preview updates to red+blue gradient (dialog stays open)
3. Click backdrop or press Escape

**Expected Results:**
- Dialog closes
- Player 1 remains red+blue gradient (applied on tap, no revert)

---

### TC-6.7: [NEW] Keyboard focus renders a hugging outline at full strength

**Description:** §6.5 — the `:focus-visible` outline hugs the button
(`outline-offset: 0`); the old 4px-offset detached ring is gone. The outline
renders full strength even on unselected buttons: the 40% dim lives on the icon
wrapper, not the button.

**Steps:**
1. Open Color Picker for Player 1 (default `["r"]`)
2. Press `Tab` (keyboard — mouse clicks do not trigger `:focus-visible`) until a
   wheel button receives focus; focus an UNSELECTED button (e.g. Blue or Green)

**Expected Results:**
- Focused button computed outline: `outline-style: solid`, `outline-width: 2px`,
  `outline-offset: 0px` (hugging — NO 4px offset); the color is DESIGN §6.5
  `--color-ui-textLight` → `rgb(250, 248, 245)` — assert it exactly
- Outline not dimmed on unselected buttons: button computed `opacity` stays 1
  (the icon wrapper carries the 40%)

3. `Tab` to the selected (Red) button

**Expected Results:**
- Same hugging outline (`outline-offset: 0px`); the selected ring + scale +
  `z-10` treatment (TC-6.6) is unchanged and renders solid together with focus

---

### TC-6.8: [NEW] Wheel button box == icon box (colorless regression guard)

**Description:** Every wheel button's bounding box equals its icon's
(`span[role="img"]`) bounding box — width and height equal within ±0.5px — for
Colorless AND at least one WUBRG button, in BOTH unselected and selected
states. Regression guard: `ColorlessButton`'s `<button>` was missing
`MANA_BTN_SIZE` (fixed in `d8ad657`), so the button box was ~7px taller than
its icon (extra gap above the icon) → the selection ring / focus ring wrapped a
detached, wrong box ("doesn't fit").

**Steps:**
1. Open Color Picker for Player 1 (default `["r"]`)

**Expected Results:**
- Red (selected, `aria-pressed="true"`) AND Colorless (unselected,
  `aria-pressed="false"`): button box == its `span[role="img"]` box — `|Δw| ≤
  0.5px` and `|Δh| ≤ 0.5px`; top edges also match (`|Δtop| ≤ 0.5px` — no 7px
  gap)
- Selected includes `scale-110`: the ancestor transform scales button AND icon
  subtree together, so boxes stay equal — both at the scaled size (~77.2×77.2
  vs ~70.2×70.2 unselected; absolute px is viewport-dependent, `18cqmin`)

2. Tap Colorless (C) → single-tap apply, dialog closes; reopen the picker
   (Colorless now selected)

**Expected Results:**
- Colorless (selected): button box == icon box within ±0.5px, both at the
  `scale-110` size
- Red (now unselected): button box == icon box within ±0.5px at the base size

> **Generator note:** add the assertion to `tests/e2e/color-picker.spec.ts` —
> measure `button.boundingBox()` vs its `span[role="img"]` bounding box via
> `page.evaluate` `getBoundingClientRect()` rects (robust to `scale-110` —
> ancestor transforms are included in the rect), assert `|Δw| ≤ 0.5 && |Δh| ≤
> 0.5` (optionally `Δtop`/`Δleft`) in both states. Do NOT assert absolute px
> sizes — viewport-dependent.

---

## Suite 7: Counters Overlay (§7.4)

### TC-7.1: Swipe right opens counters overlay

**Description:** Swiping right on a player zone opens the Counters overlay.

**Steps:**
1. On Player 1 zone, perform a swipe-left gesture (≥10px horizontal movement, <300ms; P1 is 180° so player-right = physical-left)

**Expected Results:**
- Counters overlay opens as a full-screen dialog with `id="counters-0"`
- Heading: "Counters"
- Background: `#1a1a1a`
- Gesture works via `useSwipe` hook

2. Perform any X-direction swipe on the overlay

**Expected Results:**
- Overlay closes, returns to life view

---

### TC-7.2: 4 default counters visible

**Description:** Default game counters (Poison, Energy, Experience, Time) are always present.

**Steps:**
1. Open Counters overlay for Player 1

**Expected Results:**
- 2-column grid with 4 default counters:

  | Icon | Name | Initial Value |
  |------|------|---------------|
  | ☠️ | Poison | 0 |
  | ⚡ | Energy | 0 |
  | ✦ | Experience | 0 |
  | ⏳ | Time | 0 |

- Each counter row has: icon (iconLight), value display (Archivo Bold), `[-]` and `[+]` buttons
- `[+]` button at bottom-right (`aria-label="Add custom counter"`)
- Counters fill rows left-to-right, top-to-bottom

---

### TC-7.3: Custom counter modal adds new counter

**Description:** The [+] button opens §6.6 Custom Counter modal.

**Steps:**
1. Open Counters overlay → tap `[+]` button

**Expected Results:**
- Custom Counter modal opens (sibling `<dialog>`)
- Heading: "Custom Counter"
- Text input: placeholder "Counter", `maxLength=35`, auto-focused, warm white text
- `+ Add` submit button (borderless, warm white)

2. Type `"Lore"` in the input
3. Tap `+ Add` (or press Enter)

**Expected Results:**
- Modal closes
- New custom counter "Lore" appears in counters grid (value 0)
- Displayed as rounded pill `#CAC5C0` with first letter (iconDark)

4. Tap `[+]` on Lore counter

**Expected Results:**
- Value increments to 1

5. Tap `[-]` on Lore counter twice

**Expected Results:**
- Value goes to 0 (floor — `Math.max(0, ...)`)
- Cannot go below 0

---

### TC-7.4: Restart clears custom counters

**Description:** Custom counters do not survive a restart.

**Steps:**
1. Add custom counter "Lore" via TC-7.3
2. Close overlay, open belt, tap Restart Life
3. Reopen Counters overlay

**Expected Results:**
- Only 4 default counters present
- Custom counter "Lore" is absent
- Default counters all reset to 0

---

## Assumptions

- All tests start from a fresh/blank state (page reload or restart via Restart Life)
- Dev server runs at `http://localhost:3000`
- Browser viewport ≥ 480px wide (no mobile-specific behavior)
- Tests are independent and can run in any order

## Failure Conditions

- Console errors during any interaction
- Modal fails to open/close
- Preset selection does not update life totals
- Player count change does not propagate to DOM
- Color change does not update zone background
- Wheel selection state not reflected (missing ring, dim applied to the button instead of the icon wrapper, focus outline not hugging/`outline-offset: 0`, missing `aria-pressed`)
- Custom counter operations fail silently
- ARIA labels missing or incorrect
