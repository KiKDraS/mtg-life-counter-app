# Commander Damage Overlay — Overflow + Swipe Close (Regression)

## Application Overview

MTG Life Counter — regression plan for the just-fixed Commander Damage overlay scrolling/swipe-close bug (branch feature/commander-damage-minus, commit 1c83afc).

BUG (fixed): Commander Damage dialog now scrolls via the DIALOG itself — DialogShell gets `overflow-y-auto scrollbar-none` — with rotation-matched `touch-action` set on the dialog by CommanderDamageContent (pan-y for 0°/180° slots, pan-x for 90°/−90° sideways slots). Before the fix the inner grid div carried `overflow-auto` with no touch-action: the browser claimed drags as native panning and fired pointercancel (0,0), which useSwipe skips → the close-swipe silently failed whenever content overflowed (small devices).

LIVE-VERIFIED FACTS (320×568 viewport, 6 players):
- Every commander dialog overflows on a compact viewport. Dialogs are ZONE-sized (absolute inside the rotated zone wrapper): P1/P6 zones 320×114 → dialog scrollHeight 159 vs clientHeight 114; P2 sideways zone 160×170 → scrollHeight 302 vs clientHeight 160. 5 players at 320×568: P1 dialog 159 vs 114 (overflows too).
- 1280×720 (default config viewport): NO overflow (144 == 144) — existing suites already cover swipe close there.
- 6p rotation map (getPlayerRotation / LAYOUT_MAP[6]): P1=180°, P2=90°, P3=−90°, P4=90°, P5=−90°, P6=0°. P6 (playerId 5) is the 0° bottom slot — NOT sideways. The genuinely sideways slots are P2/P4 (90°) and P3/P5 (−90°); those dialogs get touch-action pan-x (verified live on P2).
- Dialog touch-action per slot (verified live): pan-y on P1/P6 dialogs, pan-x on P2 dialog.
- Scroll: wheel over the dialog scrolls it (scrollTop 0 → 45/60) even with touch-action pan-y/pan-x.

CRITICAL METHODOLOGY FINDING: mouse swipes CANNOT reproduce this bug. Chromium only claims drags as native scroll for TOUCH pointers — with a mouse the pre-fix state still closes the dialog (verified live). Therefore ALL close-swipe assertions in these scenarios MUST use CDP touch events (Emulation.setTouchEmulationEnabled + Input.dispatchTouchEvent), not page.mouse. Pre-fix failure reproduced live with touch: dialog with grid overflow:auto + touch-action auto → touch swipe leaves the dialog OPEN (gesture swallowed). Post-fix: same touch swipe closes it.

Close-swipe physical direction per slot (player-horizontal, any valid swipe closes an open overlay via handleSwipe): P1 (180°) physical RIGHT, P6 (0°) physical LEFT, P2/P4 (90°) physical UP, P3/P5 (−90°) physical DOWN. Opening swipes (mouse) per existing suites: P1 physical RIGHT, P2/P4 physical UP, P3/P5 physical DOWN, P6 physical LEFT.

All scenarios start from a fresh game: seed tests/seed.spec.ts, `pnpm dev` on localhost:3000 (no webServer in playwright.config.ts — start manually), default chromium project, viewport overridden per scenario.

## Test Scenarios

### 1. Commander Damage — Overflow Scroll + Swipe Close (regression)

**Seed:** `tests/seed.spec.ts`

#### 1.1. OVF-01: Compact viewport (320x568) 5 and 6 players — P1 commander dialog scrolls AND swipe-close works

**File:** `tests/e2e/commander-overflow-swipe.spec.ts`

**Steps:**
  1. For each playerCount in [5, 6]: reload to a fresh state, then set viewport: page.setViewportSize({ width: 320, height: 568 }) and page.goto('/')
    - expect: Page loads; Player 1 zone visible
  2. Set the player count via the spellbook belt: click 'Open Spellbook Menu', click 'Players', click the `${playerCount} players` button (reuse selectPlayers(page, count) from commander-damage-multiplayer.spec.ts), then wait for the belt wrapper div.relative.z-50 to reach height 0px (closeBelt pattern)
    - expect: player-selector-modal dialog is not visible
    - expect: N zone regions Player 1..N visible (getByRole region /^Player \d:/)
  3. Open P1's commander dialog with the existing mouse helper: swipeOn(zone(page, 1), 'right') — physical RIGHT on the 180° slot opens Commander Damage. Do NOT use touch for opening (mouse is fine: opening uses the pointerup path that never gets claimed)
    - expect: dialog[id="commander-dmg-0"] is visible
    - expect: Exact playerCount commander pills (span.rounded-full) in the dialog
  4. Assert the overflow precondition on the dialog: evaluate getComputedStyle/scrollHeight/clientHeight on dialog#commander-dmg-0 — expect dialog.scrollHeight > dialog.clientHeight (content taller than the zone-sized dialog)
    - expect: scrollHeight (159 at 320x568) strictly greater than clientHeight (114) — overflow IS active
  5. Assert the fix's scroll surface: computed style of dialog#commander-dmg-0 has overflow-y: auto
    - expect: getComputedStyle(dialog).overflowY === 'auto'
    - expect: getComputedStyle(dialog).touchAction === 'pan-y' (P1 is 180°, non-sideways)
  6. Scroll the dialog content with the wheel: page.mouse.move to the dialog center, then page.mouse.wheel(0, 60), wait ~200ms
    - expect: dialog.scrollTop > 0 after the wheel (dialog itself scrolls — content reachable)
  7. Close-swipe via CDP TOUCH (the regression-critical assertion — mouse cannot reproduce the bug): create a CDP session, Emulation.setTouchEmulationEnabled { enabled: true, maxTouchPoints: 1 }, then dispatch touchStart at the dialog center, 5 touchMove steps +10px toward the close direction, touchEnd (helper touchSwipe(page, {x,y}, 'right', 50)). P1 is 180° → physical RIGHT is player-left → closes. Disable touch emulation afterwards
    - expect: dialog#commander-dmg-0 is NOT visible (dialog closed with overflow active)
    - expect: No Counters dialog opened (getByRole dialog name 'Counters' count 0)
    - expect: P1 life still reads 40
  8. Loop back to step 1 for the second playerCount value; run both 5 and 6 players
    - expect: All assertions hold for 5 players AND 6 players

#### 1.2. OVF-02: Compact viewport 6 players — P6 commander dialog (playerId 5, own column) scrolls AND swipe-close works

**File:** `tests/e2e/commander-overflow-swipe.spec.ts`

**Steps:**
  1. Fresh state: set viewport page.setViewportSize({ width: 320, height: 568 }), page.goto('/')
    - expect: Page loads
  2. selectPlayers(page, 6): belt → Players → '6 players' button; wait for belt collapse (div.relative.z-50 height 0px)
    - expect: player-selector-modal closed
    - expect: 6 zone regions visible
  3. Open P6's commander dialog with the existing mouse helper swipeOn(zone(page, 6), 'left') — P6 is the 0° bottom slot (LAYOUT_MAP[6] index 5 = 0), player-left = physical LEFT (mirrors existing CD-03 test)
    - expect: dialog[id="commander-dmg-5"] is visible
    - expect: Exactly 6 commander pills incl. P6's own column (playerId 5)
    - expect: 6 '+1 commander damage' buttons
  4. Assert overflow precondition on dialog#commander-dmg-5: scrollHeight > clientHeight
    - expect: scrollHeight (159) strictly greater than clientHeight (114) — overflow active
  5. Assert fix surface: computed overflow-y auto AND touch-action pan-y on the P6 dialog (P6 is 0°, not sideways — rotation fact per getPlayerRotation(5, 6))
    - expect: getComputedStyle(dialog).overflowY === 'auto'
    - expect: getComputedStyle(dialog).touchAction === 'pan-y'
  6. Wheel-scroll the dialog: mouse.move to dialog center (zone 6 center ≈ (160, 511)), mouse.wheel(0, 60), wait ~200ms
    - expect: dialog.scrollTop > 0
  7. Close-swipe via CDP TOUCH on the P6 dialog: touchStart at dialog center, 5 touchMove steps −10px x (physical LEFT = player-left on 0° slot), touchEnd; disable touch emulation after
    - expect: dialog#commander-dmg-5 NOT visible
    - expect: Counters dialog count 0
    - expect: P6 life still reads 40

#### 1.3. OVF-04 (addition): Compact viewport 6 players — sideways slot dialog (P2, 90°, pan-x) scrolls AND vertical swipe-close works

**File:** `tests/e2e/commander-overflow-swipe.spec.ts`

**Steps:**
  1. Fresh state: viewport 320x568, page.goto('/'); selectPlayers(page, 6)
    - expect: 6 zone regions visible
  2. Open P2's commander dialog with the existing mouse helper swipeVertically(zone(page, 2), 'up') — P2 is 90° sideways, player-left = physical UP (mirrors SW-03)
    - expect: dialog[id="commander-dmg-1"] is visible
    - expect: 6 commander pills
  3. Assert overflow precondition on dialog#commander-dmg-1: scrollHeight > clientHeight (P2 zone is 160x170, 45%-width columns → 3 wrapped rows → heavy overflow)
    - expect: scrollHeight (302) strictly greater than clientHeight (160) — overflow active
  4. Assert the fix's rotation-matched touch-action on the sideways dialog: computed touch-action equals 'pan-x' (vertical screen drags — the player-horizontal close axis — are NOT claimable as native pan)
    - expect: getComputedStyle(dialog).touchAction === 'pan-x'
    - expect: getComputedStyle(dialog).overflowY === 'auto'
  5. Wheel-scroll the dialog: mouse.move to dialog center (P2 zone center ≈ (80, 199)), mouse.wheel(0, 60), wait ~200ms
    - expect: dialog.scrollTop > 0
  6. Close-swipe via CDP TOUCH, physical UP: touchStart at dialog center, 5 touchMove steps −10px y, touchEnd (90°: player-left = physical UP). Disable touch emulation after
    - expect: dialog#commander-dmg-1 NOT visible (vertical close-swipe survives scroll active + pan-x)
    - expect: Counters dialog count 0
    - expect: P2 life still reads 40

#### 1.4. OVF-03: Default viewport (1280x720) — no overflow; existing suites are the regression scope

**File:** `tests/e2e/commander-overflow-swipe.spec.ts`

**Steps:**
  1. Regression scope (NO new assertions — re-run existing coverage via pnpm exec playwright test tests/e2e/player-zone.spec.ts tests/e2e/swipe-rotated.spec.ts tests/e2e/commander-damage-multiplayer.spec.ts tests/e2e/commander-damage.spec.ts):
    - expect: player-zone.spec.ts §9.5 (swipe right closes open Commander dialog) and §9.6 (swipe left closes open Counters dialog) pass — default 2p, no overflow
    - expect: swipe-rotated.spec.ts SW-06 (overlay close on rotated slots, hold-timeout + close swipe) passes — 5p at 1280x720
    - expect: commander-damage-multiplayer.spec.ts CD-01..CD-07 pass (Escape/backdrop close, 5–6p grids — no overflow at default viewport)
    - expect: commander-damage.spec.ts 2p commander suite passes
  2. Smoke (optional but recommended in same file): default viewport 1280x720, selectPlayers(page, 6), swipeOn(zone(page, 1), 'right'), then assert NO overflow: scrollHeight equals clientHeight on dialog#commander-dmg-0
    - expect: dialog scrollHeight === clientHeight (144 === 144 — no scrollable overflow at normal size)
    - expect: Mouse swipe close (swipeOn(commanderDlg, 'right') pattern from §9.5) still closes the dialog — non-overflow path unchanged
