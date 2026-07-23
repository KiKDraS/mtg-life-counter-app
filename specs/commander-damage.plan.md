# Commander Damage Overlay Test Plan

## Application Overview

MTG Life Counter — Commander Damage overlay (§7.3). Each player zone supports swipe-left to open a full-screen dialog showing opponent's color pill with Planeswalker symbol, damage total (starting at 0), and [+] button. Tap [+] adds 1 commander damage while reducing life by 1. Hold [+] accelerates to +10 after 1000ms. At 21+ damage: damage turns danger red, "Lethal — Player loses" badge appears, player life total turns red. Close via swipe on overlay, backdrop click, or Escape.

## Test Scenarios

### 1. Opening the Overlay

**Seed:** `tests/seed.spec.ts`

#### 1.1. Swipe left opens Commander Damage dialog

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to /
    - expect: Page loads with two player zones
  2. Swipe left (~50px, <300ms) on P1 zone wrapper
    - expect: Dialog with aria-labelledby="commander-damage-title" opens
    - expect: Dialog contained within P1 viewport half
  3. Press Escape
    - expect: Dialog closes
  4. Swipe left on P2 zone wrapper
    - expect: Same dialog opens for P2

#### 1.2. Swipe left while overlay open closes it (toggle)

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to /, swipe left on P1
    - expect: Dialog is open
  2. Swipe left on P1 again
    - expect: Dialog closes
  3. Swipe left on P1 third time
    - expect: Dialog opens again

#### 1.3. Vertical jab does not trigger overlay

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to /, pointerdown on P1, move 5px down, pointerup
    - expect: No dialog opens
    - expect: Life unchanged at 40
  2. Tap P1 +1 life
    - expect: Life reads 41

#### 1.4. Slow drag does not trigger overlay

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Navigate to /, pointerdown on P1, wait 400ms, move 50px left, pointerup
    - expect: No dialog opens
    - expect: Life unchanged

#### 1.5. Backdrop click dismisses dialog

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Swipe left on P1 to open dialog
    - expect: Dialog opens
  2. Click dialog backdrop (top-left outside content)
    - expect: Dialog closes
    - expect: Life unchanged

### 2. Layout & Content

**Seed:** `tests/seed.spec.ts`

#### 2.1. Heading renders correctly

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Swipe left on P1, locate h2#commander-damage-title
    - expect: Text is 'Commander Damage'
    - expect: Is h2 element
    - expect: Dialog has aria-labelledby="commander-damage-title"

#### 2.2. Opponent color pill with Planeswalker symbol

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog (opponent=red), check pill
    - expect: Contains img 'Planeswalker symbol'
    - expect: Background = rgb(228, 153, 119) red
  2. Close, open P2 dialog (opponent=blue)
    - expect: Pill background = rgb(193, 215, 233) blue

#### 2.3. Damage counter starts at 0

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog, check damage counter
    - expect: Text is '0'
    - expect: aria-live=polite, aria-atomic=true
    - expect: font-weight=900
    - expect: tabular-nums

#### 2.4. Plus button renders with correct label

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog, locate button by aria-label
    - expect: Button visible and enabled
    - expect: Text is '+'
    - expect: Has select-none and touch-manipulation

### 3. Damage Adjustment

**Seed:** `tests/seed.spec.ts`

#### 3.1. Tap plus adds exactly 1

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog, tap + once
    - expect: Damage reads 1
  2. Tap + three more times
    - expect: Damage reads 4
  3. Tap + two more times
    - expect: Damage reads 6

#### 3.2. Per-player independence

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1, tap + five times, close
    - expect: P1 damage = 5
  2. Open P2
    - expect: P2 damage = 0
  3. Tap P2 + three times, close
    - expect: P2 damage = 3
  4. Reopen P1
    - expect: P1 damage still = 5

#### 3.3. Hold accelerates to +10 after 1000ms

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1, hold + for 1200ms then release
    - expect: Damage >= 10
    - expect: Not +11 (tap suppressed)
    - expect: Upper bound <= 15

#### 3.4. Repeated taps accumulate

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1, tap + twenty times
    - expect: Damage reads 20

### 4. Life Reduction

**Seed:** `tests/seed.spec.ts`

#### 4.1. Commander damage reduces life equally

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1, tap + five times (damage=5), close
    - expect: P1 life = 35 (40-5)
  2. Tap P1 +1 life button
    - expect: P1 life = 36, normal life adjustments work

#### 4.2. Life reduction is independent per player

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. P1 tap + three times, close. P2 tap + seven times, close
    - expect: P1 life = 37, P2 life = 33

#### 4.3. Only own life reduced

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. P1 tap + ten times, close
    - expect: P1 life = 30, P2 life = 40 unchanged

#### 4.4. Hold also reduces life

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1, hold + for 1200ms, close
    - expect: Damage >= 10, life <= 30

#### 4.5. Life can go negative

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. P1 tap + 41 times, close
    - expect: Damage = 41, life = -1
    - expect: Life total is danger red

### 5. Lethal State

**Seed:** `tests/seed.spec.ts`

#### 5.1. Damage turns red at exactly 21 with badge

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. P1 tap + twenty times (damage=20)
    - expect: Damage NOT danger red
    - expect: No lethal badge
  2. Tap + once more
    - expect: Damage = 21
    - expect: Damage color = rgb(213,0,0)
    - expect: 'Lethal - Player loses' paragraph appears
    - expect: Paragraph is danger red, bold, uppercase

#### 5.2. Life total also turns red

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. P1 tap + 21 times, close
    - expect: P1 life color = rgb(213,0,0)
    - expect: P2 life NOT red

#### 5.3. No UI to reduce commander damage

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. P1 tap + 21 times
    - expect: Lethal badge visible, damage red
  2. Inspect overlay
    - expect: No [-] button for commander damage

#### 5.4. State persists across open/close

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. P1 tap + 5 times, close, reopen
    - expect: Damage = 5 persisted
  2. Tap + 16 times (total=21), close, reopen
    - expect: Damage = 21, lethal badge visible, life red

### 6. Closing the Overlay

**Seed:** `tests/seed.spec.ts`

#### 6.1. Swipe on overlay content closes

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog, swipe left on content
    - expect: Dialog closes
    - expect: Life unchanged
  2. Reopen, swipe right on content
    - expect: Dialog closes (both directions)

#### 6.2. Escape closes dialog

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog, press Escape
    - expect: Dialog closes
    - expect: Life unchanged

#### 6.3. Overlay scoped to player zone

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog
    - expect: Bounding box in top viewport half
  2. Open P2 dialog
    - expect: Bounding box in bottom viewport half
    - expect: Opponent pill shows blue

#### 6.4. No interference with other interactivity

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 commander, close via Escape
    - expect: P1 +1 life works (41)
    - expect: P2 +1 life works (41)
    - expect: Swipe right opens Counters dialog

### 7. Accessibility & Edge Cases

**Seed:** `tests/seed.spec.ts`

#### 7.1. ARIA modal attributes correct

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog
    - expect: aria-modal=true
    - expect: aria-labelledby=commander-damage-title
    - expect: h2 exists with correct text

#### 7.2. Touch target minimum 44x44px

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog, measure + button
    - expect: width >= 44px
    - expect: height >= 44px

#### 7.3. Damage counter announces changes

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog, check counter
    - expect: aria-live=polite, aria-atomic=true
  2. Tap + three times
    - expect: Text updates 0->1->2->3

#### 7.4. Focus behavior

**File:** `tests/e2e/commander-damage.spec.ts`

**Steps:**
  1. Open P1 dialog, press Tab
    - expect: Focus on +1 commander damage button
  2. Press Tab again
    - expect: Focus wraps within dialog
  3. Press Escape
    - expect: Dialog closes
