# Counters Overlay & Custom Counter Dialog — Test Plan

## Application Overview

MTG Life Counter — Counters Overlay (§7.4) and Custom Counter Name Modal (§6.6). The Counters overlay is a full-screen dialog triggered by swiping right on a player zone. It displays a 2-column grid of trackable game counters (poison, energy, experience, time) each with value display, +/- buttons, tap ±1, hold ±10 after 1s. A [+] button at bottom-right opens the Custom Counter Name modal — a native `<dialog>` with lighter backdrop (rgba(0,0,0,0.35)), auto-focused input (maxLength=35, placeholder "Counter"), and [+ Add] button. Empty input does nothing; non-empty adds the counter to the grid with a first-letter pill. Poison at 10+ triggers lethal state (danger red).

## Test Scenarios

### 1. Counters Overlay Layout & Content

**Seed:** `tests/seed.spec.ts`

#### 1.1. Counters overlay opens via swipe right and displays heading

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /
    - expect: Page loads with two player zones
  2. Swipe left (~50px, <300ms) on the P1 zone wrapper (P1 is 180° → player-right is physical-left)
    - expect: A dialog with aria-labelledby="counters-title" opens
    - expect: Dialog is contained within P1's viewport half
  3. Locate the element with id="counters-title"
    - expect: Text content reads exactly "Counters"
    - expect: It is an <h2> element
  4. Assert the dialog's aria-labelledby attribute
    - expect: aria-labelledby="counters-title" is set on the <dialog>
    - expect: aria-modal="true" is set on the <dialog>

#### 1.2. Four default counters render with icons

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone to open Counters overlay
    - expect: Counters overlay dialog is open
  2. Check for default counter icons
    - expect: "Poison counter" icon is visible
    - expect: "Energy counter" icon is visible
    - expect: "Experience counter" icon is visible
    - expect: "Time counter" icon is visible
  3. Verify each counter value starts at 0
    - expect: All four counters display "0"
  4. Verify each counter has [+]/[-] buttons with correct labels
    - expect: Button "-1 poison counter" exists
    - expect: Button "+1 poison counter" exists
    - expect: Button "-1 energy counter" exists
    - expect: Button "+1 energy counter" exists
    - expect: Button "-1 experience counter" exists
    - expect: Button "+1 experience counter" exists
    - expect: Button "-1 time counter" exists
    - expect: Button "+1 time counter" exists
  5. Verify the grid is 2-column
    - expect: The grid container has CSS class grid-cols-2

#### 1.3. [+] button renders at bottom-right

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone to open Counters overlay
    - expect: Counters overlay dialog is open
  2. Locate the + button by aria-label="Add custom counter"
    - expect: Button is visible and enabled
    - expect: Button text content is "+"
    - expect: Button has classes select-none and touch-manipulation
    - expect: Button is positioned bottom-right within the dialog

### 2. Counter Adjustment

**Seed:** `tests/seed.spec.ts`

#### 2.1. Tap [+]/[-] adjusts by exactly 1 per counter

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone to open Counters overlay
    - expect: Counters overlay dialog is open
    - expect: Poison counter reads 0
  2. Tap +1 poison counter once
    - expect: Poison counter reads 1
  3. Tap +1 poison counter three more times
    - expect: Poison counter reads 4
  4. Tap -1 poison counter twice
    - expect: Poison counter reads 2
  5. Tap -1 poison counter twice more
    - expect: Poison counter reads 0

#### 2.2. Counter adjustment is independent per player

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone, set poison to 5, close (Escape)
    - expect: P1 poison = 5
  2. Swipe right on P2 zone (bottom half)
    - expect: P2 Counters overlay opens
  3. Check P2 poison value
    - expect: P2 poison reads 0 (independent from P1)
  4. Set P2 energy to 3, close (Escape)
    - expect: P2 energy = 3
  5. Swipe left on P1 zone
    - expect: P1 poison still reads 5
    - expect: P1 energy still reads 0

#### 2.3. Hold [+] accelerates to +10 after 1s

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone to open Counters overlay
    - expect: Poison counter reads 0
  2. Hold (pointerdown) the +1 poison counter button for 1200ms, then release
    - expect: Poison counter >= 10
    - expect: Upper bound: poison <= 15 (hold fires at most once)

#### 2.4. Hold [-] also accelerates

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone, tap +1 poison 15 times (total=15)
    - expect: Poison counter reads 15
  2. Hold -1 poison counter for 1200ms, then release
    - expect: Poison counter <= 5

### 3. Poison Lethal State

**Seed:** `tests/seed.spec.ts`

#### 3.1. Poison at 10+ turns value danger red and life total red

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /
    - expect: P1 life reads 40
  2. Swipe left on P1 zone, set poison to 10 (tap +1 poison 10 times), close dialog
    - expect: Poison set to 10
  3. Read P1 life total
    - expect: P1 life = 30 (40 - 10)
    - expect: P1 life total color = rgb(213, 0, 0) (danger red)
  4. Check P2 life total
    - expect: P2 life = 40 (unchanged)
    - expect: P2 life total NOT danger red
  5. Reopen P1 Counters overlay
    - expect: Poison counter value = 10
    - expect: Poison counter color = rgb(213, 0, 0)

#### 3.2. Poison below 10 is not lethal

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone, set poison to 9, close dialog
    - expect: P1 poison = 9
  2. Read P1 life
    - expect: P1 life = 31 (40 - 9)
    - expect: P1 life total color is NOT rgb(213, 0, 0)
  3. Reopen P1 Counters, tap +1 poison once (total=10)
    - expect: Poison value turns rgb(213, 0, 0)

#### 3.3. Poison lethal persists across open/close

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone, set poison to 10, close
    - expect: Poison set to 10, life at 30, life is danger red
  2. Reopen P1 Counters overlay
    - expect: Poison still reads 10, still danger red
  3. Close and reopen again
    - expect: Poison still reads 10, still danger red
    - expect: Life still reads 30, still danger red

### 4. Counters Closing Mechanisms

**Seed:** `tests/seed.spec.ts`

#### 4.1. Backdrop click dismisses Counters overlay

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone
    - expect: Counters overlay opens
  2. Click the dialog backdrop (top-left corner, outside content area)
    - expect: Dialog closes
    - expect: P1 life total unchanged

#### 4.2. Escape dismisses Counters overlay

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone
    - expect: Counters overlay opens
  2. Press Escape
    - expect: Dialog closes
    - expect: P1 life total unchanged
  3. Reopen and press Escape again
    - expect: Dialog closes again

#### 4.3. Swipe on overlay content closes Counters overlay

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone
    - expect: Counters overlay opens
  2. Swipe left on the overlay content (the div inside the dialog)
    - expect: Dialog closes
    - expect: Commander Damage overlay was NOT opened (zone behind didn't react)
  3. Swipe left on P1 zone to reopen, then swipe right on overlay content
    - expect: Dialog also closes with right-direction swipe on content

### 5. Custom Counter Dialog — Modal

**Seed:** `tests/seed.spec.ts`

#### 5.1. Tapping [+] opens Custom Counter dialog (native <dialog>)

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1 zone to open Counters overlay
    - expect: Counters overlay is open
  2. Tap the "Add custom counter" button (+)
    - expect: A native <dialog> modal opens
    - expect: Dialog has aria-labelledby="custom-counter-title"
  3. Inspect the dialog
    - expect: Dialog backdrop is rgba(0,0,0,0.35) (lighter than the default bg-black/80)

#### 5.2. Custom Counter dialog has correct title and input

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, tap [+] to open Custom Counter dialog
    - expect: Dialog is open
  2. Locate h2#custom-counter-title
    - expect: Text content reads exactly "Custom Counter"
    - expect: It is an <h2> element with font-bold
  3. Locate the text input
    - expect: Input has placeholder "Counter"
    - expect: Input has maxLength=35
    - expect: Input is auto-focused (has focus on open)
  4. Locate the [+ Add] button
    - expect: Button text content is "+ Add"
    - expect: Button is type="button"
    - expect: Button is borderless

#### 5.3. Backdrop tap closes dialog without adding counter

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, tap [+] to open Custom Counter dialog
    - expect: Custom Counter dialog is open
  2. Type "Infect" in the input
    - expect: Input shows "Infect"
  3. Click the dialog backdrop (outside the modal content)
    - expect: Dialog closes
    - expect: No new counter appears in the Counters grid
  4. Count the counter rows
    - expect: Still 4 default counters (poison, energy, experience, time) — no custom counter added

#### 5.4. Escape closes dialog without adding counter

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, tap [+] to open Custom Counter dialog
    - expect: Custom Counter dialog is open
  2. Type "Monarch" in the input
    - expect: Input shows "Monarch"
  3. Press Escape
    - expect: Dialog closes
    - expect: No new counter appears in grid

#### 5.5. Empty input: [+ Add] button does nothing

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, tap [+] to open Custom Counter dialog
    - expect: Custom Counter dialog is open
  2. Leave input empty and tap [+ Add]
    - expect: Dialog stays open
    - expect: No new counter added
    - expect: No error UI appears
  3. Type only whitespace (spaces) and tap [+ Add]
    - expect: Dialog stays open
    - expect: No new counter added

#### 5.6. Enter key submits with non-empty input

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, tap [+] to open Custom Counter dialog
    - expect: Custom Counter dialog is open
  2. Type "Vial" in the input and press Enter
    - expect: Dialog closes
    - expect: A new custom counter "Vial" appears in the grid
  3. Verify custom counter display
    - expect: Counter shows pill with first letter "V"
    - expect: Value reads 0
    - expect: First letter is uppercase "V"
    - expect: Pill background = rgb(202, 197, 192) (#CAC5C0)
  4. Verify buttons
    - expect: Button "-1 Vial counter" exists
    - expect: Button "+1 Vial counter" exists

#### 5.7. [+ Add] button submits with non-empty input

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, tap [+] to open Custom Counter dialog
    - expect: Custom Counter dialog is open
  2. Type "City's Blessing" in the input and click [+ Add]
    - expect: Dialog closes
    - expect: A new custom counter "City's Blessing" appears in the grid
  3. Verify counter shows first letter
    - expect: Pill shows "C" (first letter, uppercase)
    - expect: Value reads 0

#### 5.8. Max length enforced (35 characters)

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, tap [+] to open Custom Counter dialog
    - expect: Custom Counter dialog is open
  2. Type a 40-character string into the input
    - expect: Input value is truncated to 35 characters (maxLength=35)

#### 5.9. Custom counter ± buttons work with tap and hold

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, add a custom counter "Ticks" via [+] dialog
    - expect: Custom counter "Ticks" appears with value 0
  2. Tap +1 Ticks counter three times
    - expect: Counter value reads 3
  3. Tap -1 Ticks counter once
    - expect: Counter value reads 2
  4. Hold +1 Ticks counter for 1200ms
    - expect: Counter value >= 12 (tap + hold acceleration)

#### 5.10. Multiple custom counters can be added

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, add custom counter "First" via [+] dialog
    - expect: "First" custom counter appears in grid
  2. Tap [+] again, add custom counter "Second" via dialog
    - expect: "Second" custom counter also appears in grid
  3. Verify both counters
    - expect: Grid shows 6 counters total (4 default + 2 custom)
    - expect: Each custom counter has correct first-letter pill

### 6. Custom Counter Dialog — Accessibility & Edge Cases

**Seed:** `tests/seed.spec.ts`

#### 6.1. Dialog has correct ARIA modal attributes

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, tap [+] to open Custom Counter dialog
    - expect: <dialog> has aria-modal="true"
    - expect: <dialog> has aria-labelledby="custom-counter-title"
    - expect: <h2 id="custom-counter-title"> exists with text "Custom Counter"
  2. Verify close mechanisms are keyboard accessible
    - expect: Escape key closes dialog

#### 6.2. Counter names with special characters render first letter uppercase

**File:** `tests/e2e/custom-counter-dialog.spec.ts`

**Steps:**
  1. Open Counters overlay, add custom counter "123abc" via dialog
    - expect: Custom counter appears in grid
  2. Check the pill display
    - expect: Pill shows "1" (first character, uppercase)
