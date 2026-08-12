# Install App Action Test Plan — MTG Life Counter (feature/install-app-action)

## Application Overview

MTG Life Counter PWA (Next.js 16 App Router, React 19, Tailwind 4, @playwright/test). Life tracking for 2–6 players. Branch `feature/install-app-action` under review adds the ⬇️ Install App action to the Spellbook belt (5-icon layout). Contracts: DESIGN.md §5.2 (5-icon belt: left far→near = ⬇️ Install App, ⚙️ Initial Life, ⟳ Restart; right = ⚖️ AI Judge, 👥 Players), SPEC.md §8.6 (installability gate: button renders ONLY after `beforeinstallprompt` captured with `preventDefault()`; tap → `deferredPrompt.prompt()` → `await userChoice` → clear stored prompt; `appinstalled` → button removed; standalone hidden via CSS `pwa:` variant; tap collapses belt via shared `MenuActionButton`). App at http://localhost:3000 (2p default, 40 life).

**Selectors verified live against the source (feature branch):**

| Element | Selector |
|---|---|
| Belt checkbox (state) | `page.locator("#spellbook-toggle")` — `toBeChecked()` / `not.toBeChecked()` |
| Open belt | `page.getByLabel("Open Spellbook Menu").click()` |
| Install App button | `page.getByRole("button", { name: "Install App" })` |
| Install icon (⬇️) | `page.getByRole("img", { name: "Browser Updated" })` — `BrowserUpdated` icon renders a `<span role="img" aria-label="Browser Updated">` wrapper; `pwa:hidden` is applied to THIS span, not to the button |
| Other belt actions | `getByRole("button", { name: "Restart Life" | "Initial Life" | "AI Judge" | "Players" })` |

**Verified live facts (source inspection, branch HEAD `feature/install-app-action`):**

- `features/spellbook/components/menu-actions/InstallAppAction.tsx`: `useEffect` registers `window` listeners for `beforeinstallprompt` (calls `preventDefault()` then `setInstallPrompt(event)`) and `appinstalled` (`setInstallPrompt(null)`). Render gate: `if (!installPrompt) return null`. `handleInstall`: `await installPrompt.prompt()` → `await installPrompt.userChoice` → `setInstallPrompt(null)`. Button via `MenuActionButton ariaLabel="Install App"`. Listeners are on `window` → a `page.evaluate`-dispatched synthetic `Event("beforeinstallprompt")` reaches them.
- `features/spellbook/components/SpellbookMenu.tsx`: `<InstallAppAction>` is the FIRST child of the left `ActionGroup` (DOM order left→right: ⬇️, ⚙️, ⟳ — matches DESIGN far→near from center). Icon: `<BrowserUpdated className={cn(BTN_SIZE, "pwa:hidden")} />`.
- `app/globals.css` line 63: `@custom-variant pwa (@media (display-mode: standalone));` — the `pwa:` variant is a media-query variant; CDP `Emulation.setEmulatedMedia` with feature `display-mode: standalone` makes it match in Chromium.
- `features/spellbook/components/MenuActionButton.tsx`: click handler unchecks `#spellbook-toggle` (belt collapses) then calls `onClick`.
- Belt closed = container `invisible` → buttons excluded from the a11y tree → `getByRole(...).toHaveCount(0)` passes on closed belt even when the button IS rendered. `getByRole` count assertions only prove rendering state when the belt is open.
- `handleInstall` awaits `installPrompt.userChoice` — if the mock stub omits `userChoice`, `await undefined` resolves immediately (no hang). Supplying `userChoice` is optional hardening.
- The mock's `prompt()` stub resolves after 10 ms — assertions after tapping need a poll/wait, not a synchronous check.

**Environment requirements (mandatory):**

- **Run against the production build** (`pnpm build && pnpm start`) like `specs/pwa.plan.md`. Dev-mode HMR performs a second page load ~100 ms after first load; the mock event is NOT re-fired on reload, so the install gate state resets and tests go flaky. Prod build has no reload. (All TCs are offline-free; no SW interplay, but the prod-build rule keeps timing deterministic.)
- Server running at http://localhost:3000. Fresh context per test (Playwright default — seed `tests/seed.spec.ts` is `goto /` only; new spec files are self-seeding with `page.goto("/")`, same convention as `tests/e2e/spellbook-belt.spec.ts`).
- Config: `playwright.config.ts` (chromium only, baseURL `http://localhost:3000`, 1280×720, 1 worker, retries 1). No config change needed.
- Hydration before mocking: `beforeinstallprompt` listener registers in `useEffect` (post-hydration). Always wait for a hydration signal before dispatching the mock — e.g. `await page.getByRole("button", { name: "+1 life" }).first().waitFor()`.

**Mock techniques (Playwright cannot fire `beforeinstallprompt`/`appinstalled` natively):**

```ts
// Shared helper — dispatch mocked beforeinstallprompt + spies. Event instances
// are extensible in V8; assigning `prompt` works. Must run AFTER hydration.
async function mockInstallPrompt(page: Page): Promise<void> {
  await page.evaluate(() => {
    const ev = new Event("beforeinstallprompt", { cancelable: true });
    ev.prompt = () =>
      new Promise<void>((res) =>
        setTimeout(() => {
          (window as any).__installChoice = "accepted";
          (window as any).__promptCalled = true;
          res();
        }, 10),
      );
    window.dispatchEvent(ev);
  });
}
```

- `appinstalled` mock: `await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));`
- Standalone emulation (primary, reliable in Chromium):
  `const cdp = await page.context().newCDPSession(page); await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "display-mode", value: "standalone" }] });`
  Create the CDP session BEFORE `goto` (emulation applies to the page). Fallback if flaky: `page.addInitScript` overriding `window.matchMedia("(display-mode: standalone)")` to always match — pick per run, note which in the test comments.
- Caveat: `prompt` stub calls are async (10 ms timer) — assert with `await expect.poll(() => page.evaluate(() => (window as any).__promptCalled)).toBe(true)` or `page.waitForFunction`.

**Contract deviations discovered (flag to `@code-review`):**

1. **Standalone hides the icon, NOT the button.** SPEC §8.6 says "button hidden in standalone"; the implementation applies `pwa:hidden` to the `BrowserUpdated` span inside `MenuActionButton`, so in `display-mode: standalone` the ⬇️ icon is `display:none` but the (empty, still clickable, still in the a11y tree) `button[aria-label="Install App"]` remains in the belt. Tests assert the ICON is hidden; if reviewers want the button truly absent, that is a code change, not a test change.
2. Belt layout reads left→right as ⬇️ ⚙️ ⟳ — visually the Install icon sits at the far left, which matches DESIGN "left far = ⬇️". No conflict; noted for the ordering check in IA-07.

---

## A. Updates to `tests/e2e/spellbook-belt.spec.ts` (TC-2.1..2.4)

All 4 existing TCs keep their current assertions unchanged; only ADD Install App lines. Each affected TC dispatches the mock before opening the belt (CRITICAL: without a mocked `beforeinstallprompt` the button does not render at all, so a "visible" expectation would fail on a correct app — the mock makes the assertion meaningful; see the installability gate in SPEC §8.6).

Add to the spec file top (after the existing helpers):

```ts
async function mockInstallPrompt(page: Page): Promise<void> {
  await page.evaluate(() => {
    const ev = new Event("beforeinstallprompt", { cancelable: true });
    ev.prompt = () =>
      new Promise<void>((res) =>
        setTimeout(() => {
          (window as any).__installChoice = "accepted";
          (window as any).__promptCalled = true;
          res();
        }, 10),
      );
    window.dispatchEvent(ev);
  });
}
```

### TC-2.1: M logo opens belt with 5 icons (was "4 icons")

**Steps:**
1. `page.goto("/")`; wait hydration signal (`+1 life` button first). 
2. `await mockInstallPrompt(page)` — mock MUST precede belt open.
3. Existing 4 count-0 assertions (Restart Life / Initial Life / AI Judge / Players) — unchanged.
4. Add: `await expect(page.getByRole("button", { name: "Install App" })).toHaveCount(0)` (belt closed → invisible, excluded from a11y tree).
5. Open belt via `getByLabel("Open Spellbook Menu").click()`; `expect(belt(page)).toBeChecked()`.
6. Existing 4 `toBeVisible()` assertions — unchanged.
7. Add: `await expect(page.getByRole("button", { name: "Install App" })).toBeVisible()`.

**Expects:** checkbox checked; all 5 buttons visible (Install App renders only because of the mock in step 2).

### TC-2.2: M logo collapses belt

**Steps:**
1. `goto("/")`; wait hydration; `mockInstallPrompt(page)`.
2. Open belt; existing "Restart Life visible" check; ADD `expect(getByRole("button", { name: "Install App" })).toBeVisible()` (proves the rendered button is present before collapse).
3. Close via M logo; existing 4 count-0 assertions; ADD `expect(... { name: "Install App" }).toHaveCount(0)`.

**Expects:** after close, checkbox unchecked and all 5 buttons hidden — the Install App count-0 line is only meaningful because the mock rendered it in step 2.

### TC-2.3: Click outside belt collapses it

Same as TC-2.2 but close via `label[for="spellbook-toggle"][aria-label="Close menu"]` with `click({ force: true })` (existing pattern). Mock + add Install App visible (open) / count-0 (closed) lines.

### TC-2.4: Belt icon ARIA labels correct

**Steps:**
1. `goto("/")`; wait hydration; `mockInstallPrompt(page)`; open belt.
2. Existing 4 `toBeVisible()` aria checks — unchanged.
3. Add: `await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();` and `await expect(page.getByRole("button", { name: "Install App" })).toHaveAttribute("aria-label", "Install App")`.

**Expects:** 5 distinct accessible names; `aria-label="Install App"` exact.

---

## B. New `tests/e2e/install-app.spec.ts` — describe "Install App action"

Single `test.describe("Install App action", ...)`. Header comment: `// spec: specs/install-app.plan.md` + `// seed: tests/seed.spec.ts` (convention from existing specs). Helpers: `openBelt` (existing pattern from `spellbook-belt.spec.ts`), `mockInstallPrompt` (above), `expectButtonGone` = `expect(page.getByRole("button", { name: "Install App" })).toHaveCount(0)`.

All TCs: fresh context (default), `goto("/")`, hydration wait before any mock. Runs against prod build.

### IA-01: No beforeinstallprompt event → Install App button absent (gate)

**Steps:**
1. `goto("/")`; wait hydration. NO mock.
2. Open belt.
3. `expect(page.getByRole("button", { name: "Install App" })).toHaveCount(0)`.

**Expects:** count 0 with belt OPEN (proves the gate, not belt-collapse hiding). Sanity: the other 4 buttons visible — belt itself renders normally.

### IA-02: Mocked beforeinstallprompt → button visible

**Steps:**
1. `goto("/")`; wait hydration; `mockInstallPrompt(page)`.
2. Open belt.
3. `expect(getByRole("button", { name: "Install App" })).toBeVisible()`; icon `getByRole("img", { name: "Browser Updated" })` visible.

**Expects:** button + ⬇️ icon visible; other 4 unaffected. Also `expect(page.evaluate(() => (window as any).__promptCalled)).resolves.toBeUndefined()` — prompt not yet invoked.

### IA-03: Tap → prompt() stub called + belt collapses

**Steps:**
1. Mock + open belt (per IA-02).
2. `await page.getByRole("button", { name: "Install App" }).click()`.
3. `await expect.poll(() => page.evaluate(() => (window as any).__promptCalled)).toBe(true)` (10 ms stub timer — never assert synchronously after click).
4. `expect(belt(page)).not.toBeChecked()` — belt collapsed via `MenuActionButton` (DESIGN §5.2).
5. Optional hardening: `await expect.poll(() => page.evaluate(() => (window as any).__installChoice)).toBe("accepted")`.

**Expects:** prompt invoked exactly once, belt closed, no dialog (`getByRole("dialog")` count 0 — native prompt is stubbed, nothing modal opens).

### IA-04: After tap → button removed (single-use clear)

**Steps:**
1. Mock + open belt; click Install App; wait `__promptCalled` true (per IA-03).
2. `expect(getByRole("button", { name: "Install App" })).toHaveCount(0)`.
3. Reopen belt via M logo; `expect(...).toHaveCount(0)` again — state cleared, not just belt-collapse hiding.

**Expects:** button gone after the single use; re-open does not resurrect it (`setInstallPrompt(null)` persists).

### IA-05: appinstalled event → button removed

**Steps:**
1. Mock + open belt; Install App visible.
2. `await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));`
3. `expect(getByRole("button", { name: "Install App" })).toHaveCount(0)`.
4. Reopen belt; count 0 again.

**Expects:** `appinstalled` clears the stored prompt (SPEC §8.6). Other 4 buttons still render on reopen.

### IA-06: Standalone display-mode → icon hidden even with event mocked

**Steps:**
1. Create CDP session BEFORE navigation: `const cdp = await page.context().newCDPSession(page); await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "display-mode", value: "standalone" }] });`
2. `goto("/")`; wait hydration; `mockInstallPrompt(page)`; open belt.
3. `expect(page.getByRole("img", { name: "Browser Updated" })).toBeHidden()` — `pwa:hidden` span is `display:none`.
4. Other 4 buttons still visible (belt layout intact).

**Expects:** ⬇️ icon hidden via the `pwa:` media-query variant. NOTE (contract deviation 1): the `button[aria-label="Install App"]` element itself REMAINS (empty, clickable, in a11y tree) — do NOT assert `toHaveCount(0)` here; assert the icon. If the CDP approach proves flaky in a run, switch to `page.addInitScript(() => { const mq = window.matchMedia("(display-mode: standalone)"); mq.matches = true; })` — override BEFORE navigation and re-run; note the chosen technique in the test comment.

### IA-07: Belt opens/closes normally with 5-icon layout

**Steps:**
1. `goto("/")`; wait hydration; `mockInstallPrompt(page)`; open belt.
2. All 5 visible (Install App, Initial Life, Restart Life, AI Judge, Players).
3. Optional ordering check: `const xInstall = (await page.getByRole("button", { name: "Install App" }).boundingBox())!.x;` `const xSetLife = ..."Initial Life"...x;` — expect `xInstall < xSetLife` (Install far-left, DESIGN §5.2 far position).
4. Close via M logo; all 5 count-0.
5. Reopen; all 5 visible again.

**Expects:** 5-icon belt toggles cleanly; mock survives reopen (component never unmounts — belt is CSS-only).

---

## C. Update `specs/qa-modals.md` (check done — it documents the 4-icon belt)

Suite 2 (Spellbook Belt §5) documents the old 4-icon layout. Update:

- **TC-2.1**: retitle "M logo opens belt with 5 icons". Step 2 list: add ⬇️ Install App. Expected results: "5 icon buttons visible" — Left side (near→far): ⟳ Restart Life, ⚙️ Initial Life, ⬇️ Install App (renders only after `beforeinstallprompt` — installability gate SPEC §8.6; in browsers without the event, 4 icons, Install App absent by design). Right side unchanged.
- **TC-2.2**: "5 icon buttons no longer visible".
- **TC-2.4**: add `Install App button: aria-label="Install App"` with the same installability-gate caveat.
- Add one line under Suite 2 intro noting the gate: manual verification of Install App requires a browser that fires `beforeinstallprompt` (Chrome/Edge desktop; not iOS Safari), else the icon is correctly absent.

---

## Success Criteria

- All 4 updated belt TCs (TC-2.1..2.4) pass against prod build, existing assertions untouched (no regression on the 4 original icons).
- All 7 new TCs (IA-01..07) pass on fresh contexts, zero order coupling.
- IA-01 proves the SPEC §8.6 gate; IA-02..04 prove render → prompt → single-use clear lifecycle; IA-05 proves `appinstalled` removal; IA-06 proves standalone hiding; IA-07 proves the 5-icon layout toggles normally.
- `specs/qa-modals.md` no longer documents a 4-icon belt.
- `pnpm lint` green (test files outside `features/**/state/**` — no state-spaghetti scope impact; no new deps).

## Failure Conditions / Triage

| Failure | Most likely cause | Action |
|---|---|---|
| IA-01: Install App visible without mock | Gate broken — `beforeinstallprompt` listener not registered, or `InstallAppAction` renders unconditionally | Review `InstallAppAction.tsx` useEffect + render gate |
| IA-02/07 / belt-spec additions: button missing AFTER mock | Mock dispatched before listener registered (hydration race) — or dev-server HMR second load wiped state | Move mock after `+1 life` hydration wait; run prod build (`pnpm build && pnpm start`) |
| IA-02: mock dispatched but `preventDefault` path unaffected | Event constructed without `{ cancelable: true }` | Check mock construction; cancelable flag required (handler calls `preventDefault()`) |
| IA-03: `__promptCalled` never true | Click landed on wrong element / button not hydrated / stub not attached (prompt assignment failed) | Verify `aria-label="Install App"` locator; log `window.__promptCalled` in `page.evaluate`; ensure belt actually open (checkbox checked) before click |
| IA-03: `__promptCalled` true but belt still checked | `MenuActionButton` collapse regression — `#spellbook-toggle` not unchecked | Review `MenuActionButton.handleClick` |
| IA-04: button still present after tap | `handleInstall` not clearing state (e.g. `userChoice` never settles if a real prompt object is stored — irrelevant with stub, but check stub shape) | Ensure stub `prompt()` resolves; verify `setInstallPrompt(null)` after `await userChoice` |
| IA-05: button present after `appinstalled` | `appinstalled` listener missing/removed in `InstallAppAction` | Review listener registration + cleanup |
| IA-06: icon still visible in standalone | CDP `setEmulatedMedia` not applied (session created after navigation, or feature name typo) | Move `newCDPSession` before `goto`; exact feature name `display-mode`; fallback `addInitScript` matchMedia override |
| IA-06: `pwa:hidden` class absent from compiled CSS | `@custom-variant pwa` missing/misnamed in `app/globals.css` | Verify `@custom-variant pwa (@media (display-mode: standalone))` present |
| TC-2.1..2.4 additions fail while original 4 pass | Mock race (above) — additions are the only mock-dependent lines | Same hydration-wait/prod-build fix |

## Files

- **Modified:** `tests/e2e/spellbook-belt.spec.ts` (TC-2.1..2.4 + `mockInstallPrompt` helper), `specs/qa-modals.md` (Suite 2 count/aria updates)
- **New:** `tests/e2e/install-app.spec.ts` (describe "Install App action", IA-01..07)
- **Reference only:** `features/spellbook/components/menu-actions/InstallAppAction.tsx`, `SpellbookMenu.tsx`, `MenuActionButton.tsx`, `app/globals.css` (line 63), `shared/components/icons/BrowserUpdated.tsx`
