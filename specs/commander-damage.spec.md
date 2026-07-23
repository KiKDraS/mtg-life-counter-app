# Commander Damage Overlay — Test Plan (DESIGN.md §7.3)

## Application Overview

MTG Life Counter — Commander Damage overlay (branch `feature/player-zone`). Each player zone supports swipe-left to open a full-screen Commander Damage dialog (§7.3). The overlay shows the opponent's mana-color pill with a Planeswalker symbol, the current commander damage total (starting at 0), and a [+] button. Tap [+] adds 1 commander damage while simultaneously reducing that player's life total by 1. Hold [+] accelerates to +10 after 1000ms. At 21+ damage, the damage count turns danger red (`#D50000`) and a "Lethal — Player loses" badge appears; the player's life total also turns red. The overlay closes via swipe-left/right on the overlay content, backdrop click, or Escape.

Players are P1 (blue `u`, rotated 180°) and P2 (red `r`). Each player's Commander Damage overlay displays the opponent's color pill (P1 sees red `r` opponent pill, P2 sees blue `u` opponent pill).

## Constants Reference

| Constant | Value | Description |
|---|---|---|
| `UI.danger` | `rgb(213, 0, 0)` | Danger red for lethal state |
| `MANA.r` | `#E49977` → `rgb(228, 153, 119)` | Red mana background |
| `MANA.u` | `#C1D7E9` → `rgb(193, 215, 233)` | Blue mana background |
| `HOLD_DELAY_MS` | 1000 | Time before hold acceleration fires |
| `HOLD_STEP` | 10 | Accelerated step on hold |
| `SWIPE_THRESHOLD_PX` | 10 | Minimum px for swipe gesture |
| `SWIPE_TIMEOUT_MS` | 300 | Max ms for swipe gesture |

---

## 1. Opening the Overlay

**Seed:** `tests/seed.spec.ts`

### 1.1. Swipe left opens Commander Damage dialog

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Perform a horizontal swipe left (~50px, < 300ms) on the P1 zone wrapper `<div>`
    - expect: A dialog with `aria-labelledby="commander-damage-title"` opens
    - expect: The dialog is contained within P1's half of the viewport
  3. Press Escape to close P1 dialog
  4. Swipe left on the P2 zone wrapper `<div>`
    - expect: The same dialog opens for P2

### 1.2. Swipe left while overlay is open closes it (toggle)

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog appears
    - expect: Dialog is open (visible)
  3. Swipe left on P1 zone again
    - expect: Dialog closes (no longer open)
  4. Swipe left on P1 zone a third time
    - expect: Dialog opens again

### 1.3. Short vertical jab (<10px) does not trigger the overlay

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Simulate a pointerdown on P1 zone, move 5px down (vertical), pointerup
    - expect: No Commander Damage dialog opens
    - expect: Life total unchanged (still 40)
  3. Tap P1 `+1 life` button normally
    - expect: Life reads 41 — tap gesture not conflicting with swipe detection

### 1.4. Slow horizontal drag (>300ms) does not trigger the overlay

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Simulate pointerdown on P1 zone, wait 400ms, move 50px left, pointerup
    - expect: No Commander Damage dialog opens (gesture exceeded `SWIPE_TIMEOUT_MS`)
    - expect: Life total unchanged

### 1.5. Backdrop click dismisses Commander Damage dialog

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Click the dialog backdrop (top-left corner of the dialog, outside the content area)
    - expect: Dialog closes
    - expect: P1 life unchanged

---

## 2. Layout & Content

**Seed:** `tests/seed.spec.ts`

### 2.1. Heading renders with correct text and aria reference

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Locate the element with `id="commander-damage-title"`
    - expect: Text content reads exactly `Commander Damage`
    - expect: It is an `<h2>` element
  4. Assert the dialog's `aria-labelledby` attribute
    - expect: `aria-labelledby="commander-damage-title"` is set on the `<dialog>`

### 2.2. Opponent color pill renders with Planeswalker symbol

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens (P1's opponent is red `r`)
  3. Locate the opponent pill: a `<span>` with `rounded-full` and a colored background
    - expect: The pill contains an `<img>` with accessible name `Planeswalker symbol`
    - expect: The pill `background-color` equals `rgb(228, 153, 119)` (red mana `#E49977`)
  4. Press Escape to close
  5. Swipe left on P2 zone (P2's opponent is blue `u`)
    - expect: The pill `background-color` equals `rgb(193, 215, 233)` (blue mana `#C1D7E9`)

### 2.3. Damage counter starts at 0

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Locate the damage counter (a `<span>` with `aria-live="polite"` and `tabular-nums`)
    - expect: The displayed text is `0`
    - expect: The element has `aria-live="polite"` and `aria-atomic="true"`
    - expect: The computed `font-weight` is `900` (black)
    - expect: The computed `font-variant-numeric` includes `tabular-nums`

### 2.4. [+] button renders with correct label

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Locate the button by `aria-label="+1 commander damage"`
    - expect: The button is visible and enabled
    - expect: The button text content is `+`
    - expect: The button has class `select-none` and `touch-manipulation`

---

## 3. Damage Adjustment

**Seed:** `tests/seed.spec.ts`

### 3.1. Tap [+] adds exactly 1 commander damage

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
    - expect: Damage counter reads `0`
  3. Tap the `+1 commander damage` button once
    - expect: Damage counter reads `1`
  4. Tap the button three more times
    - expect: Damage counter reads `4`
  5. Tap the button twice more
    - expect: Damage counter reads `6`

### 3.2. Tap [+] is independent per player

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → tap [+] five times
    - expect: P1 damage reads `5`
  3. Close P1 dialog (Escape), swipe left on P2 zone
    - expect: P2 damage reads `0`
  4. Tap P2 [+] three times
    - expect: P2 damage reads `3`
  5. Close P2 dialog, swipe left on P1 zone
    - expect: P1 damage still reads `5`

### 3.3. Hold [+] accelerates to +10 after 1000ms

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
    - expect: Damage reads `0`
  3. Hold (pointerdown) the `+1 commander damage` button for 1200ms, then release
    - expect: Damage reads at least `10` (hold timer fires `+10` after ~1000ms)
    - expect: The pending tap `+1` on click is suppressed (total not `+11`)
    - expect: Upper sanity bound: damage ≤ 15 (hold fires at most once)

### 3.4. Repeated taps accumulate correctly

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Tap [+] twenty times
    - expect: Damage counter reads `20`

---

## 4. Life Reduction

**Seed:** `tests/seed.spec.ts`

### 4.1. Adding commander damage reduces life total by the same amount

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
    - expect: P1 life reads `40`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Tap `+1 commander damage` button five times
    - expect: Damage counter reads `5`
  4. Close the dialog
  5. Read P1 life total (outside dialog, in the zone)
    - expect: P1 life reads `35` (40 − 5)
  6. Tap P1 `+1 life` once
    - expect: P1 life reads `36` — normal life adjustments still work

### 4.2. Life reduction is independent per player

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 → tap [+] three times (damage=3), close
  3. Swipe left on P2 → tap [+] seven times (damage=7), close
    - expect: P1 life = 37, P2 life = 33
    - expect: P1 damage = 3, P2 damage = 7

### 4.3. Commander damage does not reduce opponent's life

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 → tap [+] ten times, close
    - expect: P1 life = 30 (40 − 10)
    - expect: P2 life = 40 (unchanged)

### 4.4. Hold [+] also reduces life by the accelerated amount

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 → hold [+] for 1200ms
    - expect: Damage reads at least `10`
  3. Close dialog, read P1 life
    - expect: P1 life ≤ 30 (reduced by 10+)

### 4.5. Life can go negative from commander damage

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 → tap [+] 41 times (start=40 life, 40−41 = −1)
    - expect: Damage reads `41`
  3. Close dialog, read P1 life
    - expect: P1 life reads `−1`
    - expect: Life total is danger red (`rgb(213, 0, 0)`) — lethal from zero life

---

## 5. Lethal State

**Seed:** `tests/seed.spec.ts`

### 5.1. Damage text turns danger red at exactly 21

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 → tap [+] twenty times (damage=20)
    - expect: Damage counter text color is NOT `rgb(213, 0, 0)`
    - expect: "Lethal — Player loses" badge is NOT visible
  3. Tap [+] once more (damage=21)
    - expect: Damage counter reads `21`
    - expect: Damage counter computed `color` equals `rgb(213, 0, 0)` (danger red)
    - expect: A paragraph with text "Lethal — Player loses" appears
    - expect: The paragraph `color` equals `rgb(213, 0, 0)`
    - expect: The paragraph has `font-weight` `700` (bold) and `uppercase`

### 5.2. Player life total also turns red when commander damage ≥ 21

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 → tap [+] 21 times (damage=21, life=19)
  3. Close dialog
    - expect: P1 life total text `color` equals `rgb(213, 0, 0)` (danger red)
    - expect: P2 life total is NOT red (still normal color)

### 5.3. Recovery from lethal state when damage drops below 21 is not possible via UI

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 → tap [+] 21 times (damage=21)
    - expect: Lethal badge visible, damage is danger red
  3. Note: The overlay has no [-] button to reduce commander damage (by design)
    - expect: There is no way within the overlay to reduce commander damage
  4. Escape to close
    - expect: Life total remains red (still lethal from commander damage ≥ 21)
  5. Tap P1 `-1 life` to drive life to 0
    - expect: Life total still red (no change in color)

### 5.4. Commander damage persists across open/close cycles

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 → tap [+] 5 times, close
  3. Reopen P1 Commander Damage overlay
    - expect: Damage reads `5` (persisted)
  4. Tap [+] 16 times (total=21)
    - expect: Lethal badge appears, damage is danger red
  5. Close and reopen
    - expect: Damage still reads `21`
    - expect: Lethal badge still visible
    - expect: Life total still red

---

## 6. Closing the Overlay

**Seed:** `tests/seed.spec.ts`

### 6.1. Swipe left on overlay content closes the dialog

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
    - expect: Dialog is open
  3. Perform a swipe left on the overlay content (the `<div>` inside the dialog)
    - expect: Dialog closes
    - expect: P1 life unchanged by the swipe gesture itself
  4. Swipe left on P1 zone to reopen, then swipe right on overlay content
    - expect: Dialog also closes (both directions close)

### 6.2. Escape key closes the dialog

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Press Escape
    - expect: Dialog closes
    - expect: P1 life unchanged
  4. Reopen and press Escape again
    - expect: Dialog closes

### 6.3. Commander Damage overlay is scoped to its player zone

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → P1 Commander Damage opens
    - expect: Dialog bounding box is within P1's viewport half (top half)
  3. Close via Escape
  4. Swipe left on P2 zone → P2 Commander Damage opens
    - expect: Dialog bounding box is within P2's viewport half (bottom half)
    - expect: P2 damage counter shows opponent pill for blue (P2's opponent is blue `u`)

### 6.4. Overlay does not interfere with other zone interactivity

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 → Commander Damage opens
  3. Close via Escape
    - expect: P1 `+1 life` button works normally (tap → life reads 41)
    - expect: P2 `+1 life` button works normally (tap → life reads 41)
    - expect: Swipe right on P1 zone opens Counters dialog (other overlay unaffected)
  4. Close Counters via Escape

---

## 7. Accessibility & Edge Cases

**Seed:** `tests/seed.spec.ts`

### 7.1. Dialog has correct ARIA modal attributes

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
    - expect: `<dialog>` has `aria-modal="true"`
    - expect: `<dialog>` has `aria-labelledby="commander-damage-title"`
    - expect: `<h2 id="commander-damage-title">` exists with text `Commander Damage`

### 7.2. [+] button maintains 44×44px minimum touch target

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Read bounding box of `aria-label="+1 commander damage"`
    - expect: width ≥ 44px and height ≥ 44px

### 7.3. Damage counter has accessible announcements

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Locate the damage counter element
    - expect: `aria-live="polite"` is present
    - expect: `aria-atomic="true"` is present
  4. Tap [+] three times
    - expect: Element text updates `0` → `1` → `2` → `3` (announced by screen reader)

### 7.4. Dialog does not trap focus incorrectly

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to `/`
  2. Swipe left on P1 zone → Commander Damage dialog opens
  3. Press Tab
    - expect: The `+1 commander damage` button receives focus (only interactive element inside overlay)
  4. Press Tab again
    - expect: Focus wraps or stays within the dialog (native `<dialog>` focus trap)
  5. Press Escape to close
    - expect: Dialog closes, focus returns to the triggering zone
