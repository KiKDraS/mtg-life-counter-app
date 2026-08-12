// spec: specs/qa-modals.md
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
 * useEffect (post-hydration); a mocked beforeinstallprompt dispatched earlier
 * is lost. Run against the prod build (dev HMR second load wipes mocks).
 */
async function waitHydrated(page: Page): Promise<void> {
  await page.getByRole("button", { name: "+1 life" }).first().waitFor();
}

/**
 * Dispatch a mocked beforeinstallprompt + spy stubs. Without it the Install
 * App button does not render at all (installability gate, SPEC §8.6) — the
 * mock must precede the belt open for "visible" assertions to be meaningful.
 * The prompt stub resolves after 10 ms — poll, never assert synchronously.
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

/* ───────────────────────────────────────────────
 * §2 — Spellbook Belt
 * ─────────────────────────────────────────────── */

test.describe("Spellbook Belt — Open/Close & ARIA", () => {
  test("TC-2.1: M logo opens belt with 5 icons", async ({ page }) => {
    // 1. Navigate to /; wait hydration; mock beforeinstallprompt
    // (Install App renders only after the event — SPEC §8.6 gate)
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);

    // expect: Belt icons not visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Initial Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI Judge" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Players" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Install App" })).toHaveCount(0);

    // 2. Tap M logo to open belt
    await page.getByLabel("Open Spellbook Menu").click();

    // expect: Checkbox is checked
    await expect(belt(page)).toBeChecked();

    // expect: 5 icon buttons visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();
  });

  test("TC-2.2: M logo collapses belt", async ({ page }) => {
    // 1. Open belt (mock beforeinstallprompt first — Install App gate §8.6)
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();

    // 2. Tap M logo again
    await page.getByLabel("Open Spellbook Menu").click();

    // expect: Checkbox is unchecked
    await expect(belt(page)).not.toBeChecked();

    // expect: 5 icon buttons no longer visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Initial Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI Judge" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Players" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Install App" })).toHaveCount(0);
  });

  test("TC-2.3: Click outside belt collapses it", async ({ page }) => {
    // 1. Open belt via M logo (mock beforeinstallprompt first — §8.6 gate)
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();

    // 2. Click the invisible overlay label that covers the screen (Close menu)
    // The overlay is a <label for="spellbook-toggle"> with aria-label="Close menu"
    // It has aria-hidden="true", so use CSS selector directly
    await page.locator('label[for="spellbook-toggle"][aria-label="Close menu"]').click({ force: true });

    // expect: Checkbox is unchecked
    await expect(belt(page)).not.toBeChecked();

    // expect: Belt icons no longer visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Initial Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI Judge" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Players" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Install App" })).toHaveCount(0);
  });

  test("TC-2.4: Belt icon ARIA labels correct", async ({ page }) => {
    // 1. Open belt (mock beforeinstallprompt first — §8.6 gate)
    await page.goto("/");
    await waitHydrated(page);
    await mockInstallPrompt(page);
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();

    // 2. Inspect each button's aria-label
    // getByRole with `name` matches the accessible name computed from aria-label
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Install App" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Install App" })).toHaveAttribute(
      "aria-label",
      "Install App",
    );
  });

  test("TC-2.5: Tapping Restart Life collapses the belt", async ({ page }) => {
    // 1. Open belt via M logo
    await page.goto("/");
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();

    // 2. Tap ⟳ Restart Life (no modal — instant action)
    await page.getByRole("button", { name: "Restart Life" }).click();

    // expect: Checkbox is unchecked (belt collapsed — DESIGN §5.2)
    await expect(belt(page)).not.toBeChecked();
    // expect: no dialog opened
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("TC-2.6: Tapping Initial Life collapses the belt", async ({ page }) => {
    // 1. Open belt via M logo
    await page.goto("/");
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();

    // 2. Tap ⚙️ Initial Life
    await page.getByRole("button", { name: "Initial Life" }).click();

    // expect: Checkbox is unchecked (belt collapsed — DESIGN §5.2)
    await expect(belt(page)).not.toBeChecked();
    // expect: modal opened
    await expect(page.locator("dialog#initial-life-modal")).toBeVisible();

    // 3. Close the modal via Escape before the next case
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog#initial-life-modal")).not.toBeVisible();
  });

  test("TC-2.7: Tapping AI Judge collapses the belt", async ({ page }) => {
    // 1. Open belt via M logo
    await page.goto("/");
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();

    // 2. Tap ⚖️ AI Judge
    await page.getByRole("button", { name: "AI Judge", exact: true }).click();

    // expect: Checkbox is unchecked (belt collapsed — DESIGN §5.2)
    await expect(belt(page)).not.toBeChecked();
    // expect: modal opened
    await expect(page.locator("#ai-judge-modal")).toBeVisible();

    // 3. Close the modal via Escape
    await page.keyboard.press("Escape");
    await expect(page.locator("#ai-judge-modal")).not.toBeVisible();
  });

  test("TC-2.8: Tapping Players collapses the belt", async ({ page }) => {
    // 1. Open belt via M logo
    await page.goto("/");
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();

    // 2. Tap 👥 Players
    await page.getByRole("button", { name: "Players" }).click();

    // expect: Checkbox is unchecked (belt collapsed — DESIGN §5.2)
    await expect(belt(page)).not.toBeChecked();
    // expect: modal opened
    await expect(page.locator("dialog#player-selector-modal")).toBeVisible();

    // 3. Close the modal via Escape
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
  });
});
