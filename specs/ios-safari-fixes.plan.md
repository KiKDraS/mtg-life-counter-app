# iOS Safari Fixes Test Plan — MTG Life Counter (feature/ios-safari-fixes)

## Application Overview

MTG Life Counter PWA (Next.js 16 App Router, React 19, Tailwind 4, @playwright/test). Branch `feature/ios-safari-fixes` (uncommitted working-tree changes on top of develop HEAD `080e3f4`) adds iOS Safari support:

1. **Install fallback** — `features/spellbook/components/menu-actions/InstallAppAction.tsx` + new `features/spellbook/components/modals/install-hint/InstallHintModal.tsx` (mounted in `SpellbookMenu.tsx` as `#install-hint-modal`). SPEC.md §8.6 iOS clause: Safari fires no `beforeinstallprompt`; iOS + not standalone → ⬇️ button visible; tap → instructions dialog ("Tap Share, then Add to Home Screen."); standalone → hidden. iOS detection: `"standalone" in navigator || /iPhone|iPad|iPod/.test(navigator.userAgent)`.
2. **Judge keyboard + scroll reset** — `features/ai-judge/components/JudgeModal.tsx`: `KEYBOARD_DETECT_THRESHOLD = 60`, keyboardUp now vs `document.documentElement.clientHeight` (innerHeight shrinks on iOS); lift margin 0 when iOS detected else 48; close event → clears `paddingBottom`, blurs, `window.scrollTo(0, 0)`; focus with `preventScroll` on open. DESIGN.md §6.4.
3. **FullscreenEnforcer guard** — `features/lock-portrait/FullscreenEnforcer.ts`: early return when `typeof document.documentElement.requestFullscreen !== "function"` (iPhone Safari has no Fullscreen API).
4. **WakeLock silence** — `features/lock-portrait/WakeLockEnforcer.tsx`: rejection → silent catch + `failedRef` stop-retry until `visibilitychange → visible`.

App at http://localhost:3000 (2p default, 40 life). All 64 existing tests stay green — additions are **new spec files only**; no changes to existing specs, no config change, no assertion weakening.

**Selectors verified live against the running prod build (this branch):**

| Element | Selector |
|---|---|
| Belt toggle | `page.locator("#spellbook-toggle")` (sr-only checkbox — click the LABEL, never the checkbox) |
| Open/close belt | `page.getByLabel("Open Spellbook Menu").click()` |
| Install App button | `page.getByRole("button", { name: "Install App" })` |
| Install hint dialog | `page.locator("dialog#install-hint-modal")` — `toBeVisible()` / `evaluate(el => el.open)` |
| Hint dialog accessible name | `getByRole("dialog", { name: "Install App" })` (`aria-labelledby="install-hint-title"`) |
| Hint heading | `getByRole("heading", { name: "Install App" })` (sr-only `<h2>`) |
| Hint copy | `page.getByText("Tap Share, then Add to Home Screen.")` (exact; `text-body-sm`) |
| Judge modal | `page.locator("#ai-judge-modal")` |
| Judge input | `getByRole("textbox", { name: "Ask about a card or rule" })` |
| Judge form | `modal(page).locator("form")` |
| Lift state | `page.evaluate(() => document.getElementById("ai-judge-modal").style.paddingBottom)` |
| Scroll state | `page.evaluate(() => window.scrollY)` |
| Life buttons | `getByRole("button", { name: "+1 life" | "-1 life" })` inside `region "Player N: ..."` |
| Hydration wait | `expect(page.locator("#extended-splash-screen")).toHaveCount(0)` (screen-wake-lock.spec.ts `waitForBoot` convention — splash removal = hydrated state; a pre-hydration tap is wiped) |

**Verified live facts (measured on this branch, prod build):**

- Page at 1280×720 is **not scrollable** (`scrollHeight === clientHeight === 720`) — the scroll-reset test MUST force scrollability (`document.body.style.minHeight = "2000px"` then `window.scrollTo(0, 300)`; verified scrollY 300 lands).
- Chromium 1280×720: `clientHeight 720` → keyboard threshold = 660. WebKit 1280×720: `clientHeight 720` (same).
- WebKit (webkit-2359) has `visualViewport` (height 720, offsetTop 0) and **no** `navigator.virtualKeyboard` → JudgeModal mounts the vv fallback branch naturally. Chromium headless HAS a prototype `virtualKeyboard` getter → the vv branch must be forced with the TC-AJ-36 shadow (`Object.defineProperty(navigator, "virtualKeyboard", { value: undefined, configurable: true })` in `addInitScript` BEFORE goto).
- **Live lift math (this build):** Chromium form bottom = 720 (= clientHeight; TC-AJ-36's 704 is pre-`judge-input-grow` and the existing 468px assertion is unchanged/consistent). WebKit form bottom = 720.
  - Chromium, shrink 300 → `"468px"` (720 − (300 − 48)) — matches existing TC-AJ-36.
  - Chromium, shrink 600 → `"168px"` (720 − (600 − 48)); shrink 707 (13px jitter) → `"13px"` (raw overflow 720 − 707; NO margin — threshold gates the margin, not the self-calibrating overflow lift; 13 ≠ 61).
  - WebKit + iOS stub, shrink 300 → `"420px"` (720 − 300, margin 0). WebKit non-iOS same shrink → `"468px"` (margin applies).
- Escape close (real flow, Chromium): textarea focused → Escape → `open false`, `scrollY 0`, `paddingBottom ""`, activeElement BODY. Verified live.
- iOS stub via `Object.defineProperty(navigator, "standalone", { value: false, configurable: true })` in addInitScript works in BOTH WebKit and Chromium (`"standalone" in navigator` → true → `isIos`). With the stub, the Install App button renders in WebKit AND Chromium (no beforeinstallprompt needed).
- Per-file `test.use({ browserName: "webkit" })` verified working under the chromium-only project config (runs the file on the webkit engine, webkit-2359 installed). No config change needed.
- Headless WebKit: `requestFullscreen` EXISTS and SUCCEEDS on first pointerdown (FullscreenEnforcer enters fullscreen) — belt interactions after the first tap must rely on Playwright's actionability waits (verified stable with explicit waits).
- Console baselines: Chromium — 4 `_vercel` 404 errors (benign, existing filter) + per-pointerdown warning `Orientation lock failed... NotSupportedError` (pre-existing, screen-wake-lock.spec.ts SM-01 convention: never assert zero warnings). WebKit — `_vercel` 404s with DIFFERENT message text (`Refused to execute ... as script because "X-Content-Type-Options: nosniff"`) → WebKit files must filter by URL/script name (`speed-insights`/`insights`), not the Chromium message text.

## Environment Requirements (mandatory)

- **Run against the production build** (`pnpm build && pnpm start`) — the playwright.config.ts webServer already does this. Dev-mode HMR double-load breaks init-script-dependent state (install-app.plan.md §Environment).
- Server at http://localhost:3000. Fresh context per test; self-seeding with `page.goto("/")` (existing convention).
- Config: `playwright.config.ts` (single chromium project, baseURL localhost:3000, 1280×720, 1 worker, retries 1). **No config change.** WebKit files override per-file: `test.use({ browserName: "webkit" })` at file top (verified working 2026-09-22).
- **addInitScript MUST be registered before `page.goto`** (it runs on every navigation, pre-app-scripts). All stubs below follow this.
- Header comment convention in each new spec: `// spec: specs/ios-safari-fixes.plan.md` + `// seed: tests/seed.spec.ts`.

## Mock Techniques (all addInitScript, all verified live)

```ts
// iOS detection stub (value false = browser Safari; true = installed PWA standalone)
await page.addInitScript(() => {
  Object.defineProperty(navigator, "standalone", { value: false, configurable: true });
});

// Chromium only: force the vv fallback branch (shadow the prototype virtualKeyboard getter)
await page.addInitScript(() => {
  Object.defineProperty(navigator, "virtualKeyboard", { value: undefined, configurable: true });
});

// Keyboard shrink simulation (TC-AJ-36 shadow-getters pattern; vv height/offsetTop are
// prototype getters — own data properties shadow them, then a resize event fires sync)
await page.evaluate(() => {
  const vv = window.visualViewport!;
  Object.defineProperty(vv, "height", { value: 300, configurable: true });
  Object.defineProperty(vv, "offsetTop", { value: 0, configurable: true });
  vv.dispatchEvent(new Event("resize"));
});

// FullscreenEnforcer guard: remove the Fullscreen API (iPhone Safari reality)
await page.addInitScript(() => {
  Object.defineProperty(Element.prototype, "requestFullscreen", {
    value: undefined,
    configurable: true,
  });
});

// WakeLock rejection stub with attempt counter (proves the failedRef retry guard)
await page.addInitScript(() => {
  Object.defineProperty(navigator, "wakeLock", {
    value: {
      request: async () => {
        (window as any).__wlRequests = ((window as any).__wlRequests ?? 0) + 1;
        throw new DOMException("Wake Lock API request failed", "NotAllowedError");
      },
    },
    configurable: true,
  });
});
```

**iOS detection approach — decision (per brief "explore and decide"):** use the `navigator.standalone` defineProperty stub, NOT a UA override. Deterministic in both engines, no UA-spoof side effects, and it exercises the exact `"standalone" in navigator` clause the implementation uses. The `/iPhone|iPad|iPod/.test(userAgent)` clause is the same branch — a UA override is a valid alternative but adds no coverage; note it in test comments if a run ever needs it.

## Contract Deviations Discovered (flag to `@code-review`)

Live-verified on this branch (prod build):

1. **Backdrop tap does NOT close the install hint dialog (both engines).** `InstallHintModal`'s content div is `flex flex-1 ... items-center justify-center` and covers the ENTIRE dialog surface (measured 1280×720, same rect as the dialog). `DialogShell.handleBackdropClick` only closes when `e.target === e.currentTarget` — the dialog element itself is unreachable, so every tap lands on the div (or svg/p) and the handler never fires. DESIGN §6.1 ("Selection modals omit ✕ close button — close via backdrop tap or Escape") is violated for this modal. II-04 asserts the contract and will FAIL on the current implementation. Likely fix: explicit close affordance for this modal (e.g. ✕ button, document-level Escape listener, or making the content div `pointer-events-none` so taps fall through to the dialog element) — app fix, not test change.
2. **Escape does NOT close the install hint dialog in WebKit.** Chromium's `show()` runs the dialog focusing steps (focus lands on the dialog element → Escape keydown bubbles through it → DialogShell onKeyDown closes — verified). WebKit's `show()` does NOT move focus (verified: after tap, Escape leaves the dialog open; focus stays on the belt button, which is a DOM sibling — the keydown path never includes the dialog). On real iPhone Safari there is no hardware Escape at all, so with deviation 1 the dialog is effectively **uncloseable on iPhone**. II-03 asserts the contract and will FAIL under WebKit. Likely fix: an explicit close path (see 1) that works without a keyboard — e.g. a close button or document-level listener. APP-BUG verdict per AGENTS.md test gate if these assertions fail.
3. **Scroll-reset + threshold behavior confirmed as designed** — no deviation: the threshold gates the 48px margin only; a 13px jitter still produces the self-calibrating raw-overflow lift (`"13px"`). This is DESIGN §6.4-correct (lift = measured overflow; margin only while keyboard up). The plan pins `"13px"` (and `13 ≠ 61`) so the margin is proven absent.

## A. New `tests/e2e/ios-install.spec.ts` — WebKit (`test.use({ browserName: "webkit" })`)

Describe "iOS Install Fallback". All tests: addInitScript standalone stub (unless stated), goto, hydration wait, then belt interactions. NOTE for the generator: in headless WebKit the first pointerdown triggers a real `requestFullscreen` (succeeds) — rely on Playwright actionability waits after belt opens; a `waitFor`/`expect` visible before clicking is required.

### II-01: iOS detected (navigator.standalone present) → Install App button visible WITHOUT beforeinstallprompt

**Steps:**
1. File top: `test.use({ browserName: "webkit" })`. addInitScript: `Object.defineProperty(navigator, "standalone", { value: false, configurable: true })`.
2. `page.goto("/")`; hydration wait (`#extended-splash-screen` count 0).
3. Open belt via `getByLabel("Open Spellbook Menu").click()`; expect `#spellbook-toggle` checked.
4. `expect(getByRole("button", { name: "Install App" })).toBeVisible()` — NO `beforeinstallprompt` mock dispatched (contrast: install-app.spec.ts IA-02 needs the mock; the iOS fallback replaces the event).
5. Sanity: Restart Life / Initial Life / AI Judge / Players all visible.

**Expects:** button rendered purely from the iOS fallback (SPEC §8.6 iOS clause; DESIGN §5.2 ⬇️ left-far); 5-icon belt intact.

### II-02: Tap Install App → instructions dialog opens with SPEC §8.6 copy + belt collapses

**Steps:**
1. Setup per II-01; open belt.
2. Click Install App button.
3. `expect(page.locator("dialog#install-hint-modal")).toBeVisible()` (opened via `dialog.show()`, non-modal).
4. Assert content: `getByRole("heading", { name: "Install App" })` visible; `getByText("Tap Share, then Add to Home Screen.", { exact: true })` visible.
5. Assert belt collapsed: `#spellbook-toggle` not checked (MenuActionButton behavior, DESIGN §5.2).
6. Assert accessible name: `getByRole("dialog", { name: "Install App" })` count 1.

**Expects:** dialog with exact SPEC §8.6 copy; belt retracts on action tap; dialog announced as "Install App".

### II-03: Escape closes the instructions dialog

**Steps:**
1. Setup per II-01; tap Install App; dialog visible.
2. `page.keyboard.press("Escape")`.
3. Expect dialog NOT visible.
4. Reopen belt, tap again, Escape again.

**Expects:** close via Escape (DESIGN §6.1), repeatable. **KNOWN: fails under WebKit (deviation 2) — flag APP-BUG, do not weaken to a Chromium-only expectation without code-review sign-off.**

### II-04: Backdrop tap closes the instructions dialog

**Steps:**
1. Setup per II-01; tap Install App; dialog visible.
2. `page.mouse.click(640, 640)` — dialog surface away from content (content is centered; bottom strip is inside the flex-1 div).
3. Expect dialog NOT visible.

**Expects:** close via backdrop tap (DESIGN §6.1). **KNOWN: fails (deviation 1 — content div covers the dialog surface; handler unreachable) — flag APP-BUG.**

### II-05: Standalone (navigator.standalone true) → Install App button hidden

**Steps:**
1. addInitScript: `Object.defineProperty(navigator, "standalone", { value: true, configurable: true })` — iOS + standalone → `isStandalone` true.
2. goto, hydration wait, open belt.
3. `expect(getByRole("button", { name: "Install App" })).toHaveCount(0)` — belt OPEN (proves the standalone gate, not belt-collapse hiding).
4. Sanity: other 4 buttons visible.

**Expects:** button absent entirely. NOTE: different from the Chromium path (install-app.plan.md deviation 1: icon hidden, button remains) — the iOS render gate removes the whole button. Do not assert the icon here.

### II-06: Belt open/close cycles with iOS fallback armed

**Steps:**
1. Setup per II-01.
2. Open belt → Install App visible; close via M logo → all 5 buttons `toHaveCount(0)`; reopen → all 5 visible.

**Expects:** fallback state survives belt cycles (component never unmounts — belt is CSS-only).

## B. New `tests/e2e/ios-judge.spec.ts` — WebKit (`test.use({ browserName: "webkit" })`)

Describe "iOS Judge Keyboard". No vk shadow needed in WebKit (no `navigator.virtualKeyboard` — verified). Form bottom measured at 720 in WebKit.

### IJ-01: iOS detected → lift margin 0 (vv bottom = keyboard top, no 48px Gboard margin)

**Steps:**
1. addInitScript: `navigator.standalone` false stub (JudgeModal `isIos` → true).
2. goto, hydration wait, open belt, click "AI Judge", modal visible.
3. Baseline: `dialog.style.paddingBottom === "0px"`; `document.documentElement.clientHeight === 720`.
4. Keyboard simulation: shadow `vv.height = 300`, `offsetTop = 0`, dispatch `resize`. (keyboardUp: 300 < 720 − 60.)
5. Read `paddingBottom` → **"420px"** (720 − 300; margin 0). Pin: 420 ≠ 468 (the non-iOS value — margin suppression is the iOS branch's job, DESIGN §6.4).
6. Form bottom lands at 300: `form.getBoundingClientRect().bottom === 300`.

**Expects:** lift = exact overflow, no 48px margin on iOS.

### IJ-02: Non-iOS WebKit contrast — same shrink applies the 48px margin

**Steps:**
1. NO standalone stub (desktop WebKit, `isIos` false; vv branch attaches — no virtualKeyboard).
2. goto, hydration wait, open judge modal.
3. Same shrink simulation (vv.height 300, offsetTop 0, resize).
4. Read `paddingBottom` → **"468px"** (720 − (300 − 48)).

**Expects:** margin applies when not iOS — proves IJ-01's 420 is specifically the iOS suppression.

## C. New `tests/e2e/judge-close-reset.spec.ts` — Chromium (default project)

Describe "Judge Close Reset + Keyboard Threshold". vk shadow required (TC-AJ-36 pattern — else the vk branch attaches and vv resize is a no-op).

### JC-01: Close event clears lift, blurs input, resets scroll

**Steps:**
1. addInitScript: vk shadow (value undefined). goto, hydration wait, open judge modal.
2. Force scrollable: `page.evaluate(() => { document.body.style.minHeight = "2000px"; window.scrollTo(0, 300); })` — REQUIRED (page not scrollable at 1280×720).
3. Assert `window.scrollY === 300`.
4. Keyboard up: shadow `vv.height = 300`, dispatch resize → `paddingBottom === "468px"` (known-good lifted state).
5. `page.keyboard.press("Escape")` — textarea is focused (focus on open, DESIGN §6.4) → keydown bubbles through dialog → close.
6. Assert: modal not visible; `window.scrollY === 0`; `dialog.style.paddingBottom === ""`; `document.activeElement` is not the judge textarea.
7. Cleanup (fresh context per test is the default — no explicit cleanup needed).

**Expects:** handleClose contract (DESIGN §6.4): paddingBottom cleared, blur, `window.scrollTo(0, 0)` — page never left shifted.

### JC-02: ~13px viewport shrink (URL-bar jitter) → NO 48px margin

**Steps:**
1. Setup per JC-01; judge modal open.
2. Shadow `vv.height = 707` (13px below 720; above threshold 660), dispatch resize.
3. Read `paddingBottom` → **"13px"** (raw overflow 720 − 707; keyboardUp false → margin 0). Pin: 13 ≠ 61 (would be 13 + 48 if the margin wrongly applied while keyboard "down").
4. Wait ≥ 600ms (past the 500ms poll), re-read → still "13px" (self-calibrating no-op at overflow 0).

**Expects:** threshold gates the MARGIN only; jitter shrink lifts the raw overflow and stays stable — no drift, no margin spike.

### JC-03: Shrink below clientHeight − 60 → 48px margin applies

**Steps:**
1. Setup per JC-01; judge modal open.
2. Shadow `vv.height = 600` (keyboardUp true: 600 < 660), dispatch resize.
3. Read `paddingBottom` → **"168px"** (720 − (600 − 48)). Pin: never 120 (no-margin value).

**Expects:** margin applies exactly while keyboardUp; value matches DESIGN §6.4 formula (contrast 468px at 300 per TC-AJ-36).

## D. New `tests/e2e/enforcer-guards.spec.ts` — Chromium (default project)

Describe "Enforcer Guards (iOS absence / rejection)". No changes to screen-wake-lock.spec.ts (layout coverage stays).

### EG-01: requestFullscreen absent (iPhone Safari) → guard silent, app functional

**Steps:**
1. addInitScript: `Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined, configurable: true })` — `typeof document.documentElement.requestFullscreen !== "function"` → FullscreenEnforcer early return (the iPhone Safari guard).
2. Attach console collector (errors + warnings) BEFORE goto; filter `_vercel` pair (Chromium message variants: `_vercel/` in text, or "Failed to load resource: ... 404").
3. goto, hydration wait.
4. Tap P1 +1 life → 41 (pointerdown hits the window listener — if the guard regressed, this tap would attempt fullscreen/orientation).
5. Tap P2 −1 life → 39 (repeat).
6. Assert collector empty after filter — **no "Fullscreen mode failed" AND no "Orientation lock failed"** (the pre-existing per-pointerdown orientation warning is ABSENT here — that absence is the guard proof; contrast screen-wake-lock.spec.ts where it repeats).

**Expects:** zero console noise on every pointerdown; gameplay unaffected.

### EG-02: WakeLock request rejects (NotAllowedError) → silent, failedRef stops retry spam

**Steps:**
1. addInitScript: counting wakeLock stub (see Mock Techniques — increments `window.__wlRequests`, rejects with NotAllowedError).
2. Console collector (filter `_vercel` pair AND the known pre-existing "Orientation lock failed" warning — SM-01 convention: never assert zero warnings; this filter keeps the assertion about wake-lock output only).
3. goto, hydration wait.
4. Tap 3× (P1 +1, P2 −1, P1 +1) — each pointerdown triggers `requestLock`.
5. Assert life totals (41 / 39) — rejected wake lock never blocks gameplay.
6. Assert `window.__wlRequests === 1` — exactly ONE request attempt for 3 taps (`failedRef` stops re-requests; re-allowed only on `visibilitychange → visible`).
7. Assert no collected console error/warning mentioning wake/wakeLock (the catch is silent by design).

**Expects:** first rejection silences the retry path; no console spam; app functional (WakeLockEnforcer contract: "Fails silently ... never block gameplay").

## Success Criteria

- All new TCs pass against the prod build: II-01, II-02, II-05, II-06 (install fallback core), IJ-01/IJ-02 (iOS margin 0 + contrast), JC-01/02/03 (close reset + threshold), EG-01/02 (enforcer guards).
- II-03 (Escape) and II-04 (backdrop) assert the DESIGN §6.1 close contract; they are **expected to FAIL on the current implementation** (deviations 1–2) and must be triaged per the AGENTS.md test gate: verdict APP-BUG (dialog close affordance missing) → app fix + re-audit. Do not mark TEST-STALE without code-review agreement.
- All 64 existing tests stay green — no edits to existing spec files, no config change, no assertion weakening.
- `pnpm lint` green (new files outside `features/**/state/**` — no state-spaghetti scope impact; no new deps).

## Failure Conditions / Triage

| Failure | Most likely cause | Action |
|---|---|---|
| II-01: Install App not visible with stub | Stub registered after goto (addInitScript after navigation) / hydration race (splash still up) | Move addInitScript before goto; use `#extended-splash-screen` waitForBoot |
| II-01: button visible WITHOUT the stub | iOS detection broken (e.g. regex matches desktop UA) | Review `InstallAppAction` `isIos` evaluation |
| II-03/II-04: Escape/backdrop don't close | Deviations 1–2 (live-verified) | Flag APP-BUG to `@code-review`: hint modal needs a close affordance (content div covers dialog surface; WebKit `show()` doesn't move focus) |
| IJ-01: paddingBottom not 420px | iOS stub missing (isIos false → 468px margin applied) or vv shadow not dispatched | Check `navigator.standalone` stub present before goto; verify resize dispatch after defineProperty |
| IJ-02: paddingBottom not 468px | Stub leaked from IJ-01 (fresh context per test default — check no shared state) | Each test self-contained; addInitScript per test |
| JC-01: scrollY not 0 after Escape | handleClose regression (scrollTo removed) or Escape didn't close (focus not in dialog) | Review `handleClose`; verify textarea focus (focus on open, `preventScroll`) |
| JC-01: scrollY can't reach 300 | Body minHeight not applied / page fits viewport | Apply `body.style.minHeight = "2000px"` BEFORE scrollTo |
| JC-02: paddingBottom 61px | Threshold regression (keyboardUp true at 13px) | Review `syncViaViewport` threshold comparison |
| JC-03: paddingBottom 120px | Margin not applied when keyboardUp | Review margin subtraction in `syncViaViewport` |
| EG-01: orientation/fullscreen warnings appear | Guard removed or `typeof` check wrong (own prop vs prototype) | Verify `Element.prototype.requestFullscreen` defineProperty (not `documentElement` own prop) |
| EG-02: `__wlRequests` > 1 after 3 taps | `failedRef` logic broken | Review `WakeLockEnforcer` catch → `failedRef.current = true` |
| WebKit tests fail to launch | webkit engine not installed / per-file override not honored | `npx playwright install webkit` (webkit-2359 present); override verified 2026-09-22 |

## Files

- **New:** `tests/e2e/ios-install.spec.ts` (WebKit, II-01..06), `tests/e2e/ios-judge.spec.ts` (WebKit, IJ-01..02), `tests/e2e/judge-close-reset.spec.ts` (Chromium, JC-01..03), `tests/e2e/enforcer-guards.spec.ts` (Chromium, EG-01..02)
- **Modified:** none (existing 64 tests untouched)
- **Reference only:** `features/spellbook/components/menu-actions/InstallAppAction.tsx`, `features/spellbook/components/modals/install-hint/InstallHintModal.tsx`, `features/spellbook/components/SpellbookMenu.tsx`, `shared/components/DialogShell.tsx`, `features/ai-judge/components/JudgeModal.tsx`, `features/lock-portrait/FullscreenEnforcer.ts`, `features/lock-portrait/WakeLockEnforcer.tsx`, DESIGN.md §5.2/§6.1/§6.4, SPEC.md §8.6, `tests/e2e/ai-judge.spec.ts` (TC-AJ-36/38 patterns), `tests/e2e/install-app.spec.ts`, `tests/e2e/screen-wake-lock.spec.ts`