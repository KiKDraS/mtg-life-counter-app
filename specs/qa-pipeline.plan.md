# QA Pipeline — MTG Life Counter (feature/fix-game-board)

## Application Overview

MTG Life Counter PWA (Next.js 16 App Router, React 19, Tailwind 4, @playwright/test). Tracks life for 2–6 players, per-player mana-color identity, commander damage, counters, swipe gestures. Branch feature/fix-game-board changes under review: (1) commander damage grid fixes for 5/6-player layouts (player 0 and player 5 slots — grid-cols-3 for P0 when playerCount>4 and for P5); (2) counters overlay fixes; (3) color picker WYSIWYG multi-select + colorless replace + constants migration; (4) player-relative swipe direction on rotated slots (180°/90°/−90° flip physical direction); (5) double-tap numpad removed; (6) life color contrast + textShadow (minimax over gradient hexes); (7) GameShell split into RSC root (GameShell.tsx) + client leaf (GameInner.tsx). Contracts: DESIGN.md §4–9, SPEC.md §3–8. App runs at http://localhost:3000 (2p default, 40 life, all-red). Swipe contract: ≥10px within 300ms, player-relative: left = Commander Damage, right = Counters; rotated slots map: 0° (rawX), 180° (−rawX), 90° (logicalX = rawY), −90° (logicalX = −rawY); vertical ignored. Dialog ids: commander-dmg-{playerId}, counters-{playerId}, counters-{playerId}-custom, color-picker-{playerId} (0-indexed). Seed: tests/seed.spec.ts. Note for testers: close the spellbook belt before swiping (belt invisible overlay intercepts pointer events when open).

## Test Scenarios

### 1. Game Board Layouts (DESIGN §4.1/§4.3)

**Seed:** `tests/seed.spec.ts`

#### 1.1. GB-01: 2p layout — P1 180°, P2 0°, equal vertical split (regression)

**File:** `tests/e2e/game-board-layouts.spec.ts`

**Steps:**
  1. goto / with viewport 390x844 (portrait)
    - expect: exactly 2 regions matching ^Player \d: life$
    - expect: P1 region y ≈ 0, height ≈ 422 (top half)
    - expect: P2 region y ≈ 422 (bottom half)
    - expect: both heights equal ±2px
  2. read P1 wrapper transform via region parentElement.style.transform
    - expect: P1 transform is rotate(180deg) (or matrix(-1,0,0,-1,0,0))
  3. read P2 wrapper transform
    - expect: P2 transform is none/rotate(0deg)

#### 1.2. GB-02: 3p layout — P1 180° top, P2 90°, P3 −90°

**File:** `tests/e2e/game-board-layouts.spec.ts`

**Steps:**
  1. open belt (Open Spellbook Menu) → Players → tap 3 players
    - expect: exactly 3 player regions
  2. read each region parent transform + bounding boxes
    - expect: P1: rotate(180deg), full-width top
    - expect: P2: rotate(90deg), left of bottom row
    - expect: P3: rotate(-90deg), right of bottom row
    - expect: P2/P3 same height; P1 taller

#### 1.3. GB-03: 4p layout — all ±90° in 2×2 (regression)

**File:** `tests/e2e/game-board-layouts.spec.ts`

**Steps:**
  1. open belt → Players → tap 4 players
    - expect: exactly 4 player regions
  2. read each region parent transform + bounding boxes
    - expect: P1: rotate(90deg), P2: rotate(-90deg) (top row)
    - expect: P3: rotate(90deg), P4: rotate(-90deg) (bottom row)
    - expect: 2×2 grid, equal quadrants

#### 1.4. GB-04: 5p layout — P1 180° big top, P2/P3 ±90°, P4/P5 ±90° bottom

**File:** `tests/e2e/game-board-layouts.spec.ts`

**Steps:**
  1. open belt → Players → tap 5 players
    - expect: exactly 5 player regions
  2. read each region parent transform + bounding boxes
    - expect: P1: rotate(180deg), full-width, single row on top
    - expect: P2: rotate(90deg), P3: rotate(-90deg) — same row below P1
    - expect: P4: rotate(90deg), P5: rotate(-90deg) — bottom row (both still visible, no overlap)
    - expect: player count 5 = top 3 + bottom 2 rows per §4.1

#### 1.5. GB-05: 6p layout — P1 180°, P2–P5 ±90°, P6 0° bottom (new P6 slot)

**File:** `tests/e2e/game-board-layouts.spec.ts`

**Steps:**
  1. open belt → Players → tap 6 players
    - expect: exactly 6 player regions
  2. read each region parent transform + bounding boxes
    - expect: P1: rotate(180deg), full-width top
    - expect: P2: rotate(90deg), P3: rotate(-90deg) (row 2)
    - expect: P4: rotate(90deg), P5: rotate(-90deg) (row 3)
    - expect: P6: rotate(0deg), full-width bottom row (playerId 5 slot renders, no blank gap)
    - expect: each player life reads 40

#### 1.6. GB-06: All layouts — every zone life 40, +1/-1 and gear work per zone

**File:** `tests/e2e/game-board-layouts.spec.ts`

**Steps:**
  1. for each of 3p, 5p, 6p layouts (select via Players modal), tap +1 life on the LAST player zone (P3/P5/P6)
    - expect: zone life reads 41
    - expect: other zones still 40
    - expect: gear (Change color) button present in every zone

### 2. Commander Damage — 5/6 Player Grid (SPEC §5–6, DESIGN §7.3)

**Seed:** `tests/seed.spec.ts`

#### 2.1. CD-01: 5p — P1 grid shows exactly 5 commander columns (player 0 slot fix)

**File:** `tests/e2e/commander-damage-multiplayer.spec.ts`

**Steps:**
  1. select 5 players; close belt; swipe physically RIGHT on P1 zone (180° slot → player-left)
    - expect: dialog Commander Damage opens (id commander-dmg-0)
    - expect: exactly 5 pills (span.rounded-full) in the grid
    - expect: 5 +1 commander damage buttons
    - expect: grid has grid-cols-3 class for P1 on 5p
    - expect: all damage counters read 0
  2. press Escape
    - expect: dialog closes

#### 2.2. CD-02: 5p — every non-P1 player grid also has 5 columns

**File:** `tests/e2e/commander-damage-multiplayer.spec.ts`

**Steps:**
  1. select 5 players; for each player P2..P5 open commander overlay via the correct physical swipe for its slot (P2/P4 90°: physical UP; P3/P5 −90°: physical DOWN)
    - expect: each dialog id commander-dmg-{pid} opens
    - expect: each grid contains exactly 5 pills (array length = player count invariant, never empty)
    - expect: 5 +1 buttons per dialog
  2. Escape between each
    - expect: dialog closes each time

#### 2.3. CD-03: 6p — P6 (playerId 5) grid shows 6 columns incl. own column (player 5 slot fix)

**File:** `tests/e2e/commander-damage-multiplayer.spec.ts`

**Steps:**
  1. select 6 players; close belt; swipe physically LEFT on P6 zone (0° slot → player-left)
    - expect: dialog id commander-dmg-5 opens
    - expect: exactly 6 pills (incl. P6's own commander column, playerId 5)
    - expect: 6 +1 commander damage buttons
    - expect: grid-cols-3 for P6 on 6p
  2. tap the LAST column + button twice (P6's own commander)
    - expect: last column counter reads 2
    - expect: P6 zone life reads 38 (40 − 2 coupling)
    - expect: other columns still 0
  3. press Escape
    - expect: dialog closes

#### 2.4. CD-04: 6p — per-column damage + life coupling independent across columns

**File:** `tests/e2e/commander-damage-multiplayer.spec.ts`

**Steps:**
  1. select 6 players; open P1 commander grid (swipe physical RIGHT on P1)
    - expect: 6 columns, all 0
  2. tap +3 on column 2 (P2's commander), +4 on column 6 (P6's commander)
    - expect: col2 = 3, col6 = 4, others 0
    - expect: P1 life = 40 − 7 = 33
    - expect: P2..P6 zone life unchanged at 40
  3. close via Escape, reopen P1 grid
    - expect: values persist (3 and 4)
    - expect: P1 life still 33

#### 2.5. CD-05: Lethal on 5p grid — ≥21 on any column turns damage + life danger red with badge

**File:** `tests/e2e/commander-damage-multiplayer.spec.ts`

**Steps:**
  1. select 5 players; open P1 commander grid
    - expect: 5 columns at 0
  2. tap the 5th column (P5's commander) +21 times
    - expect: 5th column counter reads 21 and color = rgb(213,0,0) (#D50000)
    - expect: P1 life = 19 and color = rgb(213,0,0)
    - expect: badge text 'Commander Damage Lethal' visible under P1 life (life > 0)
    - expect: no [-] button exists in any column (no UI to reduce damage)

#### 2.6. CD-06: Commander pill color follows owner's color picker selection (color sync regression)

**File:** `tests/e2e/commander-damage-multiplayer.spec.ts`

**Steps:**
  1. set P2 color to Blue: gear → `Colorless mana` (applies `["c"]`, dialog closes) → reopen gear → `Blue mana` → CheckCircle (replaces `["c"]` → `["b"]`; solid blue is only reachable via Colorless-clear per §8.5.1; zone bg → #C1D7E9)
    - expect: P2 zone background solid rgb(193,215,233)
  2. open P1 commander grid (2p or 5p) and read pill background colors
    - expect: column for playerId 1 (P2's commander) pill bg = rgb(193,215,233) (blue)
    - expect: P1's own column pill = rgb(228,153,119) (red default)

#### 2.7. CD-07: Reset rebuilds commanderDamage array for new player count (count change)

**File:** `tests/e2e/commander-damage-multiplayer.spec.ts`

**Steps:**
  1. select 5 players; open P1 grid; tap +5 on any column; close; select 3 players via Players modal
    - expect: 3 player regions
    - expect: P1 grid reopened shows exactly 3 columns, all 0 (array rebuilt Array.from({length: playerCount}))
    - expect: P1 life reset to 40 (common reset §8.1)

### 3. Swipe Player-Relative Direction (DESIGN §4.2/§7.2)

**Seed:** `tests/seed.spec.ts`

#### 3.1. SW-01: 0° slot (P2 in 2p) — physical left = Commander, physical right = Counters (regression)

**File:** `tests/e2e/swipe-rotated.spec.ts`

**Steps:**
  1. goto / (2p); swipe physically LEFT on P2 zone
    - expect: Commander Damage dialog opens (id commander-dmg-1)
  2. Escape; swipe physically RIGHT on P2 zone
    - expect: Counters dialog opens (id counters-1)

#### 3.2. SW-02: 180° slot (P1) — physical direction INVERTED: right = Commander, left = Counters (regression)

**File:** `tests/e2e/swipe-rotated.spec.ts`

**Steps:**
  1. goto /; swipe physically RIGHT on P1 zone
    - expect: Commander Damage opens (id commander-dmg-0)
  2. Escape; swipe physically LEFT on P1 zone
    - expect: Counters opens (id counters-0)
  3. close via Escape
    - expect: no dialogs open

#### 3.3. SW-03: 90° slot (P2 in 5p) — physical UP = Commander, physical DOWN = Counters

**File:** `tests/e2e/swipe-rotated.spec.ts`

**Steps:**
  1. select 5 players; close belt; on P2 zone swipe physically UP (80px)
    - expect: Commander Damage opens (id commander-dmg-1)
  2. Escape; on P2 zone swipe physically DOWN
    - expect: Counters opens (id counters-1)
  3. close via Escape
    - expect: no dialogs open

#### 3.4. SW-04: −90° slot (P3 in 5p) — physical DOWN = Commander, physical UP = Counters

**File:** `tests/e2e/swipe-rotated.spec.ts`

**Steps:**
  1. select 5 players; on P3 zone swipe physically DOWN
    - expect: Commander Damage opens (id commander-dmg-2)
  2. Escape; on P3 zone swipe physically UP
    - expect: Counters opens (id counters-2)
  3. close via Escape
    - expect: no dialogs open

#### 3.5. SW-05: Sideways slots ignore physical horizontal swipes (player-vertical)

**File:** `tests/e2e/swipe-rotated.spec.ts`

**Steps:**
  1. select 5 players; on P2 (90°) swipe physically LEFT 50px, release
    - expect: no dialog opens
    - expect: P2 life unchanged 40
  2. on P3 (−90°) swipe physically RIGHT 50px
    - expect: no dialog opens
    - expect: P3 life unchanged 40
  3. on P3 swipe physically RIGHT with distance 8px (below 10px threshold)
    - expect: no dialog opens

#### 3.6. SW-06: Threshold + timeout + overlay close on rotated slots

**File:** `tests/e2e/swipe-rotated.spec.ts`

**Steps:**
  1. select 5 players; on P1 (180°) hold pointer down 400ms then drag 60px right and release (exceeds 300ms)
    - expect: no dialog opens (too slow)
  2. on P1 swipe physically RIGHT to open Commander, then swipe physically RIGHT again on the open overlay
    - expect: dialog closes (any X-swipe on overlay closes, either direction)
    - expect: Counters NOT opened by the close swipe

### 4. Counters (SPEC §7, DESIGN §7.4)

**Seed:** `tests/seed.spec.ts`

#### 4.1. CT-01: 4 default counters always present, 2-col grid, adjust ±1 (regression)

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. goto /; swipe LEFT on P1 (180° → player-right) to open Counters
    - expect: dialog id counters-0 with heading 'Counters', bg #1a1a1a
    - expect: 4 default counters Poison/Energy/Experience/Time all at 0
    - expect: each counter has [-] and [+] buttons
    - expect: 2-column grid layout
  2. tap Poison + 3 times
    - expect: Poison reads 3
    - expect: others stay 0
  3. tap Poison − twice
    - expect: Poison reads 1

#### 4.2. CT-02: Custom counter pill + never-empty invariant (regression)

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. open Counters (P1); tap + (Add custom counter)
    - expect: Custom Counter dialog opens (counters-0-custom), input auto-focused, placeholder 'Counter', maxlength 35
  2. type 'Lore', tap + Add
    - expect: dialog closes
    - expect: Lore pill appears in grid at value 0 with rounded pill bg #CAC5C0
  3. tap Lore + twice, then − five times
    - expect: Lore = 2, then floors at 0 (never negative)
  4. close and reopen Counters
    - expect: Lore still present (persists)

#### 4.3. CT-03: Poison lethal at 10 → badge + danger red (regression)

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. open Counters (P1); tap Poison + 10 times
    - expect: Poison reads 10
    - expect: Poison value color rgb(213,0,0)
  2. close overlay
    - expect: P1 life total color rgb(213,0,0)
    - expect: 'Poison Lethal' badge visible under P1 life

#### 4.4. CT-04: Restart clears custom counters, keeps defaults at 0

**File:** `tests/e2e/counters-overlay.spec.ts`

**Steps:**
  1. add custom counter 'Lore' to P1 (see CT-02)
    - expect: Lore present
  2. open belt → Restart Life (⟳)
    - expect: all life back to initialLife 40
  3. reopen P1 Counters
    - expect: Lore absent
    - expect: exactly 4 default counters all 0 (counters never empty)

### 5. Life Controls & Contrast (DESIGN §4.2/§7.1, §2.1/§9)

**Seed:** `tests/seed.spec.ts`

#### 5.1. LC-01: Tap ±1 and hold ±10 after 1s on every zone type (regression)

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. goto /; tap P1 +1 twice, P2 −1 once
    - expect: P1 = 42, P2 = 39
  2. hold P1 +1 for 750ms (under 1s delay)
    - expect: life changes by exactly 1 (41-44 range, no ±10 tick)
  3. hold P1 +1 for 1700ms
    - expect: life jumps by ≥10 after 1s (value ≥100 in long hold test)

#### 5.2. LC-02: Lethal ≤0 → #D50000, recovery restores normal color (regression)

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. hold P1 −1 until life ≤ 0
    - expect: life ≤ 0 with color rgb(213,0,0) (#D50000)
  2. tap P1 +1 until life > 0
    - expect: life color returns to rgb(26,26,26) (#1A1A1A) on red bg
    - expect: P2 unaffected at 40

#### 5.3. LC-03: textShadow pairs with minimax text color (NEW — light bg halo vs dark bg halo)

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. set P1 color to White: gear → `Colorless mana` (applies `["c"]`, closes) → reopen gear → `White mana` → CheckCircle (replaces `["c"]` → `["w"]` — solid via Colorless-clear, §8.5.1)
    - expect: zone bg solid rgb(248,246,216) (white)
    - expect: life total color rgb(26,26,26) (dark text)
    - expect: zone section inline text-shadow contains rgba(255,255,255,0.5) (light halo on dark text)
  2. set P1 color to Black: gear → `Colorless mana` (closes) → reopen gear → `Black mana` → CheckCircle (`["c"]` → `["b"]`)
    - expect: zone bg solid rgb(102,101,101) (black)
    - expect: life total color rgb(250,248,245) (light text)
    - expect: zone section inline text-shadow contains rgba(0,0,0,0.4) (dark halo on light text)

#### 5.4. LC-04: Multi-color gradient text stays readable (minimax worst-case)

**File:** `tests/e2e/player-zone.spec.ts`

**Steps:**
  1. set P1 to White + Blue + Black (w,u,b): gear → `Colorless mana` (closes) → reopen gear → tap White (replaces `["c"]` → `["w"]`), Blue, Black (add) → CheckCircle
    - expect: zone bg is a to-bottom-right gradient
    - expect: life total color is rgb(26,26,26) (dark — minimax over w+u+b: dark's worst case on the black band beats light's on the white band)
    - expect: life total has non-empty text-shadow (light halo)

### 6. Color Picker (SPEC §8.5.1, DESIGN §6.5)

**Seed:** `tests/seed.spec.ts`

#### 6.1. CP-01: Multi-select WYSIWYG — add from default, remove, no-op last (regression)

**File:** `tests/e2e/color-picker.spec.ts`

**Steps:**
  1. goto /; open P1 color picker (gear)
    - expect: dialog color-picker-0 open, Red aria-pressed=true (default [r])
    - expect: 6 mana buttons + Confirm color (CheckCircle) visible
  2. tap White (unselected, default [r])
    - expect: add → [r,w]: Red true, White true (default persists — §8.5.1)
    - expect: dialog stays open
    - expect: zone bg live red+white gradient (r rgb(228,153,119) 0–50%, w rgb(248,246,216) 50–100%)
  3. tap Blue (unselected, multi [r,w])
    - expect: add → [r,w,u]: all three true
    - expect: zone bg live gradient (3 equal bands)
  4. tap Blue again (selected, multi)
    - expect: remove → [r,w]: Blue false, Red+White true
    - expect: zone bg back to red+white gradient
  5. tap White again (selected, multi [r,w])
    - expect: remove → [r]: White false, Red true
    - expect: zone bg solid red rgb(228,153,119)
  6. tap Red again (selected, single [r])
    - expect: no-op: Red stays true (cannot remove last — §8.5.1)
    - expect: zone bg unchanged

#### 6.2. CP-02: Colorless replaces multi-selection and closes immediately (NEW colorless-replace case)

**File:** `tests/e2e/color-picker.spec.ts`

**Steps:**
  1. set P1 to White + Blue via toggles (adds to default → [r,w,u] gradient; dialog stays open)
    - expect: [r,w,u] selected, zone bg gradient
  2. tap Colorless
    - expect: dialog closes immediately
    - expect: zone bg solid rgb(202,197,192) (#CAC5C0)
    - expect: reopen picker: no WUBRG button pressed, White/Blue/Red false ([c] replaced all; Colorless button carries no aria-pressed)

#### 6.3. CP-03: CheckCircle / Escape / backdrop close without dispatch (regression)

**File:** `tests/e2e/color-picker.spec.ts`

**Steps:**
  1. open P1 picker; tap Blue (goes live [r,u] — adds to default); press Escape
    - expect: dialog closes
    - expect: zone stays red+blue gradient (r rgb(228,153,119) + u rgb(193,215,233)) (WYSIWYG — no revert)
  2. open P1 picker again; tap Green; tap CheckCircle (Confirm color)
    - expect: dialog closes
    - expect: zone stays red+green gradient (r rgb(228,153,119) + g rgb(163,192,149)) (confirm closes only)

#### 6.4. CP-04: Gradient hard stops — exact equal bands per color count

**File:** `tests/e2e/color-picker.spec.ts`

**Steps:**
  1. set P1 to White + Blue: gear → `Colorless mana` (applies `["c"]`, closes) → reopen → tap White (replaces `["c"]` → `["w"]`) → tap Blue (add → `["w","u"]`); read zone inline style background (el.style.background, not computed)
    - expect: string is linear-gradient(to bottom right, #F8F6D8 0%, #F8F6D8 50%, #C1D7E9 50%, #C1D7E9 100%) (2 equal bands)
  2. add Black → [w,u,b], read inline background
    - expect: stops at 0%, 33.33%, 66.66%, 100% (3 equal bands: #F8F6D8 0-33.33, #C1D7E9 33.33-66.66, #666565 66.66-100)
  3. add Red + Green → [w,u,b,r,g], read inline background
    - expect: 5 equal bands at 0/20/40/60/80/100%

#### 6.5. CP-05: Per-player independence + persistence across restart (regression)

**File:** `tests/e2e/color-picker.spec.ts`

**Steps:**
  1. set P1 → White, P2 → Blue (separate pickers; single taps ADD to default `["r"]` → `["r","w"]` / `["r","u"]` per §8.5.1)
    - expect: P1 red+white gradient, P2 red+blue gradient
  2. open belt → Restart Life
    - expect: life back to 40
    - expect: P1 still red+white gradient, P2 still red+blue gradient (colors preserved, SPEC §8.1)
  3. reload page (IndexedDB restore)
    - expect: colors + player count restored from game-init/game-state (§4)

### 7. Player Selector / Life Settings (SPEC §8.2–8.4)

**Seed:** `tests/seed.spec.ts`

#### 7.1. PS-01: Count UP 2→5 — new players appended with defaults, existing preserved

**File:** `tests/e2e/player-selector-modal.spec.ts`

**Steps:**
  1. set P1 color White (picker → `White mana` → `Confirm color`; adds to default → `["r","w"]`); set initial life 30; tap P1 −2 (life 28)
    - expect: P1 red+white gradient, life 28
  2. open belt → Players → tap 5 players
    - expect: 5 regions
    - expect: P1 still red+white gradient with life 30 (common reset with new count)
    - expect: P2–P5 red default, all at 30
  3. open P1 commander grid
    - expect: 5 columns all 0 (array length = new player count)

#### 7.2. PS-02: Count DOWN 5→2 — removed players gone, commander arrays rebuilt

**File:** `tests/e2e/player-selector-modal.spec.ts`

**Steps:**
  1. select 5 players; open P1 grid, tap +4 on column 5, close
    - expect: P1 life = 36, 5 columns
  2. open belt → Players → tap 2 players
    - expect: 2 regions
    - expect: P1 life reset to 40, P1 grid shows exactly 2 columns all 0 (damage array rebuilt for new count, §8.4.3)

#### 7.3. PS-03: Same count re-selected still performs common reset

**File:** `tests/e2e/player-selector-modal.spec.ts`

**Steps:**
  1. select 4 players; tap P1 −5 (life 35); add custom counter 'Lore' to P1
    - expect: life 35, Lore present
  2. open belt → Players → tap 4 players again
    - expect: life back to 40 (reset)
    - expect: Lore cleared (custom counters cleared on common reset)
    - expect: still exactly 4 players

#### 7.4. PS-04: Initial Life modal — preset + custom numpad set initialLife and reset (regression)

**File:** `tests/e2e/initial-life-modal.spec.ts`

**Steps:**
  1. open belt → Initial Life → tap preset 30
    - expect: dialog closes
    - expect: both players show 30
  2. tap P1 −1 (29); open belt → Initial Life → + Add custom value → type 77 → + Add
    - expect: dialog closes
    - expect: both players show 77 (new initialLife, common reset)
    - expect: P1 color unchanged (red default)

### 8. RSC / Architecture / PWA Smoke

**Seed:** `tests/seed.spec.ts`

#### 8.1. SM-01: App loads — zero console errors, title, 2 zones (GameShell split sanity)

**File:** `tests/e2e/app-smoke.spec.ts`

**Steps:**
  1. goto /; collect console messages of level error
    - expect: 0 error-level console messages (orientation-lock warning is acceptable)
    - expect: document.title == 'MTG Life Counter'
    - expect: 2 player zones at 40 life
  2. reload page and re-check console
    - expect: 0 errors after hydration (no RSC/client mismatch)
  3. exercise GameShell donut-hole: open belt → Players modal, interact, close
    - expect: belt + modals render/behave while player grid renders around them (RSC children pass-through)

#### 8.2. SM-02: PWA manifest served and linked

**File:** `tests/e2e/app-smoke.spec.ts`

**Steps:**
  1. request /manifest.json
    - expect: HTTP 200 with name 'MTG Life Counter', short_name 'Life Counter'
    - expect: orientation 'portrait'
    - expect: display 'standalone'
    - expect: icons 192 + 512 maskable
  2. read <link rel=manifest> on /
    - expect: manifest link present pointing to /manifest.json

#### 8.3. SM-03: Full interaction sweep on 6p — no errors during layout/grid/swipe/color flows

**File:** `tests/e2e/app-smoke.spec.ts`

**Steps:**
  1. collect console errors; select 6 players; open/close commander on P1 and P6; open/close counters on P3; change P2 color to Blue; Restart Life; then assert console errors
    - expect: 0 error-level console messages across the whole sweep
    - expect: all dialogs open and close cleanly
