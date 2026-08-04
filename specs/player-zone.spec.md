# Player Zone — Test Plan (DESIGN.md §4.1–4.3, §7.1, §8.3, §9)

## Application Overview

MTG Life Counter — Player Zone milestone (branch `feature/player-zone`). Two player zones on a full-viewport vertical split: Player 1 (blue mana #C1D7E9, rotated 180°) on top, Player 2 (red mana #E49977) on bottom, both starting at 40 life. Each zone has a massive Archivo Black life total with aria-live="polite", and −/+ buttons with tap = ±1 and hold acceleration.

## Test Scenarios

### 1. Board Rendering

**Seed:** `tests/seed.spec.ts`

#### 1.1. Board renders two zones in an equal vertical split, P1 on top

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to /
    - expect: Exactly 2 elements match page.getByRole('region', { name: /^Player \d:/ }), both visible
  2. Read bounding boxes of p1 and p2
    - expect: p1 box top ≈ 0; p2 box top ≈ viewport.height / 2 (±2px)
    - expect: Heights equal (±2px); each ≈ 50% of viewport height
    - expect: Both widths equal the viewport width

#### 1.2. Top zone (P1) is rotated 180°, bottom zone (P2) is not rotated

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Evaluate the wrapper of each zone
    - expect: P1 wrapper inline transform is rotate(180deg)
    - expect: P2 wrapper transform is rotate(0deg) or none

#### 1.3. Mana background colors are applied per player

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Assert computed background-color on each region
    - expect: P1 (blue mana) background-color = rgb(193, 215, 233) = #C1D7E9
    - expect: P2 (red mana) background-color = rgb(228, 153, 119) = #E49977

### 2. Life Display & Tap Adjustment

**Seed:** `tests/seed.spec.ts`

#### 2.1. Both players start at 40 life with massive typography

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to /; locate life totals via p1.locator('[aria-live="polite"]')
    - expect: Both life totals display the exact text 40
    - expect: font-size ≥ 64px
    - expect: font-weight = 900
    - expect: font-family contains Archivo

#### 2.2. Tap + and − adjust by exactly 1, independently per player

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Click p1 +1 once and p2 +1 three times
    - expect: P1 reads 41; P2 reads 43
  2. Click p2 -1 once
    - expect: P2 reads 42; P1 still reads 41

### 3. Hold Acceleration

**Seed:** `tests/seed.spec.ts`

#### 3.1. Short hold (~700-800ms) engages the ±5 repeat step

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Hold p1 +1 for 750ms
    - expect: P1 life is within [46, 60]
    - expect: Strictly greater than 41, strictly less than ±10 regime

#### 3.2. Long hold (~1.6-1.8s) accelerates to the ±10 step

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Hold p1 +1 for 1700ms
    - expect: P1 life ≥ 80
    - expect: Upper sanity bound ≤ 130

#### 3.3. Releasing the button stops adjustment immediately

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Hold p1 +1 for 600ms, release, wait 400ms, read again
    - expect: Life unchanged after release
    - expect: Value within [41, 56]

### 4. Lethal State

**Seed:** `tests/seed.spec.ts`

#### 4.1. Life ≤ 0 turns danger red; recovering restores dark text

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Hold p1 -1 until life ≤ 0
    - expect: Life total ≤ 0
    - expect: Color is rgb(213, 0, 0) = danger red
  2. Click +1 until life > 0
    - expect: Color returns to rgb(26, 26, 26) = #1A1A1A
    - expect: P2 unchanged

### 5. Keyboard & Focus

**Seed:** `tests/seed.spec.ts`

#### 5.1. Tab reaches all four buttons with visible focus ring

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Press Tab four times
    - expect: Tab 1 → p1 -1 focused
    - expect: Tab 2 → p1 +1 focused
    - expect: Tab 3 → p2 -1 focused
    - expect: Tab 4 → p2 +1 focused
    - expect: outline-style = solid, outline-width = 2px

#### 5.2. Enter and Space adjust by exactly 1

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Tab to p1 +1, press Enter, then Space
    - expect: P1 reads 42 after both presses
    - expect: No hold-repeat from keyboard

### 6. ARIA & Announcements

**Seed:** `tests/seed.spec.ts`

#### 6.1. Zones announce 'Player N: X life' and stay in sync

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Assert region names
    - expect: Player 1: 40 life and Player 2: 40 life resolve
  2. Click +1 on P1 then re-query
    - expect: Region now resolves as Player 1: 41 life
    - expect: Old name Player 1: 40 life resolves to 0 elements

#### 6.2. Buttons have correct labels; life total is a polite live region

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Assert button labels within each zone
    - expect: Each zone has exactly one -1 life and one +1 life button
  2. Assert aria-live attributes
    - expect: aria-live=polite, aria-atomic=true present on both zones

### 7. Contrast & Touch Targets

**Seed:** `tests/seed.spec.ts`

#### 7.1. Life text is warm near-black #1A1A1A on both backgrounds

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Assert computed color on both zones
    - expect: P1: text rgb(26, 26, 26) on rgb(193, 215, 233)
    - expect: P2: text rgb(26, 26, 26) on rgb(228, 153, 119)
    - expect: Both exceed 4.5:1 AA

#### 7.2. All buttons meet 44×44px minimum touch target

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Read boundingBox of all 4 buttons
    - expect: Every button width ≥ 44 and height ≥ 44

### 9. Swipe Gestures (§7.2)

**Seed:** `tests/seed.spec.ts`

#### 9.1. Swipe left opens Commander Damage overlay; swipe right opens Counters overlay

Gestures are **player-relative** (per DESIGN.md §7.2 / §4.3). P2 (rotation 0) uses physical screen direction. P1 (rotation 180°, top slot) inverts it: physical **right** = player-left = Commander; physical **left** = player-right = Counters.

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
   1. Navigate to `/`
   2. Swipe right (~50px) on the P1 zone (wrapper `<div>`) — player-left on the 180° slot
     - expect: Commander Damage dialog appears with `aria-labelledby="commander-damage-title"`
   3. Press Escape to close
     - expect: Dialog closes
   4. Swipe left (~50px) on the P1 zone
     - expect: Counters dialog appears with `aria-labelledby="counters-title"`
   5. Press Escape to close
     - expect: Dialog closes

#### 9.2. Short vertical jab (<10px) does not trigger a swipe

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
   1. Navigate to `/`
   2. Press `pointerdown` on P1 zone, move 5px down, `pointerup`
     - expect: No dialogs open — life total unchanged
    3. Tap P1 `+1 life` button normally
      - expect: Life reads 41 — tap gesture not conflicting with swipe

#### 9.3. Backdrop click dismisses Commander Damage dialog

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
   1. Navigate to `/`
   2. Swipe left on P1 zone → Commander Damage dialog opens
   3. Click the dialog backdrop (top-left corner, outside content)
      - expect: Dialog closes

#### 9.4. Backdrop click dismisses Counters dialog

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
   1. Navigate to `/`
   2. Swipe right on P1 zone → Counters dialog opens
   3. Click the dialog backdrop (top-left corner, outside content)
      - expect: Dialog closes
