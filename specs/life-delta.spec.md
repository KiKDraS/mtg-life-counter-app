# Life Delta Feedback Test Plan

## Application Overview

MTG Life Counter — Life Delta Feedback (branch feature/ux-feedback-life-color, DESIGN.md §4.2/§7.1). Each player zone's center column shows a transient burst-NET delta ABOVE the life total when life changes via −/+ buttons. Delta accumulates across taps and hold commits (+,+ → "+2"; − → "−1", U+2212). Rendered only when net ≠ 0; hides 3s (DELTA_HIDE_MS=3000) after the LAST change (inactivity timer resets per change). Restart (⟳) remounts zones (game version bump) → delta cleared, none shown. Delta span is aria-hidden="true", absolutely positioned above the life total → no layout shift; life total aria-live announcement unchanged. Commander damage and counter changes dispatch directly to the reducer → no delta. Selectors: zone(page,n) = getByRole region /^Player n:/, lifeTotal = [aria-live="polite"], delta = zone.locator('.text-delta') (unique class, span[aria-hidden="true"]), buttons getByRole('button', { name: '+1 life' } / '-1 life' ), belt via getByLabel('Open Spellbook Menu') + 'Restart Life', swipes per restart-life.spec.ts conventions (P1 180°: physical right = Commander, left = Counters). Seed tests/seed.spec.ts, fresh 2-player game, both at 40 life.

> **Generator note:** flash coverage fully removed at HEAD (`0321b69`, FB4
> parked) — no flash probes, no flash scenarios. Delta scenarios 1.x + hold
> semantics only. Do not reintroduce flash.

## Hold Semantics (DESIGN.md §7.1, rewritten)

tap → ±1; hold → first ±10 commits at the native long-press `contextmenu` instant
(~500ms Android, `preventDefault` suppresses the menu) **else a 1000ms fallback
timer**; then ±10 every 500ms held. **Committed ±10s never cancel** — no
staged/dimmed preview, no release cancel window, no ±1 after a commit (release
click consumed).

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
  2. Tap P1 '+1 life' once within the 3s hide window
    - expect: delta(zone(1)) count = 0 (net 0)
    - expect: P1 life reads 40
  3. Tap P1 '+1 life' twice then '-1 life' once
    - expect: delta(zone(1)) text is +1 (net 2-1)
  4. Tap P1 '-1 life' once more
    - expect: delta(zone(1)) count = 0
    - expect: P1 life reads 40

#### 1.4. 4.1. Delta still visible at 1.2s; hides ~3.2s after last tap

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '+1 life' twice
    - expect: delta(zone(1)) visible, text +2
  2. Wait 1200ms (1.2s after the last tap — inside the 3s hide window)
    - expect: delta(zone(1)) still visible, text +2
    - expect: P1 life reads 42
  3. Wait 2000ms more (~3.2s after the last tap — past DELTA_HIDE_MS=3000)
    - expect: delta(zone(1)) count = 0
    - expect: P1 life still reads 42

#### 1.5. 5.1. Timer resets per change: visible at 3.2s from first tap, hides 3s after last

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '+1 life' (t=0)
    - expect: delta(zone(1)) visible, text +1 (timer A fires at t=3000)
  2. Wait 600ms, tap P1 '+1 life' again (t=600)
    - expect: delta(zone(1)) text +2 (timer B re-armed, fires at t=3600)
  3. Wait 2600ms (t=3200, 3200ms after first tap)
    - expect: delta(zone(1)) still visible, text +2 (would have hidden at t=3000 if timer had not re-armed)
  4. Wait 600ms more (t=3800)
    - expect: delta(zone(1)) count = 0

#### 1.6. 6.1. Hold 1.9s commits two +10s at the 1s fallback / 1.5s repeat — delta +20, life 60 (no preview)

**File:** `tests/e2e/life-delta.spec.ts`

> Rewritten for the new §7.1: desktop has no `contextmenu` during a mouse hold, so
> the 1s fallback commits. Nothing is previewed at 50% opacity and nothing
> cancels on release.

**Steps:**
  1. Navigate to /; hold P1 '+1 life' for 1900ms (no `contextmenu` dispatched)
    - expect: At ~1050ms: P1 life reads 50 — first ±10 COMMITTED at the 1s
      fallback; delta(zone(1)) visible with text +10 and opacity 1 (the old
      opacity-0.5 preview stage is gone)
    - expect: P1 life is no longer 40 — there is no pre-commit preview state
  2. Continue holding to ~1550ms
    - expect: P1 life reads 60 (second ±10 @1.5s = 500ms after the first)
    - expect: delta(zone(1)) text +20, opacity 1 — cumulative burst, never "+10"
  3. Release at 1900ms
    - expect: P1 life still reads 60 (committed ±10s stay; +30 @2s not reached)
    - expect: No +1 on release (hold suppresses the click; would read 61)
  4. Wait 1200ms (1.2s after the last commit — inside the 3s hide window)
    - expect: delta(zone(1)) still visible, text +20
  5. Wait 2000ms more (~3.2s after the last commit — past DELTA_HIDE_MS=3000)
    - expect: delta(zone(1)) count = 0 (hide timer re-armed by the last commit)

#### 1.7. 7.1. Restart while delta visible clears it, no spurious delta

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '+1 life' twice
    - expect: delta(zone(1)) visible, text +2
  2. Open belt (Open Spellbook Menu), tap 'Restart Life' while the delta is still visible (within the 3s hide window)
    - expect: Belt auto-collapses
    - expect: P1 life reads 40
    - expect: delta(zone(1)) count = 0 immediately
  3. Wait 3200ms (past the full 3s hide window)
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
  3. Wait 3200ms (past the 3s hide window)
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
  3. Close dialog (Escape); wait 3200ms (past the 3s hide window)
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
  3. Close dialog (Escape); wait 3200ms (past the 3s hide window)
    - expect: delta(zone(1)) count = 0
    - expect: P1 life still reads 40
  4. Tap P1 '+1 life' once
    - expect: delta(zone(1)) shows +1 (life-button path still feeds delta)
