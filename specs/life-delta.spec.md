# Life Delta Feedback Test Plan

## Application Overview

MTG Life Counter — Life Delta Feedback (branch feature/life-delta-feedback, DESIGN.md §4.2/§7.1). Each player zone's center column shows a transient burst-NET delta ABOVE the life total when life changes via −/+ buttons. Delta accumulates across taps and hold commits (+,+ → "+2"; − → "−1", U+2212). Rendered only when net ≠ 0; hides 1s (DELTA_HIDE_MS=1000) after the LAST change (inactivity timer resets per change). Restart (⟳) remounts zones (game version bump) → delta cleared, none shown. Delta span is aria-hidden="true", absolutely positioned above the life total → no layout shift; life total aria-live announcement unchanged. Commander damage and counter changes dispatch directly to the reducer → no delta. Selectors: zone(page,n) = getByRole region /^Player n:/, lifeTotal = [aria-live="polite"], delta = zone.locator('.text-delta') (unique class, span[aria-hidden="true"]), buttons getByRole('button', { name: '+1 life' } / '-1 life' ), belt via getByLabel('Open Spellbook Menu') + 'Restart Life', swipes per restart-life.spec.ts conventions (P1 180°: physical right = Commander, left = Counters). Seed tests/seed.spec.ts, fresh 2-player game, both at 40 life.

## Test Scenarios

### 1. life-delta

**Seed:** `tests/seed.spec.ts`

#### 1.1. 1.1. Single tap shows +1, aria-hidden, absolute above life, no layout shift

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; record lifeTotal(zone(1)) bounding box; assert P1 life reads 40 and delta count is 0
    - expect: P1 life reads 40
    - expect: delta(zone(1)) count = 0
  2. Tap P1 '+1 life' button once
    - expect: delta(zone(1)) visible with text exactly +1
    - expect: span has aria-hidden="true"
    - expect: span has class absolute, font-weight 700
    - expect: delta box above life box (delta.y + delta.height <= life.y)
    - expect: lifeTotal box unchanged vs baseline (no layout shift)
  3. Read P1 life total; assert aria-live contract; tap P2 '+1 life' once
    - expect: P1 life reads 41
    - expect: lifeTotal still has aria-live="polite" aria-atomic="true"
    - expect: delta(zone(2)) shows +1
    - expect: P1 delta still +1

#### 1.2. 2.1. Three taps accumulate burst net delta to +3

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '+1 life' three times in quick succession (<1s)
    - expect: delta(zone(1)) text is +3
    - expect: P1 life reads 43
    - expect: P2 life still reads 40

#### 1.3. 3.1. Opposing taps cancel to hidden; negative sign renders as U+2212

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '-1 life' once
    - expect: delta(zone(1)) visible, text −1 with U+2212 (assert code point 0x2212)
  2. Tap P1 '+1 life' once within 1s window
    - expect: delta(zone(1)) count = 0 (net 0)
    - expect: P1 life reads 40
  3. Tap P1 '+1 life' twice then '-1 life' once
    - expect: delta(zone(1)) text is +1 (net 2-1)
  4. Tap P1 '-1 life' once more
    - expect: delta(zone(1)) count = 0
    - expect: P1 life reads 40

#### 1.4. 4.1. Delta hides 1.2s after last tap

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '+1 life' twice
    - expect: delta(zone(1)) visible, text +2
  2. Wait 1200ms
    - expect: delta(zone(1)) count = 0
    - expect: P1 life still reads 42

#### 1.5. 5.1. Timer resets per change: visible at 1.1s from first tap

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '+1 life' (t=0)
    - expect: delta(zone(1)) visible, text +1 (timer A fires at t=1000)
  2. Wait 600ms, tap P1 '+1 life' again (t=600)
    - expect: delta(zone(1)) text +2 (timer B re-armed, fires at t=1600)
  3. Wait 500ms (t=1100, 1100ms after first tap)
    - expect: delta(zone(1)) still visible, text +2 (would have hidden at t=1000 if timer had not re-armed)
  4. Wait 700ms more (t=1800)
    - expect: delta(zone(1)) count = 0

#### 1.6. 6.1. Hold 1.9s commits two +10s with CUMULATIVE preview: +10 dimmed → commit → "+20" dimmed (never "+10" flash) → commit — delta +20, life 60

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; holdButton P1 '+1 life' for 1900ms
    - expect: At ~1050ms into hold (stage 1 @1000ms, pre-commit): delta(zone(1)) visible
      with text +10 and opacity 0.5 (preview per §4.2 = cumulative committed+staged
      = 0+10; life NOT yet changed)
    - expect: P1 life still reads 40 at first stage
  2. Continue holding past 1400ms (commit 1 fires @1400ms)
    - expect: P1 life reads 50, delta(zone(1)) text +10 full opacity
  3. Continue holding to ~1550ms (stage 2 @1500ms, pre-commit 2)
    - expect: delta(zone(1)) text +20 with opacity 0.5 — CUMULATIVE (committed +10
      + staged +10), never "+10" flash; P1 life still reads 50
  4. Release at 1900ms (commit 2 fires @1900ms)
    - expect: delta(zone(1)) text +20 (full opacity), P1 life reads 60
    - expect: No +1 on release (hold suppresses click)
  5. Wait 1200ms
    - expect: delta(zone(1)) count = 0 (hide timer re-armed by commit 2)

#### 1.7. 7.1. Restart while delta visible clears it, no spurious delta

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '+1 life' twice
    - expect: delta(zone(1)) visible, text +2
  2. Open belt (Open Spellbook Menu), tap 'Restart Life' within 1s window
    - expect: Belt auto-collapses
    - expect: P1 life reads 40
    - expect: delta(zone(1)) count = 0 immediately
  3. Wait 1200ms
    - expect: delta(zone(1)) count = 0 (no spurious delta)
  4. Tap P1 '+1 life' once post-restart
    - expect: delta(zone(1)) shows +1
    - expect: P1 life reads 41

#### 1.8. 8.1. Life value correct: 40 -> 43 with +3, then 38 with −2

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '+1 life' three times
    - expect: delta(zone(1)) text +3
    - expect: lifeTotal(zone(1)) text exactly 43
  2. Tap P1 '-1 life' five times
    - expect: delta(zone(1)) text −2 (U+2212)
    - expect: P1 life reads 38
  3. Wait 1200ms
    - expect: delta(zone(1)) count = 0
    - expect: P1 life still 38

#### 1.9. 9.1. Commander damage adjustments produce no delta

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; swipe physical right on P1 zone (180° slot = Commander)
    - expect: Commander Damage dialog (aria-labelledby="commander-damage-title") opens
  2. Tap '+1 commander damage' three times
    - expect: Damage counter reads 3
    - expect: delta(zone(1)) count = 0 (life 40→37 but no delta)
  3. Close dialog (Escape); wait 1200ms
    - expect: P1 life reads 37
    - expect: delta(zone(1)) count = 0

#### 1.10. 9.2. Counter adjustments produce no delta

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; swipe physical left on P1 zone (Counters)
    - expect: Counters dialog opens
  2. Tap '+1 Poison counter' twice
    - expect: Poison counter reads 2
    - expect: delta(zone(1)) count = 0
  3. Close dialog (Escape); wait 1200ms
    - expect: delta(zone(1)) count = 0
    - expect: P1 life still reads 40
  4. Tap P1 '+1 life' once
    - expect: delta(zone(1)) shows +1 (life-button path still feeds delta)
