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
| 6 | Color Picker | §6.5 wheel, multi-select, replace/add, Colorless, CheckCircle |
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
2. Tap White mana symbol → zone preview updates live
3. Tap CheckCircle ✓ → dialog closes
4. Verify P1 zone background changed from default red to white
5. Open belt → tap Restart Life
6. Check Player 1 zone color

**Expected Results:**
- Life totals reset to initialLife
- Player 1 zone **remains white** (color preserved)
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
1. With 4 players, set P1 to Blue (U), P2 to Black (B)
2. Open Players modal → select 2p
3. Verify P1=Blue, P2=Black, P3/P4 gone
4. Open Players modal → select 4p

**Expected Results:**
- P1 still Blue
- P2 still Black
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
- Default `["r"]` — Red highlighted (`aria-pressed="true"`)

---

### TC-6.3: Multi-select — replace default, add non-default

**Description:** Default `["r"]` replaced on tap. Non-default adds. Remove disallowed on last color.

**Steps:**
1. Open Color Picker for Player 1 (default `["r"]` → Red highlighted)
2. Tap White mana symbol

**Expected Results:**
- Red un-highlights, White highlights (`aria-pressed` toggles)
- Dialog stays open (no auto-close)
- Player 1 zone preview updates to white background (`#F8F6D8`)

3. Tap Blue mana symbol

**Expected Results:**
- White stays highlighted, Blue highlights
- Player 1 zone preview shows White+Blue gradient

4. Tap Blue again

**Expected Results:**
- Blue un-highlights (`aria-pressed="false"`)
- Player 1 zone returns to solid white

5. Tap Green

**Expected Results:**
- White stays highlighted, Green highlights
- Zone preview: White+Green gradient

6. Tap White mana symbol

**Expected Results:**
- White un-highlights (`aria-pressed="false"`)
- Zone preview: solid green (`#A3C095`)

---

### TC-6.4: Colorless closes immediately, CheckCircle closes

**Description:** Colorless = single-tap-apply. ✓ = confirm close.

**Steps:**
1. Open Color Picker for Player 1 (default `["r"]`)
2. Tap White → Red un-highlights, White highlights (dialog stays open)
3. Tap Blue → both highlighted (dialog stays open, gradient preview)
4. Tap Colorless (C) mana symbol

**Expected Results:**
- Dialog closes immediately
- Player 1 zone solid colorless (`#CAC5C0`)
- `PlayerState.color` = `["c"]`

5. Open Color Picker for Player 2 (default `["r"]`)
6. Tap White → zone preview updates to white (dialog stays open)
7. Tap CheckCircle ✓

**Expected Results:**
- Dialog closes
- Player 2 zone remains white (color already applied)

---

### TC-6.5: Backdrop/Escape closes (colors already applied)

**Description:** WYSIWYG — dismissing keeps applied colors. No discard.

**Steps:**
1. Open Color Picker for Player 1
2. Tap Blue → zone preview updates to blue (dialog stays open)
3. Click backdrop or press Escape

**Expected Results:**
- Dialog closes
- Player 1 remains Blue (applied on tap, no revert)

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
- Custom counter operations fail silently
- ARIA labels missing or incorrect
