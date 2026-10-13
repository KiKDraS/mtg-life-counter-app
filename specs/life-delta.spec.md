# Life Delta Feedback Test Plan

## Application Overview

MTG Life Counter — Life Delta Feedback + Life-Change Flash (branch feature/ux-feedback-life-color, DESIGN.md §4.2/§7.1, §9). Each player zone's center column shows a transient burst-NET delta ABOVE the life total when life changes via −/+ buttons. Delta accumulates across taps and hold commits (+,+ → "+2"; − → "−1", U+2212). Rendered only when net ≠ 0; hides 1s (DELTA_HIDE_MS=1000) after the LAST change (inactivity timer resets per change). Restart (⟳) remounts zones (game version bump) → delta cleared, none shown. Delta span is aria-hidden="true", absolutely positioned above the life total → no layout shift; life total aria-live announcement unchanged. Commander damage and counter changes dispatch directly to the reducer → no delta. Selectors: zone(page,n) = getByRole region /^Player n:/, lifeTotal = [aria-live="polite"], delta = zone.locator('.text-delta') (unique class, span[aria-hidden="true"]), buttons getByRole('button', { name: '+1 life' } / '-1 life' ), belt via getByLabel('Open Spellbook Menu') + 'Restart Life', swipes per restart-life.spec.ts conventions (P1 180°: physical right = Commander, left = Counters). Seed tests/seed.spec.ts, fresh 2-player game, both at 40 life.

## Life-Change Flash (NEW on this branch — DESIGN.md §4.2, §9)

Every committed ± life change also pulses a ~200ms flash: the life number scales
1 → 1.08 → 1 (WAAPI, easing ease-out) and a pre-mounted center-column tint
overlay fades opacity 1 → 0. Both animations target **existing nodes** (no
remount, no layout shift). Trigger = same as the delta burst (life-button path
only). **Skipped** on the initial mount, on reset/remount, for commander-damage
and counter changes, and under
`prefers-reduced-motion: reduce` (§9).

**Hold semantics feeding this doc (DESIGN.md §7.1, rewritten):** tap → ±1; hold →
first ±10 commits at the native long-press `contextmenu` instant (~500ms Android,
`preventDefault` suppresses the menu) **else a 1000ms fallback timer**; then ±10
every 500ms held. **Committed ±10s never cancel** — no staged/dimmed preview, no
release cancel window, no ±1 after a commit (release click consumed).

**Testability — flash assertions (do NOT sample mid-animation CSS):**

| Thing | Selector / probe |
| --- | --- |
| Life number (flash target 1) | `lifeTotal(zone)` `<p aria-live="polite">` |
| Tint overlay (flash target 2) | `zone.locator('span[aria-hidden="true"].pointer-events-none')` (the `.text-delta` span is also `aria-hidden` — disambiguate by `pointer-events-none`) |
| Running animations | `el.getAnimations()` via `locator.evaluate` — presence/length |
| Keyframes/timing | `el.getAnimations()[0].effect.getKeyframes()` / `.effect.getTiming().duration` = 200 |

- Assert **with a tight poll**, not a single immediate read: the WAAPI animations
  are created in a passive effect that flushes a frame or two after the press, so
  the first `getAnimations()` read can legitimately be empty.
  `await expect.poll(() => count(lifeP), { timeout: 500 }).toBeGreaterThan(0)`
  reliably catches the still-running 200ms animation. For **negative** cases,
  sample `0` at ~0/100/200/300ms after the action (any sample inside a wrongly
  fired flash's 200ms window catches it) — a lone post-hoc read does not.
- Reduced motion via `page.emulateMedia({ reducedMotion: "reduce" })` (Playwright
  drives `matchMedia`); restore with `{ reducedMotion: null }`.
- Do not assert `opacity`/`transform` CSS values mid-animation — flaky. The tint
  span's static class is `opacity-0`, so a CSS-value assert would pass even when
  the flash never fired.

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
  4. Wait 1200ms
    - expect: delta(zone(1)) count = 0 (hide timer re-armed by the last commit)

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

### 2. Life-Change Flash ([NEW] §4.2 / §9)

**Seed:** `tests/seed.spec.ts`

#### 2.1. 10.1. [NEW] A committed ± life change pulses the flash: life scale + tint fade, ~200ms, WAAPI-only

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; wait out the hydration remount; sample `getAnimations()` on
     `lifeTotal(zone(1))` and on the tint span at ~0/100/200/300ms
     - expect: 0 running animations on both at every sample (the initial mount
       never flashes — the `flashKey` skip applies)
  2. Tap P1 '+1 life' once, then poll `getAnimations()` on both elements with a
     tight window (`expect.poll(..., { timeout: 500 })`)
     - expect: ≥1 animation on the life `<p>` and ≥1 on the tint span (fresh
       flash fired by the committed ±1)
     - expect: Timing/keyframes: duration 200ms; life keyframes scale 1 → 1.08 → 1;
       tint keyframes opacity 1 → 0
  3. Read the life total box and the delta box
     - expect: Delta burst reads +1; life `<p>` is the same DOM node (not
       remounted) — `aria-live="polite"` preserved; no layout shift
  4. Wait 300ms (past the 200ms window; both elements must report 0 again), then
     tap P1 '-1 life' and poll again
     - expect: Both elements 0 after the wait; the −1 commit fires a new flash
       (≥1 each) — every committed change re-triggers, no commit is skipped
  5. Hold P1 '+1 life' for 1200ms (fallback commit @1s), release, poll again
     - expect: ≥1 on both (the ±10 hold commit also flashes); P1 life reads 50
       (40 → +1 → −1 → 40, then +10 from the hold commit)
     - expect: No ±1 applied on a hold release after a commit (would read 51)

#### 2.2. 10.2. [NEW] `prefers-reduced-motion: reduce` suppresses the flash; life still changes

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. `await page.emulateMedia({ reducedMotion: "reduce" })`; navigate to /
    - expect: `matchMedia("(prefers-reduced-motion: reduce)").matches` is true in
      the page (Playwright drives the media feature)
  2. Tap P1 '+1 life' once, then poll `getAnimations()` on the life `<p>` and the
     tint span across a ≥400ms window (samples at ~0/100/200/300ms)
     - expect: 0 animations on both at every sample (§9: no life-change flash)
     - expect: P1 life reads 41 (the change itself is NOT suppressed) and the
       delta burst still shows +1 (reduced motion removes the flash only)
  3. Hold P1 '+1 life' for 1200ms (fallback commit) and sample the same window
     - expect: 0 animations at every sample; P1 life reads 51 (+10 committed —
       hold works)
  4. Restore: `await page.emulateMedia({ reducedMotion: null })`, then tap P1
     '+1 life'
     - expect: ≥1 animation on the life `<p>` and the tint span (tight poll) — the
       suppression is media-driven, not permanent

#### 2.3. 10.3. [NEW] No flash on reset/remount and no flash from commander damage or counters

**File:** `tests/e2e/life-delta.spec.ts`

**Steps:**
  1. Navigate to /; tap P1 '+1 life' → tight poll on the life `<p>` shows ≥1
     (baseline: the flash fires for the life-button path)
  2. Wait 300ms for the flash to finish; open belt ('Open Spellbook Menu') → tap
     'Restart Life'; sample `getAnimations()` on the (remounted) life `<p>` and
     tint span at ~0/100/200/300ms
     - expect: 0 at every sample — remount/`flashKey` reset never flashes
     - expect: P1 life reads 40; delta(zone(1)) count = 0
  3. Swipe physical right on P1 zone (Commander Damage overlay); tap
     '+1 commander damage' twice; sample the same window
     - expect: 0 at every sample on the life `<p>` and tint span — commander-driven
       life changes (40 → 38) do not flash (§4.2: same trigger as the delta burst)
     - expect: delta(zone(1)) count = 0
  4. Escape to close; swipe physical left on P1 zone (Counters overlay); tap
     '+1 poison counter' twice; sample the same window
     - expect: 0 animations at every sample — counter changes do not flash
  5. Close the overlay (Escape); tap P1 '+1 life' once
     - expect: ≥1 animation on both (tight poll) — the life-button path flashes
       again (baseline restored after the flash-free paths)
