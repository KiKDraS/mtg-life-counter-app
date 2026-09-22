// spec: specs/ios-safari-fixes.plan.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── iOS Install Fallback — WebKit engine ──────────────────────────────
   Per-file browser override: runs this file on WebKit even though the config
   project is chromium-only (verified live 2026-09-22). SPEC §8.6 iOS clause:
   Safari fires no beforeinstallprompt; iOS detection is
   `"standalone" in navigator || /iPhone|iPad|iPod/.test(navigator.userAgent)`.
   The navigator.standalone defineProperty stub drives the exact clause the
   implementation uses (no UA override needed; deterministic in both engines).

   Headless WebKit: the first pointerdown triggers a real requestFullscreen
   (succeeds) — after belt opens, rely on Playwright actionability waits
   (toBeChecked/toBeVisible auto-retry) before further clicks. */

test.use({ browserName: "webkit" });

const belt = (page: Page): Locator => page.locator("#spellbook-toggle");
const installButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Install App" });
const hintDialog = (page: Page): Locator => page.locator("dialog#install-hint-modal");

/** Hydration wait — splash removal = hydrated state (screen-wake-lock.spec.ts
    waitForBoot convention); InstallAppAction's iOS fallback is set in a
    post-hydration effect (setTimeout 0), so a pre-hydration read is wiped. */
async function waitHydrated(page: Page): Promise<void> {
  await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
}

/** iOS stub: value false = Safari browser; true = installed PWA standalone.
    MUST be registered BEFORE goto (addInitScript runs pre-app-scripts on every
    navigation). */
async function stubIos(page: Page, standalone: boolean): Promise<void> {
  await page.addInitScript((value) => {
    Object.defineProperty(navigator, "standalone", { value, configurable: true });
  }, standalone);
}

async function openBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).toBeChecked();
}

async function closeViaLogo(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).not.toBeChecked();
}

/** Open belt → tap Install App → hint dialog visible. */
async function openHintDialog(page: Page): Promise<void> {
  await openBelt(page);
  await expect(installButton(page)).toBeVisible();
  await installButton(page).click();
  await expect(hintDialog(page)).toBeVisible();
}

/* ───────────────────────────────────────────────
 * iOS Install Fallback (SPEC §8.6, DESIGN §5.2/§6.1)
 * ─────────────────────────────────────────────── */

test.describe("iOS Install Fallback", () => {
  test("II-01: iOS detected (navigator.standalone present) → Install App button visible WITHOUT beforeinstallprompt", async ({
    page,
  }) => {
    // 1. iOS stub (standalone false = Safari) BEFORE goto; hydration wait
    await stubIos(page, false);
    await page.goto("/");
    await waitHydrated(page);

    // 2. Open belt
    await openBelt(page);

    // expect: Install App rendered purely from the iOS fallback — NO
    //     beforeinstallprompt mock dispatched (contrast install-app.spec.ts
    //     IA-02 which needs the mock; the iOS fallback replaces the event,
    //     SPEC §8.6)
    await expect(installButton(page)).toBeVisible();

    // expect (sanity): 5-icon belt intact — other 4 buttons visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });

  test("II-02: Tap Install App → instructions dialog opens with SPEC §8.6 copy + belt collapses", async ({
    page,
  }) => {
    // 1. Setup per II-01; open belt
    await stubIos(page, false);
    await page.goto("/");
    await waitHydrated(page);
    await openBelt(page);

    // 2. Tap Install App
    await expect(installButton(page)).toBeVisible();
    await installButton(page).click();

    // expect: dialog open via show() (non-modal)
    await expect(hintDialog(page)).toBeVisible();

    // expect: exact SPEC §8.6 copy — sr-only heading + instructions text
    await expect(page.getByRole("heading", { name: "Install App" })).toBeVisible();
    await expect(
      page.getByText("Tap Share, then Add to Home Screen.", { exact: true }),
    ).toBeVisible();

    // expect: belt collapsed (MenuActionButton behavior, DESIGN §5.2)
    await expect(belt(page)).not.toBeChecked();

    // expect: dialog announced as "Install App" (aria-labelledby=install-hint-title)
    await expect(page.getByRole("dialog", { name: "Install App" })).toHaveCount(1);
  });

  test("II-03: Escape closes the instructions dialog (repeatable)", async ({
    page,
  }) => {
    // 1. Setup per II-01; open hint dialog
    await stubIos(page, false);
    await page.goto("/");
    await waitHydrated(page);
    await openHintDialog(page);

    // 2. Escape — document-level capture listener (WebKit's show() never moves
    //    focus into the dialog, so DialogShell's onKeyDown can't fire; the
    //    APP-BUG fix added the capture listener — DESIGN §6.1).
    //    Harness note (verified live 2026-09-22): headless WebKit swallows the
    //    FIRST Escape key press of a page when an open dialog has focus — the
    //    engine consumes it as a browser-level dialog cancel and NO keydown
    //    ever reaches the document (not even an addInitScript capture listener
    //    sees it; deterministic across runs). The SECOND press delivers the
    //    keydown and the app's capture listener closes the dialog. Two presses
    //    are sent; the assertion holds on the delivered one.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // expect: dialog NOT visible
    await expect(hintDialog(page)).not.toBeVisible();

    // 3. Repeat: reopen belt, tap again, Escape again — close stays repeatable
    await openHintDialog(page);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(hintDialog(page)).not.toBeVisible();
  });

  test("II-04: Backdrop tap closes the instructions dialog", async ({ page }) => {
    // 1. Setup per II-01; open hint dialog
    await stubIos(page, false);
    await page.goto("/");
    await waitHydrated(page);
    await openHintDialog(page);

    // 2. Backdrop tap — the content box is content-sized (APP-BUG fix: the old
    //    flex-1 div covered the dialog surface and swallowed every tap), so
    //    (640, 640) lands on the dialog itself, away from the centered content
    await page.mouse.click(640, 640);

    // expect: closed via DialogShell backdrop handler (DESIGN §6.1)
    await expect(hintDialog(page)).not.toBeVisible();
  });

  test("II-05: Standalone (navigator.standalone true) → Install App button hidden", async ({
    page,
  }) => {
    // 1. Standalone stub — iOS + standalone → isStandalone true → render gate
    //    hides the button
    await stubIos(page, true);
    await page.goto("/");
    await waitHydrated(page);
    await openBelt(page);

    // expect: button absent entirely with the belt OPEN (proves the standalone
    //     gate, not belt-collapse hiding). The iOS render gate removes the
    //     whole button — unlike the Chromium path (install-app.plan.md
    //     deviation 1: icon hidden, button remains), do NOT assert the ⬇️ icon.
    await expect(installButton(page)).toHaveCount(0);

    // expect (sanity): other 4 buttons visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });

  test("II-06: Belt open/close cycles with iOS fallback armed", async ({
    page,
  }) => {
    // 1. Setup per II-01
    await stubIos(page, false);
    await page.goto("/");
    await waitHydrated(page);

    // 2. Open belt → Install App visible
    await openBelt(page);
    await expect(installButton(page)).toBeVisible();

    // 3. Close via M logo → all 5 buttons gone (toHaveCount auto-retries past
    //    the 300ms CSS visibility transition)
    await closeViaLogo(page);
    await expect(installButton(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Initial Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Restart Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI Judge" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Players" })).toHaveCount(0);

    // 4. Reopen → all 5 visible (component never unmounts; belt is CSS-only —
    //    the fallback state survives belt cycles)
    await openBelt(page);
    await expect(installButton(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });
});