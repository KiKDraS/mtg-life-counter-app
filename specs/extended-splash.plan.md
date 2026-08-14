# Extended Splash Screen (Hydration Cover) — Test Plan

**Contract under test:** SPEC.md §4.6 (Extended Splash). DESIGN.md has no splash/overlay
provisions — §4.6 is the sole contract. Feature: `features/extended-splash-screen/`
(`ExtendedSplashScreen.tsx` + `components/HideSplashScreenHandler.tsx`), mounted inside
`GameProvider` in `features/game-shell/GameShell.tsx`.

**Behavior under review (from source):** SSR renders `<div id="extended-splash-screen">`
(fixed inset-0, `z-9999`, bg `#292A2A`, centered `Image alt="App Icon"`, `opacity-100`
with 300ms `transition-opacity`) inside GameShell, before GameInner — covers first paint.
`HideSplashScreenHandler` (client leaf, effect on `gameCtx?.state.isHydrated`, first flush
included): adds `pointer-events-none`, swaps `opacity-100`→`opacity-0`, `setTimeout` 310ms
→ `remove()`. No user dismiss paths (no tap/backdrop/Escape). Effect re-runs after removal
→ no-op (element gone).

**Branch:** `feature/splash-hydration-flicker`. Server: `pnpm dev` on
`http://localhost:3000` (playwright.config.ts has **no** `webServer`; seed spec pattern
assumes it). Config: chromium only, workers 1, retries 1, baseURL `http://localhost:3000`.

## Application Overview

MTG Life Counter PWA (2–6 players). SSR renders §3 defaults (2 players, 40 life, red);
a client hydrator reads IndexedDB (`game-init`/`game-state`) post-mount and remounts
providers with restored values (§4.4–4.5). The extended splash overlay is SSR-rendered
over everything (z-9999) and is removed ~310ms after client mount, hiding the
defaults→hydrated-values swap so no state flicker is visible. In dev mode hydration is
fast, so the overlay's visible lifetime is ~310ms — tests favor structural assertions
(SSR HTML presence, lifecycle sequence via MutationObserver, eventual removal,
non-interception) over exact-ms timing.

## Shared Setup / Teardown

**Seed:** `tests/seed.spec.ts` (plain `page.goto('http://localhost:3000')`).

- Playwright gives every test a **fresh browser context** (no `storageState` in config) →
  IDB for `localhost:3000` is empty at each test's first `goto("/")`. Do not add
  `storageState`.
- Every test starts `await page.goto("/")` on a fresh context.
- **Hydration timing is variable in dev.** Never assert the overlay's *absence* with a
  fixed sleep; use auto-retrying expectations (`expect(...).toHaveCount(0)`) or
  `expect.poll` with a generous timeout. The 310ms removal timer starts at client mount,
  so after a successful load the overlay is normally gone within ~1s.
- **SSR HTML snapshot trick (ES-01, ES-02):** `const res = await page.goto("/"); const html = await res.text();`
  — `res.text()` is the raw SSR response, captured before any client JS runs. This is the
  only timing-independent way to see the overlay in its `opacity-100` state.
- **Lifecycle sequence trick (ES-03):** `page.addInitScript` runs before page scripts on
  every navigation — attach a `MutationObserver` on `document.documentElement`
  (`childList: true, subtree: true, attributes: true, attributeFilter: ["class"]`) that
  logs className changes for `#extended-splash-screen` into `window.__splashLog`. Gives a
  deterministic record of insert → `pointer-events-none`/`opacity-0` → remove without
  racing the 310ms timer.

### Helper cheat-sheet (selectors)

| Thing | Selector |
| --- | --- |
| Splash overlay | `page.locator("#extended-splash-screen")` |
| Splash icon | `page.locator('#extended-splash-screen img[alt="App Icon"]')` |
| Player zone | `getByRole("region", { name: /^Player \d:/ })` |
| Life total | `zone.locator('[aria-live="polite"]')` |
| Belt toggle / open | `getByLabel("Open Spellbook Menu")` (+ `#spellbook-toggle` checked) |
| Life adjust | zone `-1 life` / `+1 life` buttons (same pattern as existing specs) |
| Gear / color picker | `zone.getByRole("button", { name: "Change color" })` → `dialog[id="color-picker-<playerId>"]` → `"Blue mana"` → `"Confirm color"` |

Reuse `zone`/`lifeTotal`/`openBelt`/`closeBelt`/`consoleErrors` helpers verbatim from
`tests/e2e/app-smoke.spec.ts` (per-spec local redefinition convention). `consoleErrors`
must keep the `_vercel/speed-insights` 404 filter.

## Test Scenarios

### 1. ES-01 — Overlay is present in SSR HTML with the §4.6 contract, before game content

**File:** `tests/e2e/extended-splash.spec.ts`

**Steps:**
1. `goto("/")`; capture `const html = await res.text()` (raw SSR response — pre-hydration
   snapshot; overlay has NOT been removed yet, no timing race)
   - expect: `html` contains `id="extended-splash-screen"`
2. Assert the SSR contract classes on the overlay's opening tag
   - expect: contains `fixed inset-0 z-9999` (covers viewport, above all UI)
   - expect: contains `bg-[#292A2A]` (brand background, SPEC §4.6)
   - expect: contains `opacity-100` and `transition-opacity duration-300` (visible cover,
     300ms CSS fade)
3. Assert the app icon renders inside the overlay
   - expect: `html` contains `alt="App Icon"`
4. Assert "covers first paint" structurally — overlay markup precedes any game content in
   document order (GameShell renders overlay before GameInner)
   - expect: `html.indexOf('id="extended-splash-screen"') < html.indexOf('role="region"')`
5. Assert no user-dismiss affordances in the SSR markup
   - expect: overlay is a plain `<div>` — NOT `<dialog>`, no `aria-modal` (no focus trap)
   - expect: `pointer-events-none` NOT present in SSR (it is added only at runtime by the
     handler — §4.6)

### 2. ES-02 — Overlay is removed from the DOM shortly after load (fresh context)

**File:** `tests/e2e/extended-splash.spec.ts`

**Steps:**
1. `goto("/")` on a fresh context (clean IDB → fast hydration path, §4.6)
2. Poll for removal with a bounded window — `expect.poll(() => page.locator("#extended-splash-screen").count(), { timeout: 1500 })`
   - expect: `0` (removal timer is 310ms post-mount; 1.5s covers dev-mode jitter)
3. Belt and zones are reachable — the overlay is not blocking anything
   - expect: `page.getByLabel("Open Spellbook Menu")` visible
4. `page.reload()` (same context — IDB now self-seeded, §4.5 path)
   - expect: `expect(page.locator("#extended-splash-screen")).toHaveCount(0)` (auto-retry)
   - expect: exactly 2 player regions, P1/P2 life 40

### 3. ES-03 — Full §4.6 lifecycle sequence: insert → pointer-events-none + fade → remove

**File:** `tests/e2e/extended-splash.spec.ts`

**Steps:**
1. `addInitScript` MutationObserver (per Shared Setup) that pushes each className change
   for `#extended-splash-screen` (and a marker on removal) to `window.__splashLog`
2. `goto("/")`; wait for overlay count 0 (auto-retry)
3. Read `page.evaluate(() => window.__splashLog)`
   - expect: log contains an entry where className includes `opacity-100` (inserted visible)
   - expect: log contains a later entry where className includes `pointer-events-none`
     AND `opacity-0` (handler ran — non-interceptive + fade started)
   - expect: a removal marker after the `pointer-events-none`/`opacity-0` entry (removed
     at 310ms)
   - expect: NO entry where `pointer-events-none` precedes the `opacity-100` insert
     (order contract: visible first, then hidden — §4.6 "covers first paint")

### 4. ES-04 — Overlay never intercepts pointer events after load (regression guard)

**File:** `tests/e2e/extended-splash.spec.ts`

**Steps:**
1. `goto("/")`; wait for `#extended-splash-screen` count 0 (auto-retry) — overlay gone
2. Exercise the same interactions the existing suite relies on (app-smoke pattern):
   `openBelt` → expect `"Restart Life"` button visible → `closeBelt` (belt wrapper height
   0px)
3. Tap P1 `-1 life` 2×
   - expect: P1 life total "38"
4. Open P1 color picker → `Blue mana` → `Confirm color`
   - expect: picker closes; P1 zone bg red+blue gradient (Blue ADDS to default `["r"]` → `["r","u"]`,
     red `rgb(228, 153, 119)` + blue `rgb(193, 215, 233)`; §8.5.1)
5. Final overlay + dialog state
   - expect: `#extended-splash-screen` count 0
   - expect: `page.locator("dialog[open]")` count 0
   - expect: zero console errors (`consoleErrors(page)` helper, `_vercel` filter applied)
   - Rationale: z-9999 overlay sits above everything; if it lingered or re-mounted it
     would swallow belt/zone clicks — this proves the full smoke path stays clickable.

### 5. ES-05 — Reload with persisted non-default state: overlay covers the swap, values restored

**File:** `tests/e2e/extended-splash.spec.ts`

**Steps:**
1. `goto("/")`; tap P1 `-1 life` 3×, P2 `+1 life` 5×
   - expect: P1 "37", P2 "45"
2. Poll IDB (persistence.plan.md `readIdb` helper, `game-state`/`state`) until
   `playerStates[0].life === 37 && playerStates[1].life === 45` — write landed before
   reload
3. `page.reload()` — hydration must now restore 37/45 over the SSR 40/40 defaults (the
   swap the overlay covers)
   - expect: overlay removed (`toHaveCount(0)`, auto-retry)
   - expect: P1 "37", P2 "45" (auto-retry tolerates the brief SSR-default frame; the
     overlay's job is that no *visible* flicker occurs)
4. Zero console errors after reload (hydration mismatch would surface here)

### 6. ES-06 — Slow-hydration visibility: overlay actually covers the viewport pre-hydration

**File:** `tests/e2e/extended-splash.spec.ts`

> Observability trick: dev hydration is fast, so the overlay's visible window (~310ms) is
> normally unobservable. Delay the client chunks to widen the window deterministically:
> `page.route("**/_next/**", async (route) => { await new Promise(r => setTimeout(r, 1200)); await route.continue(); })`
> — SSR HTML + splash render immediately; React hydration (and thus the removal timer)
> starts only after the delayed chunks arrive.

**Steps:**
1. Install the `**/_next/**` route delay (above); `goto("/")` with default `waitUntil`
   (load — delayed scripts make load wait, so use `waitUntil: "commit"` to return with
   the SSR DOM in place)
2. Immediately assert the overlay is live, visible, and covering the whole viewport
   - expect: `#extended-splash-screen` visible (count 1)
   - expect: `toHaveCSS("opacity", "1")` and `toHaveCSS("pointer-events", "auto")` (still
     intercepting — the cover is active)
   - expect: `boundingBox()` ≈ viewport: `{ x: 0, y: 0, width: 1280, height: 720 }`
   - expect: app icon `img[alt="App Icon"]` visible inside the overlay
3. Let the delay expire (chunks arrive → hydration runs → 310ms timer)
   - expect: `#extended-splash-screen` count 0 (auto-retry)
   - expect: belt visible and clickable (`openBelt` works) — no dead zone left behind
   - expect: zero console errors
4. **Flake policy:** this is the only timing-sensitive scenario. If CI shows instability
   (route-delay interacting with dev HMR), downgrade to structural-only (ES-01 + ES-03
   already prove §4.6 behavior deterministically) — mark with `test.skip` + TODO rather
   than deleting the assertion intent.

### 7. ES-07 — Overlay is inert mid-fade: pointer-events-none before removal (no click loss)

**File:** `tests/e2e/extended-splash.spec.ts`

> Fast path companion to ES-03: proves the handler's `pointer-events-none` lands *before*
> the element is removed, so even the 300ms fade window never eats clicks. Deterministic
> via the ES-03 MutationObserver log (no ms asserts).

**Steps:**
1. `addInitScript` MutationObserver (same as ES-03); `goto("/")`; wait overlay count 0
2. Read `window.__splashLog`
   - expect: the last className entry before removal includes `pointer-events-none` —
     i.e. `pointer-events-none` is present in the SAME or an EARLIER entry than `opacity-0`
     (interception disabled the moment the fade starts — §4.6)
3. Belt interaction sanity after removal (guards against any leftover capture phase):
   `openBelt` → `closeBelt`
   - expect: belt toggle toggles checked/unchecked cleanly

## Notes for the test generator

- One file: `tests/e2e/extended-splash.spec.ts`, one `test.describe("Extended Splash
  Screen")`, one `test()` per ES-xx. Local helper definitions per existing convention.
- `consoleErrors` must carry the `_vercel/speed-insights` 404 filter from
  `app-smoke.spec.ts` (SM-01/03 pattern) — off-Vercel dev server 404s that pair
  otherwise.
- The MutationObserver init script (ES-03/ES-07) is the same snippet in both tests —
  define it once as a local helper (`attachSplashLog(page)`).
- `res.text()` (ES-01) is a full SSR HTML read — fine at this scale; do not use
  `page.content()` for SSR assertions (post-hydration DOM).
- ES-05 depends on the IDB write landing before reload — reuse `readIdb` + `expect.poll`
  from `specs/persistence.plan.md` (store `game-state`, key `state`).
- Keep the plan's structural backbone: ES-01 (SSR presence), ES-02 (removal), ES-03
  (mechanism order), ES-04 (non-interception + regression), ES-05 (reload path) are the
  gate. ES-06 is the only flake candidate — apply its flake policy, never reorder the
  others to accommodate timing.
- Branch note: on `feature/splash-hydration-flicker`, app-smoke SM-01's "0 console
  errors" already guards hydration mismatch; ES-01/ES-04/ES-05 extend that to the splash
  lifecycle specifically.
