# Screen Wake Lock (Invisible Enforcer) — Regression Test Plan

**Contract under test:** DESIGN.md §4–9 (interaction contract) — unchanged by this
feature. Feature under test: `features/lock-portrait/WakeLockEnforcer.tsx` (invisible,
returns `null`) + `features/lock-portrait/LockPortrait.tsx` (mounts `FullscreenEnforcer`
+ `WakeLockEnforcer` + portrait-required overlay) in `app/layout.tsx` (root layout).
README gained a compatibility section (§ Screen wake lock / portrait). No visual change,
no new UI.

**Behavior under review (from source):** `WakeLockEnforcer` ("use client", effect on
mount): early-returns if `"wakeLock" in navigator` is false; otherwise requests
`navigator.wakeLock.request("screen")` on first `pointerdown` (matching
FullscreenEnforcer), reacquires on `visibilitychange → visible`, releases on hidden,
cleanup on unmount. All failures are `console.warn` ("Wake lock request failed." /
"Wake lock release failed.") — never throws, never blocks gameplay (README: Firefox and
pre-18.4 iOS PWA unsupported → fails silently). Renders `null`; no DOM footprint.

**Branch:** `feature/screen-wake-lock`. Server: `pnpm dev` on `http://localhost:3000`
(playwright.config.ts has **no** `webServer`; seed spec pattern assumes it). Config:
chromium only, workers 1, retries 1, baseURL `http://localhost:3000`.

## Application Overview

MTG Life Counter PWA (2–6 players). Home = game table: 2 player zones (default, §3/§4),
each a 3-column zone ([-] | life | [+]), belt menu center. `LockPortrait` sits in the
root layout — its overlay ("Portrait Mode Required") shows only on `pointer-coarse` +
landscape; on desktop Chromium it is present-but-hidden. FullscreenEnforcer enters
fullscreen + locks orientation on first pointerdown (headless Chromium: fullscreen may
succeed, orientation lock warns `NotSupportedError` — **warning is pre-existing and
acceptable**, same convention as app-smoke SM-01). WakeLockEnforcer runs on the same
first pointerdown; in headless Chromium `navigator.wakeLock` may be present (observed
present in local Chromium) or absent — either path must not throw or log an error.

## Shared Setup / Teardown

**Seed:** `tests/seed.spec.ts` (plain `page.goto('http://localhost:3000')`).

- Every test starts `await page.goto("/")` on a **fresh browser context** (no
  `storageState` in config → IDB empty; do not add `storageState`).
- **First pointerdown arms both enforcers.** Any click/gesture may trigger
  `screen.orientation.lock()` warning + (if wakeLock present) a wake-lock request.
  Console **error** assertions must use the `consoleErrors` filter; **warnings are
  allowed** (orientation-lock warning repeats per pointerdown — seen 2 warnings after 2
  gestures). Assert `errors` array is empty, never assert zero warnings.
- **Wake lock is NOT testable in headless Chromium** (API presence/behavior varies by
  version/flag; request outcome depends on permission policy + document visibility).
  Do NOT write assertions on `navigator.wakeLock`, its `request()`, or sentinel state —
  WL-05 documents this as skip/manual.

### Helper cheat-sheet (selectors)

| Thing | Selector |
| --- | --- |
| Player zone | `page.getByRole("region", { name: /^Player \d:/ })` / `zone(page, n)` |
| Life total | `zone.locator('[aria-live="polite"]')` |
| Belt toggle / open | `getByLabel("Open Spellbook Menu")` (+ `#spellbook-toggle` checked) |
| Life adjust | zone `-1 life` / `+1 life` buttons |
| Portrait overlay | `page.getByRole("heading", { name: "Portrait Mode Required" })` (present but hidden on desktop) |
| Hold gesture | `mouse.move(cx, cy)` → `mouse.down()` → `waitForTimeout(ms)` → `mouse.up()` — ms in [1000, 1400) = staged-only → cancelled (no ±10, no ±1); ms ≥ 1400 commits exactly one ±10 per DESIGN §7.1 |

Reuse `zone` / `lifeTotal` / `openBelt` / `closeBelt` / `consoleErrors` helpers verbatim
from `tests/e2e/app-smoke.spec.ts` (per-spec local redefinition convention).
`consoleErrors` must keep the `_vercel/speed-insights` 404 filter. New local helper:
`holdButton(page, locator, ms = 1100)` implementing the hold gesture above. Note: default 1100ms lands in the staged-cancel window (stage @1000ms, commit @1400ms) — pass `ms ≥ 1400` to commit.

## Test Scenarios

### 1. WL-01 — App boots: game table renders (smoke)

**File:** `tests/e2e/screen-wake-lock.spec.ts`

**Steps:**
1. `goto("/")` with `consoleErrors(page)` attached
   - expect: `await expect(page).toHaveTitle("MTG Life Counter")`
   - expect: exactly 2 player regions (`toHaveCount(2)`)
   - expect: P1 and P2 life totals `"40"`
2. `page.reload()` (hydration path — LockPortrait is in the root layout, re-runs
   both enforcers)
   - expect: still 2 player regions, P1/P2 at 40
   - expect: `errors` array `toEqual([])` (no RSC/client mismatch, no enforcer throw)
3. Belt sanity: `openBelt(page)` → "Restart Life" visible → `closeBelt(page)`
   - expect: belt toggles checked/unchecked cleanly (root-layout enforcers didn't
     break layout; belt wrapper settles to 0px height)
   - expect: `errors` still `[]`

### 2. WL-02 — Life counter core intact: tap ±1, hold ±10 (enforcers armed)

**File:** `tests/e2e/screen-wake-lock.spec.ts`

> The first pointerdown here arms FullscreenEnforcer + WakeLockEnforcer mid-test — this
> scenario proves core interaction (DESIGN §7.1) survives both listeners being live.

**Steps:**
1. `goto("/")`; attach `consoleErrors`
2. Tap P1 `+1 life` (first pointerdown → both enforcers fire; must not block the tap)
   - expect: P1 life `"41"`
3. Tap P2 `-1 life` 3×
   - expect: P2 life `"37"`
4. Hold P1 `+1 life` (`holdButton`, 1100ms) — staged ±10 at 1s, released at 1100ms before the 1400ms commit → cancelled
   - expect: P1 life still `"41"` (no ±10, no ±1 — cancel window)
5. Hold P2 `-1 life` (`holdButton`, 1400ms) — commits exactly one −10
   - expect: P2 life `"27"` (37 − 10; exact — cadence is deterministic)
6. Final state
   - expect: P1 `"41"`, P2 `"27"`
   - expect: `errors` `toEqual([])` (wake-lock/fullscreen failures surface as
     `console.warn` only — still zero **errors**)

### 3. WL-03 — LockPortrait intact: FullscreenEnforcer + WakeLockEnforcer co-exist, overlay hidden

**File:** `tests/e2e/screen-wake-lock.spec.ts`

> Regression guard for the co-mounting in `LockPortrait` (DESIGN §8.2 portrait lock):
> the new sibling must not break the existing overlay or intercept input.

**Steps:**
1. `goto("/")`
2. Assert the portrait overlay markup still renders (structural, §8.2)
   - expect: `getByRole("heading", { name: "Portrait Mode Required" })` attached in DOM
   - expect: overlay is **not visible** on desktop Chromium (fine pointer +
     landscape-capable viewport → `pointer-coarse:landscape:flex` variant inactive) —
     `toBeHidden()`
3. Assert the overlay never intercepts: belt + zone interactions pass through
   - `openBelt(page)` → expect "Restart Life" visible → `closeBelt(page)` (belt wrapper
     0px)
   - tap P1 `-1 life` → expect P1 `"39"`
4. Assert no `dialog[open]` left behind and no errors
   - expect: `page.locator("dialog[open]")` count 0
   - expect: `errors` `toEqual([])` — co-mounted enforcers throw no runtime errors
     (component returns `null`; effect must not throw)

### 4. WL-04 — Zero console errors across a full interaction sweep

**File:** `tests/e2e/screen-wake-lock.spec.ts`

**Steps:**
1. `goto("/")` with `consoleErrors` attached; `selectPlayers(page, 3)` (belt → Players →
   "3 players")
   - expect: 3 player regions, P3 at 40 (players flow untouched by root-layout change)
2. Swipe sweep on rotated slots (DESIGN §7.2): open/close Commander on P1 (`swipeOn`
   right), open/close Counters on P3 (`swipeY` up)
   - expect: `dialog[id="commander-dmg-0"]` visible → Escape → not visible
   - expect: `dialog[id="counters-2"]` visible → Escape → not visible
3. P1 color picker: `Change color` → "Blue mana" → "Confirm color"
   - expect: picker closes; P1 zone gradient includes red `rgb(228, 153, 119)` + blue
     `rgb(193, 215, 233)` (Blue adds to default `["r"]`, §8.5.1)
4. `openBelt` → "Restart Life" → `closeBelt`
   - expect: all 3 zones back at 40 (`expect.poll` on aria-live texts)
5. Final assertions
   - expect: `errors` `toEqual([])` across the whole sweep — the wake-lock path
     (pointerdown listener active throughout) logged **no error-level** messages; any
     wake-lock failure is by-design `console.warn` and does not fail this check
   - expect: `dialog[open]` count 0

### 5. WL-05 — Wake Lock API behavior: NOT testable in headless Chromium — skip/manual

**File:** `tests/e2e/screen-wake-lock.spec.ts`

> Marked `test.skip` with a comment — **do not** write assertions on
> `navigator.wakeLock`. Rationale: `"wakeLock" in navigator` is present in some
> headless Chromium builds (observed present locally), absent in others; `request()`
> outcome depends on permission policy, document visibility, and browser flags — none
> controllable via Playwright config. The feature contract is "fails silently, gameplay
> never blocked" (README compatibility section); headless assertions would test the
> browser, not the app.

**Steps (documented for manual execution on real device, e.g. Android Chrome):**
1. `test.skip(...)` — placeholder keeps the intent greppable; no runtime assertions
2. Manual: open app on a phone in Chrome; play (pointerdown) → screen must not sleep
   during play
3. Manual: tab away and back → wake lock reacquired on `visibilitychange → visible`
   (no gameplay interruption)
4. Manual: Firefox (no Wake Lock API) → app functions identically, screen may sleep —
   no errors, no blocked UI

## Notes for the test generator

- One file: `tests/e2e/screen-wake-lock.spec.ts`, one `test.describe("Screen Wake Lock
  Regression")`, one `test()` per WL-xx. Local helper definitions per existing
  convention (verbatim from app-smoke where shared).
- `consoleErrors` must carry the `_vercel/speed-insights` 404 filter from
  `app-smoke.spec.ts`. **Never** assert zero warnings — orientation-lock warnings
  repeat per pointerdown in headless Chromium (observed) and are explicitly acceptable
  per SM-01 convention. Assert zero **errors** only.
- Hold assertions (WL-02): hold stages ±10 at 1s and commits 400ms later (§7.1). A 1100ms
  hold = staged-only → cancelled (no ±10, no ±1) → assert life unchanged. A 1400ms hold
  commits exactly one ±10 → assert the exact delta. Poll the aria-live text via
  `expect.poll` for the post-commit value; never fixed sleeps.
- WL-03 structural check uses `toBeHidden()` on the heading (overlay present-but-hidden
  on desktop); do not assert `toHaveCount(0)` — the overlay div must stay mounted.
- WL-05 keeps a `test.skip` body with the rationale comment; the gate scenarios are
  WL-01 (boot), WL-02 (core interaction), WL-03 (co-existence), WL-04 (error sweep).
- Branch note: SM-01 already guards the general no-errors path; WL-04 extends it
  specifically to the post-first-pointerdown window where WakeLockEnforcer's
  `requestLock` runs.