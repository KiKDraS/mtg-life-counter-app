# Player Zone — Test Plan (DESIGN.md §4.1–4.3, §7.1, §8.3, §9)

## Application Overview

MTG Life Counter — Player Zone milestone (branch `feature/ux-feedback-life-color`). Two player zones on a full-viewport vertical split: Player 1 (blue mana #C1D7E9, rotated 180°) on top, Player 2 (red mana #E49977) on bottom, both starting at 40 life. Each zone has a massive Archivo Black life total with aria-live="polite", and −/+ buttons with tap = ±1 and hold = ±10 per step (§7.1, rewritten on this branch): first ±10 at the native long-press (`contextmenu`) instant, else a 1s fallback timer; then +10 every 500ms held. Committed amounts never cancel (no preview, no cancel window, no ±1 after a commit). Every committed ± life change also pulses a ~200ms flash on the life number + center-column tint (§4.2).

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

### 3. Hold Acceleration (§7.1 — rewritten semantics)

**Seed:** `tests/seed.spec.ts`

**Contract under test (DESIGN.md §7.1, §4.2):**

- **Tap** (release before any hold commit) → ±1.
- **Hold** → first ±10 commits at the **native long-press instant**: the platform
  `contextmenu` event (~500ms Android; the ± button's handler calls
  `preventDefault` to suppress the native menu/callout) — else a **1000ms timer
  fallback** on platforms that never report it (iOS / desktop).
- **First trigger wins** — whichever fires first cancels the other; repeat
  `contextmenu` events during the same hold are no-ops.
- After the first ±10, another ±10 commits every **500ms** while held.
- **Release at any time keeps every committed ±10.** No cancel window, no
  dimmed/50%-opacity preview, and **no ±1 after a commit** (the release click is
  consumed).
- A non-primary `pointerdown` (e.g. right-click) does **not** arm the hold.
- Every committed ± change also fires the ~200ms life-change flash (§4.2 — asserted
  in `specs/life-delta.spec.md`).

| Hold | Committed ±10 steps |
| ---- | ------------------- |
| <1000ms, no `contextmenu` | none — release fires the ±1 tap |
| 1000ms (fallback) | one at 1000ms (life ±10) |
| 1500ms | two (1000ms + 1500ms; life ±20) |
| 2000ms | three (1000/1500/2000ms; life ±30) |
| `contextmenu` mid-hold (before 1s) | one, immediately at the event |
| `contextmenu` commit + 500ms more held | two (event + event+500ms) |

**Testability notes:**

- Playwright cannot produce a real Android long-press. Drive the platform path
  with `button.dispatchEvent("contextmenu")` (Playwright's `dispatchEvent`
  produces a bubbling, cancelable event).
- To assert the native menu was suppressed, dispatch from inside
  `page.evaluate` and read the flag back:
  `const prevented = await button.evaluate((el) => { const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }); el.dispatchEvent(ev); return ev.defaultPrevented; });`
  → `true`. React's synthetic handler runs synchronously during dispatch, so the
  flag is already set when `dispatchEvent` returns.
- The guard cases use real gestures: `click({ button: "right" })` and
  `Shift+F10` on the focused button both fire `contextmenu` with no active hold.
- Timing: assert **at or after** a commit instant, never in a gap (cadence is
  deterministic; use `expect.poll` on the aria-live text instead of fixed sleeps).

#### 3.1. Short hold (<1s, ~750ms) fires only the ±1 tap on release

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Hold p1 +1 for 750ms (no `contextmenu`, before the 1000ms fallback)
    - expect: P1 life reads 41 (release fires the ±1 tap; no ±10, no flash fired
      by the hold — the only flash is the single ±1 commit)

#### 3.2. Fallback long hold (~1.7s): first ±10 commits at 1s, second at 1.5s (40 → 50 → 60) — committed, never previewed

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to /; `pointerdown` p1 +1 and hold with no `contextmenu` (desktop/iOS path)
    - expect: At ~1050ms P1 life reads 50 — the first ±10 is COMMITTED at the 1s
      fallback (the old 50%-opacity preview is gone; the value is real)
    - expect: Delta burst reads +10 at full opacity
  2. Keep holding to ~1550ms
    - expect: P1 life reads 60 (+20 — second ±10 @1.5s, exactly 500ms after the first)
    - expect: Delta reads +20 (cumulative burst, full opacity — never a "+10" flash)
  3. Release at 1700ms
    - expect: P1 life still reads 60 (committed ±10s stay; +30 @2s never reached)
    - expect: No ±1 on release (would read 61)
  4. Wait 1200ms
    - expect: Delta count 0 (inactivity timer re-armed by the last commit)

#### 3.3. Releasing the button stops adjustment immediately

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Hold p1 +1 for 600ms, release, wait 400ms, read again
    - expect: P1 life reads 41 (600ms < 1000ms fallback → ±1 tap only, no ±10)
    - expect: Life unchanged after release — no repeat continues

#### 3.4. Release at ~1.2s KEEPS the committed ±10 (inverts the old break-mechanic scenario)

**File:** `tests/e2e/player-zone.spec.ts`

> DESIGN §7.1: "Release any time → committed ±10s stay; no cancel window; no ±1
> after first commit." A 1.2s hold sits after the 1s fallback commit and before
> the 1.5s repeat → exactly one ±10 per direction, and the release changes
> nothing else. This scenario REPLACES the old "hold 1200ms → unchanged"
> expectation, which now inverts (life MUST have changed).

**Steps:**
  1. Navigate to /; assert P1 life reads 40 and P2 life reads 40
  2. Hold p1 +1 for 1200ms (fallback commit @1s), release at 1200ms
    - expect: P1 life reads 50 — the +10 stays
    - expect: No +1 applied on release (would read 51)
  3. Hold p2 -1 for 1200ms, release at 1200ms
    - expect: P2 life reads 30 — the −10 stays
    - expect: No -1 applied on release (would read 29)
  4. Wait 400ms, read both again
    - expect: P1 reads 50, P2 reads 30 — nothing reverts after release

#### 3.5. [NEW] `contextmenu` mid-hold commits the first ±10 IMMEDIATELY, suppresses the native menu, and cadence continues at +500ms

**File:** `tests/e2e/player-zone.spec.ts`

> Android fires `contextmenu` (~500ms) before the 1s fallback. Dispatching it
> proves the native long-press path, first-trigger-wins, and `preventDefault`.

**Steps:**
  1. Navigate to /; assert P1 life reads 40
  2. `pointerdown` on p1 +1 (arms the hold); wait ~200ms
    - expect: P1 life still reads 40 (no commit before the event / before 1s)
  3. In `page.evaluate`, dispatch a cancelable `contextmenu` MouseEvent on the p1
     +1 button and read back `defaultPrevented`
    - expect: `defaultPrevented === true` (native menu/callout suppressed, §4.2)
    - expect: P1 life reads 50 IMMEDIATELY — first ±10 committed at the event
      instant, no 1s wait
    - expect: Delta burst reads +10 at full opacity
  4. Keep holding ~500ms more (no release)
    - expect: P1 life reads 60 (+20 — repeat chain fires 500ms after the commit,
      not from a second trigger)
  5. Release; wait 300ms, read again
    - expect: P1 life still reads 60 (committed ±10s stay)
    - expect: No ±1 on the release click (would read 61)

#### 3.6. [NEW] `contextmenu` with NO active hold → preventDefault only, life unchanged (right-click / Shift+F10)

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to /; assert P1 life reads 40
  2. Right-click p1 +1 (`click({ button: "right" })`)
    - expect: P1 life still reads 40 — a non-primary `pointerdown` never arms the
      hold, so the `contextmenu` has nothing to commit
    - expect: No native context menu opens (preventDefault ran); P2 unchanged at 40
  3. Focus p1 +1 (`focus()`) and press `Shift+F10`
    - expect: P1 life still reads 40 — keyboard-invoked `contextmenu` also only
      suppresses the menu
  4. Guard assert: in `page.evaluate`, dispatch a cancelable `contextmenu` with no
     hold active and read back `defaultPrevented`
    - expect: `defaultPrevented === true`; P1 life still reads 40
  5. Click p1 +1 once
    - expect: P1 life reads 41 — the ±1 tap path is unaffected by the suppressed menu

#### 3.7. [NEW] First trigger wins: the fallback commit cancels the `contextmenu` path and vice-versa

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. Navigate to /; `pointerdown` p1 +1 and hold for 1100ms with no event
    - expect: P1 life reads 50 (the 1s fallback committed the first +10)
  2. While still held, dispatch `contextmenu` (`dispatchEvent`)
    - expect: P1 life still reads 50 — the hold already fired, so the event does
      not double-commit
    - expect: `defaultPrevented === true` (menu still suppressed after the commit)
  3. Release at ~1200ms; read again
    - expect: P1 life reads 50 (the +20 repeat @1.5s was never reached; nothing reverts)
  4. Second hold: `pointerdown` again, then dispatch `contextmenu` twice in a row,
     then release immediately (~100ms)
    - expect: P1 life reads 60 — exactly one +10 from the event pair (the second
      dispatch is a no-op)
  5. Wait 1200ms (past the 1s window of the second hold)
    - expect: P1 life still reads 60 — the `contextmenu` commit cleared the
      fallback timer, so no delayed +10 arrives

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
