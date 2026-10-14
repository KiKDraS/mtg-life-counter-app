# Commander Damage Decrement ([-] button) Test Plan

## Application Overview

MTG Life Counter — Commander Damage overlay now has a [-] button per column (aria-label "-1 commander damage"), placed before [+]. Tap = -1 damage, hold = ±10 per DESIGN §7.1 (rewritten): first ±10 at the native long-press `contextmenu` instant (~500ms Android, `preventDefault` suppresses the menu) else a 1s fallback timer; then ±10 every 500ms held. Committed ±10s NEVER cancel — no preview, no cancel window, no ±1 after a commit (cadence: −10 @ 1s fallback, −10 more @ 1.5s, …). Damage floors at 0; life = 40 - damage, decrement restores life only by applied delta. Lethal at >=21: damage + life turn danger red rgb(213,0,0), zone shows "Commander Damage Lethal" label. P1 is 180° rotated: physical swipe RIGHT opens its commander dialog; P2 physical LEFT. Life total visible on zone behind dialog. Spec targets 2-player grid, first column of P1's dialog (dialog id commander-dmg-0). All scenarios start from fresh game (seed tests/seed.spec.ts, goto /).

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

#### 1.4. CDM-04: Hold - commits -10 at the 1s fallback, keeps it on release, floors at 0

**File:** `tests/e2e/commander-damage-minus.spec.ts`

**Steps:**
  1. Navigate to /
  2. Swipe right on P1 zone to open Commander Damage dialog
  3. Tap the first column +1 commander damage button 15 times
    - expect: Damage counter reads 15
    - expect: P1 life reads 25 (40 - 15)
  4. Hold (pointerdown) the first column -1 commander damage button for 1200ms, then release (past the 1s fallback commit, before the 1.5s repeat)
    - expect: Damage counter reads 5 (exactly one -10 committed and KEPT on release)
    - expect: No -1 applied on the release click (would read 4)
  5. Hold (pointerdown) the first column -1 commander damage button for 1450ms, then release
    - expect: Damage counter reads 0 (one -10 applies, floored at 0 — never negative)
    - expect: Damage counter reads >= 0 (floor)
  6. Read P1 life total
    - expect: P1 life reads 40 (life restored exactly by the applied delta: 15 - 5 = 10 damage total)
  7. Tap +1 commander damage 15 times again, then `pointerdown` on the -1 button, dispatch `contextmenu` on it and release immediately
    - expect: Damage reads 5 — the first -10 of that hold committed IMMEDIATELY at the event instant (native long-press path, no 1s wait)
    - expect: `defaultPrevented === true` for a cancelable `contextmenu` MouseEvent dispatched via `page.evaluate` (native menu suppressed, §4.2)

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

#### 1.6. CDM-06: Regression - [+] tap +1 and hold +10 (1s fallback) unchanged

**File:** `tests/e2e/commander-damage-minus.spec.ts`

**Steps:**
  1. Navigate to / and open Commander Damage dialog on P1
    - expect: First column damage counter reads 0
  2. Tap the first column +1 commander damage button once
    - expect: Damage counter reads 1
  3. Tap three more times
    - expect: Damage counter reads 4
  4. Hold (pointerdown) +1 commander damage for 600ms, then release (before the 1s fallback — plain tap path)
    - expect: Damage counter reads 5 (the ±1 tap fires on release; no +10 yet)
  5. Hold (pointerdown) +1 commander damage for 1200ms, then release (one fallback commit)
    - expect: Damage counter reads 15 (exactly one +10 committed and kept; no +1 on the release click)
  6. Close with Escape and read P1 life
    - expect: P1 life = 25 (40 - 15)

#### 1.7. CDM-07: [NEW] Tap -1 still works after a suppressed right-click; `contextmenu` never commits without a hold

**File:** `tests/e2e/commander-damage-minus.spec.ts`

**Steps:**
  1. Navigate to / and open Commander Damage dialog on P1; tap +1 commander damage 5 times
    - expect: Damage counter reads 5
  2. Right-click the -1 commander damage button (`click({ button: "right" })`)
    - expect: Damage counter still reads 5 — a non-primary `pointerdown` never arms the hold, so there is nothing to commit
    - expect: No native context menu opens (preventDefault ran)
    - expect: `defaultPrevented === true` for a cancelable `contextmenu` MouseEvent dispatched via `page.evaluate` with no hold active
  3. Tap the -1 commander damage button once
    - expect: Damage counter reads 4 — the -1 tap path is unaffected by the suppressed menu
  4. Read P1 life total
    - expect: P1 life reads 36 (40 - 4)
