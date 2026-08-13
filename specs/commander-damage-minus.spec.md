# Commander Damage Decrement ([-] button) Test Plan

## Application Overview

MTG Life Counter — Commander Damage overlay now has a [-] button per column (aria-label "-1 commander damage"), placed before [+]. Tap = -1 damage, hold = -10 after 1s (HOLD_DELAY_MS 1000, HOLD_STEP 10, 100ms repeat). Damage floors at 0; life = 40 - damage, decrement restores life only by applied delta. Lethal at >=21: damage + life turn danger red rgb(213,0,0), zone shows "Commander Damage Lethal" label. P1 is 180° rotated: physical swipe RIGHT opens its commander dialog; P2 physical LEFT. Life total visible on zone behind dialog. Spec targets 2-player grid, first column of P1's dialog (dialog id commander-dmg-0). All scenarios start from fresh game (seed tests/seed.spec.ts, goto /).

## Test Scenarios

### 1. Commander Damage Decrement

**Seed:** `tests/seed.spec.ts`

#### 1.1. CDM-01: Tap +3 then -1 shows damage 2, life reduced by net 2

**File:** `tests/e2e/commander-damage-minus.spec.ts`

**Steps:**
  1. Navigate to /
    - expect: P1 life reads 40
  2. Swipe right on P1 zone (180° slot) to open Commander Damage dialog
    - expect: dialog[id="commander-dmg-0"] is visible
    - expect: First column damage counter reads 0
  3. Tap the first column +1 commander damage button three times
    - expect: Damage counter reads 3
  4. Tap the first column -1 commander damage button once
    - expect: Damage counter reads 2
  5. Read P1 life total from the zone behind the dialog
    - expect: P1 life reads 38 (40 - 2 net damage)
  6. Close with Escape and read P1 life again
    - expect: P1 life still reads 38

#### 1.2. CDM-02: Tap - at 0 keeps damage 0, life unchanged

**File:** `tests/e2e/commander-damage-minus.spec.ts`

**Steps:**
  1. Navigate to / (fresh game)
    - expect: P1 life reads 40
  2. Swipe right on P1 zone to open Commander Damage dialog
    - expect: First column damage counter reads 0
  3. Tap the first column -1 commander damage button once
    - expect: Damage counter still reads 0 (floor)
  4. Tap -1 commander damage twice more
    - expect: Damage counter still reads 0
  5. Read P1 life total
    - expect: P1 life still reads 40 (floored press applies 0 delta, restores nothing)

#### 1.3. CDM-03: Lethal clears - 21 to 20 removes badge, life +1

**File:** `tests/e2e/commander-damage-minus.spec.ts`

**Steps:**
  1. Navigate to /
  2. Swipe right on P1 zone to open Commander Damage dialog
  3. Tap the first column +1 commander damage button 21 times (deterministic; hold + is faster but gives a range)
    - expect: Damage counter reads 21
    - expect: Damage counter color is rgb(213, 0, 0)
    - expect: Commander Damage Lethal zone label visible on P1 zone
    - expect: P1 life reads 19 and is danger red
  4. Tap the first column -1 commander damage button once
    - expect: Damage counter reads 20
    - expect: Damage counter color is NOT rgb(213, 0, 0)
    - expect: Commander Damage Lethal label NOT visible
    - expect: P1 life reads 20 (19 + 1 restored)

#### 1.4. CDM-04: Hold - applies -10 after 1s

**File:** `tests/e2e/commander-damage-minus.spec.ts`

**Steps:**
  1. Navigate to /
  2. Swipe right on P1 zone to open Commander Damage dialog
  3. Tap the first column +1 commander damage button 15 times
    - expect: Damage counter reads 15
  4. Hold (pointerdown) the first column -1 commander damage button for 1200ms, then release (same holdButton helper as counters-overlay.spec.ts 2.3/2.4)
    - expect: Damage applied >= 10 (hold fires -10 per tick after 1000ms delay)
    - expect: Damage counter reads <= 5 (15 - >=10; up to ~3 ticks at 100ms interval)
    - expect: Damage counter reads >= 0 (floor)
  5. Read P1 life total
    - expect: P1 life reads 40 - finalDamage (life restored exactly by applied delta)

#### 1.5. CDM-05: [-] layout & accessibility - visible, order, focusable, aria-labels

**File:** `tests/e2e/commander-damage-minus.spec.ts`

**Steps:**
  1. Navigate to / and open Commander Damage dialog on P1
  2. Locate button by aria-label="-1 commander damage"
    - expect: Button is visible and enabled
    - expect: Button text content is -
    - expect: Button has classes select-none and touch-manipulation
    - expect: Computed font-size >= 28px (text-heading)
    - expect: Bounding box >= 10x10px
  3. Assert button order within the first column
    - expect: -1 commander damage button precedes +1 commander damage button in DOM order
  4. Focus the [-] button, then focus the [+] button
    - expect: [-] is focused (toBeFocused)
    - expect: [+] is focused (toBeFocused)
  5. Close with Escape
    - expect: Dialog closes

#### 1.6. CDM-06: Regression - [+] tap +1 and hold +10 unchanged

**File:** `tests/e2e/commander-damage-minus.spec.ts`

**Steps:**
  1. Navigate to / and open Commander Damage dialog on P1
    - expect: First column damage counter reads 0
  2. Tap the first column +1 commander damage button once
    - expect: Damage counter reads 1
  3. Tap three more times
    - expect: Damage counter reads 4
  4. Hold (pointerdown) +1 commander damage for 1200ms, then release
    - expect: Damage counter >= 10
    - expect: Damage counter <= 35 (3-tick upper bound, mirrors commander-damage.spec 3.3)
  5. Close with Escape and read P1 life
    - expect: P1 life = 40 - final damage
