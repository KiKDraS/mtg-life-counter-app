// spec: specs/install-app.plan.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

function belt(page: Page): Locator {
  return page.locator("#spellbook-toggle");
}

async function openBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).toBeChecked();
}

async function closeViaLogo(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).not.toBeChecked();
}

/**
 * Wait for hydration: InstallAppAction registers its window listeners in a
 * useEffect (post-hydration). A mocked beforeinstallprompt dispatched earlier
 * is lost (dev HMR wipes mocks too — run against the prod build).
 */
async function waitHydrated(page: Page): Promise<void> {
  await page.getByRole("button", { name: "+1 life" }).first().waitFor();
}

/**
 * Dispatch a mocked beforeinstallprompt + spy stubs. Event instances are
 * extensible in V8, so assigning `prompt` works; the handler calls
 * preventDefault(), hence `cancelable: true`. The stub resolves after 10 ms —
 * never assert __promptCalled synchronously after a click.
 */
async function mockInstallPrompt(page: Page): Promise<void> {
  await page.evaluate(() => {
    const ev = new Event("beforeinstallprompt", {
      cancelable: true,
    }) as Event & { prompt: () => Promise<void> };
    ev.prompt = () =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          (window as unknown as Record<string, unknown>).__installChoice =
            "accepted";
          (window as unknown as Record<string, unknown>).__promptCalled = true;
          resolve();
        }, 10),
      );
    window.dispatchEvent(ev);
  });
}

async function readFlag(
  page: Page,
  key: "__promptCalled" | "__installChoice",
): Promise<unknown> {
  return page.evaluate(
    (k) => (window as unknown as Record<string, unknown>)[k],
    key,
  );
}

function expectButtonGone(page: Page) {
  return expect(
    page.getByRole("button", { name: "Install App" }),
  ).toHaveCount(0);
}

/* ───────────────────────────────────────────────
 * Install App action (SPEC §8.6, DESIGN §5.2)
 * ─────────────────────────────────────────────── */

test.describe("Install App action", () => {
  test("IA-01: No beforeinstallprompt event → Install App button absent (gate)", async ({
    page,
  }) => {
    // 1. Navigate to /; wait hydration. NO mock — gate must keep button absent.
    await page.goto("/");
    await waitHydrated(page);

    // 2. Open belt
    await openBelt(page);

    // expect: Install App absent with belt OPEN (proves the §8.6 gate,
    // not belt-collapse hiding)
    await expectButtonGone(page);

    // expect (sanity): belt renders normally — the other 4 buttons visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });

  test("IA-02: Mocked beforeinstallprompt → button visible", async ({ page }) => {
    // 1. Navigate to /; wait hydration; mock the event (must precede belt open)
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);

    // 2. Open belt
    await openBelt(page);

    // expect: Install App button + ⬇️ icon visible
    await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Browser Updated" })).toBeVisible();

    // expect: prompt NOT yet invoked
    await expect.poll(() => readFlag(page, "__promptCalled")).toBeUndefined();

    // expect: other 4 buttons unaffected
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });

  test("IA-03: Tap → prompt() stub called + belt collapses", async ({ page }) => {
    // 1. Mock + open belt (per IA-02)
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);
    await openBelt(page);

    // 2. Tap Install App
    await page.getByRole("button", { name: "Install App" }).click();

    // expect: prompt stub invoked (10 ms timer — poll, never assert sync)
    await expect.poll(() => readFlag(page, "__promptCalled")).toBe(true);

    // expect: belt collapsed via MenuActionButton (DESIGN §5.2)
    await expect(belt(page)).not.toBeChecked();

    // expect: prompt resolved as accepted (hardening)
    await expect.poll(() => readFlag(page, "__installChoice")).toBe("accepted");

    // expect: no dialog — native prompt is stubbed, nothing modal opens
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("IA-04: After tap → button removed (single-use clear)", async ({ page }) => {
    // 1. Mock + open belt; tap Install App; wait for the stub (per IA-03)
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);
    await openBelt(page);
    await page.getByRole("button", { name: "Install App" }).click();
    await expect.poll(() => readFlag(page, "__promptCalled")).toBe(true);

    // expect: button gone after the single use
    await expectButtonGone(page);

    // 3. Reopen belt — state cleared (setInstallPrompt(null)), not belt hiding
    await openBelt(page);
    await expectButtonGone(page);
  });

  test("IA-05: appinstalled event → button removed", async ({ page }) => {
    // 1. Mock + open belt; Install App visible
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);
    await openBelt(page);
    await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();

    // 2. Dispatch appinstalled
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));

    // expect: stored prompt cleared — button gone (SPEC §8.6).
    // Belt stays OPEN — appinstalled does not collapse it (only MenuActionButton
    // taps do). So close, then reopen, to prove state cleared vs belt hiding.
    await expectButtonGone(page);

    // 3. Close belt, then reopen: still gone, but the other 4 buttons render
    await closeViaLogo(page);
    await openBelt(page);
    await expectButtonGone(page);
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });

  test("IA-06: Standalone display-mode → Install App hidden even with event mocked", async ({
    page,
  }) => {
    // Chromium ≥~M130 REMOVED display-mode media emulation: both
    // Emulation.setEmulatedMedia({features:[{name:"display-mode",...}]}) and
    // Playwright page.emulateMedia({displayMode}) are silent no-ops
    // (matchMedia stays false; protocol.d.ts marks it deprecated). The JS
    // matchMedia stub cannot drive the CSS engine, and the pwa:hidden rule is
    // pure CSS — so the real media-query flip is untestable in this browser.
    // Verify the SPEC §8.6 standalone contract at the CSS level instead:
    // (a) the wrapper div carrying pwa:hidden wraps the whole button,
    // (b) the served stylesheet contains @media (display-mode:standalone)
    //     → .pwa\:hidden { display:none }.
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);
    await openBelt(page);

    // expect: button rendered (mock works — sanity before contract checks)
    await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();

    // (a) hiding attaches to the button's wrapper, not just the ⬇️ icon
    await expect(
      page.locator("div.pwa\\:hidden", {
        has: page.getByRole("button", { name: "Install App" }),
      }),
    ).toHaveCount(1);

    // (b) served CSS carries the standalone media rule
    const hrefs = await page
      .locator('head link[rel="stylesheet"]')
      .evaluateAll((links) =>
        links.map((l) => (l as HTMLLinkElement).href),
      );
    expect(hrefs.length).toBeGreaterThan(0);
    const css = (
      await Promise.all(
        hrefs.map(async (href) => (await page.request.get(href)).text()),
      )
    ).join("\n");
    expect(css).toMatch(
      /@media\s*\(display-mode:\s*standalone\)\s*\{\s*\.pwa\\:hidden\s*\{\s*display:\s*none\s*\}\s*\}/,
    );

    // expect: belt layout intact — other 4 buttons still visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });

  test("IA-07: Belt opens/closes normally with 5-icon layout", async ({ page }) => {
    // 1. Navigate; wait hydration; mock; open belt
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);
    await openBelt(page);

    // expect: all 5 buttons visible
    await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();

    // expect (ordering, DESIGN §5.2): Install App far-left of Initial Life
    const xInstall = (await page.getByRole("button", { name: "Install App" }).boundingBox())!.x;
    const xSetLife = (await page.getByRole("button", { name: "Initial Life" }).boundingBox())!.x;
    expect(xInstall).toBeLessThan(xSetLife);

    // 4. Close via M logo — all 5 gone
    await closeViaLogo(page);
    await expect(page.getByRole("button", { name: "Install App" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Initial Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Restart Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI Judge" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Players" })).toHaveCount(0);

    // 5. Reopen — all 5 visible again (component never unmounts; belt is CSS-only)
    await openBelt(page);
    await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });
});
