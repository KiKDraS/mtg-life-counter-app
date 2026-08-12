// spec: specs/install-prompt.plan.md — install banner (DESIGN §4.5 / SPEC §4.7)
// seed: tests/seed.spec.ts
// Requires prod build (pnpm build && pnpm start) at http://localhost:3000.
// A real `beforeinstallprompt` never fires headless (installability +
// engagement), so every TC stashes a synthetic event via addInitScript and
// dispatches it after hydration (plan §synthetic events).

import { test, expect, type Page } from "@playwright/test";

const BANNER = '[data-testid="install-prompt"]';

/** Window bag for the synthetic-event globals the init script installs. */
type WinWithInstall = Window & {
  __installPromptEvent?: Event;
  __promptCalled?: boolean;
};

/**
 * Stash a synthetic `beforeinstallprompt` before app code runs (plan §TC1/2):
 * `prompt()` records `window.__promptCalled`, `userChoice` resolves
 * "accepted" — the same shape the component awaits in handleInstall.
 */
async function stashInstallPrompt(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const win = window as WinWithInstall;
    const e = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    e.prompt = async () => {
      win.__promptCalled = true;
    };
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    win.__installPromptEvent = e;
  });
}

/**
 * Wait for hydration (Player 1 zone renders only after the RSC shell
 * hydrates — by then the component effect has attached its listeners), then
 * dispatch the stashed event.
 */
async function dispatchInstallPrompt(page: Page): Promise<void> {
  await page
    .getByRole("region", { name: /^Player 1:/ })
    .waitFor({ timeout: 15_000 });
  await page.evaluate(() => {
    const win = window as WinWithInstall;
    if (win.__installPromptEvent) win.dispatchEvent(win.__installPromptEvent);
  });
}

/* ───────────────────────────────────────────────
 * Install prompt (TC1..7)
 * ─────────────────────────────────────────────── */

test.describe("Install prompt", () => {
  test("TC1: Shows on beforeinstallprompt — copy + Install App button", async ({
    page,
  }) => {
    await stashInstallPrompt(page);
    await page.goto("/");
    await dispatchInstallPrompt(page);

    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toContainText("Install MTG Life Counter");
    await expect(
      banner.getByRole("button", { name: "Install App" }),
    ).toBeVisible();
  });

  test("TC2: Install App click → prompt() called, banner hides", async ({
    page,
  }) => {
    await stashInstallPrompt(page);
    await page.goto("/");
    await dispatchInstallPrompt(page);

    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await banner.getByRole("button", { name: "Install App" }).click();

    // the app called the stashed event's prompt()
    expect(
      await page.evaluate(() => (window as WinWithInstall).__promptCalled),
    ).toBe(true);
    // and hid the banner after prompt()/userChoice resolved
    await expect(banner).toHaveCount(0);
  });

  test("TC3: appinstalled hides the banner", async ({ page }) => {
    await stashInstallPrompt(page);
    await page.goto("/");
    await dispatchInstallPrompt(page);

    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(banner).toHaveCount(0);
  });

  test("TC4: Dismiss ✕ → hidden for the session; fresh context shows again", async ({
    page,
    browser,
  }) => {
    await stashInstallPrompt(page);
    await page.goto("/");
    await dispatchInstallPrompt(page);

    const banner = page.locator(BANNER);
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await banner.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner).toHaveCount(0);
    // dismissal flag persisted
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("install-prompt-dismissed"),
      ),
    ).toBe("1");

    // reload — same context keeps sessionStorage → still hidden even if the
    // event fires again
    await page.reload();
    await page
      .getByRole("region", { name: /^Player 1:/ })
      .waitFor({ timeout: 15_000 });
    await page.evaluate(() => {
      const win = window as WinWithInstall;
      if (win.__installPromptEvent) win.dispatchEvent(win.__installPromptEvent);
    });
    await expect(banner).toHaveCount(0);

    // fresh context → the banner can show again
    const freshContext = await browser.newContext();
    try {
      const fresh = await freshContext.newPage();
      await stashInstallPrompt(fresh);
      await fresh.goto("/");
      await dispatchInstallPrompt(fresh);
      await expect(fresh.locator(BANNER)).toBeVisible({ timeout: 30_000 });
    } finally {
      await freshContext.close();
    }
  });

  test("TC5: No beforeinstallprompt → no banner", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: /^Player 1:/ })
      .waitFor({ timeout: 15_000 });
    // settle window for any (unexpected) auto-show — plan §TC5: wait 1-2s
    await page.waitForTimeout(2_000);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("TC6: Standalone gate — banner never renders", async ({ page }) => {
    // Force (display-mode: standalone) to match BEFORE app code runs; the
    // real matchMedia is kept for every other query.
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      const standalone = {
        matches: true,
        media: "(display-mode: standalone)",
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
      window.matchMedia = (query: string) =>
        query.includes("display-mode") ? standalone : original(query);
    });
    await stashInstallPrompt(page);
    await page.goto("/");
    await dispatchInstallPrompt(page);

    // even with the event fired, the standalone gate suppresses the banner;
    // the settle window lets a broken gate actually render
    await page.waitForTimeout(1_500);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test("TC7: iOS UA — hint copy, no Install App button, has Dismiss", async ({
    browser,
  }) => {
    // iOS Safari never fires beforeinstallprompt; the banner shows the
    // Share-sheet hint instead. iPhone UA over the chromium engine still
    // triggers the app's UA sniff (config: chromium-only project).
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    try {
      await page.goto("/");
      await page
        .getByRole("region", { name: /^Player 1:/ })
        .waitFor({ timeout: 15_000 });

      const banner = page.locator(BANNER);
      await expect(banner).toBeVisible({ timeout: 30_000 });
      await expect(banner).toContainText(
        "Install: Share → Add to Home Screen",
      );
      await expect(
        banner.getByRole("button", { name: "Install App" }),
      ).toHaveCount(0);
      await expect(
        banner.getByRole("button", { name: "Dismiss" }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
