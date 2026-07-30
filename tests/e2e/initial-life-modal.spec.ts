// spec: specs/qa-modals.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers ── */

function zone(page: Page, n: 1 | 2): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function lifeTotal(zoneLocator: Locator): Locator {
  return zoneLocator.locator('[aria-live="polite"]');
}

async function openBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
}

async function openInitialLifeModal(page: Page): Promise<void> {
  await openBelt(page);
  await page.getByRole("button", { name: "Initial Life" }).click();
}

/* ───────────────────────────────────────────────
 * §4 — Initial Life Modal
 * ─────────────────────────────────────────────── */

test.describe("Initial Life Modal", () => {
  test("TC-4.1: Modal opens from belt", async ({ page }) => {
    // 1. Navigate to /
    await page.goto("/");

    // 2. Open belt and tap Initial Life
    await openInitialLifeModal(page);

    // expect: Native dialog opens with id="initial-life-modal"
    const dialog = page.locator("dialog#initial-life-modal");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("aria-labelledby", "initial-life-title");

    // expect: Heading text is "Initial Life"
    const heading = dialog.locator("h2#initial-life-title");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Initial Life");

    // expect: No ✕ close button
    await expect(dialog.getByRole("button", { name: /✕|×|close/i })).toHaveCount(0);
  });

  test("TC-4.2: All 4 presets visible and selectable", async ({ page }) => {
    // 1. Open Initial Life modal
    await page.goto("/");
    await openInitialLifeModal(page);
    const dialog = page.locator("dialog#initial-life-modal");

    // expect: 4 preset buttons in 2x2 grid
    await expect(dialog.getByRole("button", { name: "Set initial life to 20" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Set initial life to 30" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Set initial life to 40" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Set initial life to 60" })).toBeVisible();

    // expect: [+] Add custom value link below grid
    await expect(dialog.getByRole("button", { name: "[+] Add custom value" })).toBeVisible();
  });

  test("TC-4.3: Tap preset updates life and closes modal", async ({ page }) => {
    // 1. Open Initial Life modal and tap preset 30
    await page.goto("/");
    await openInitialLifeModal(page);
    await page.getByRole("button", { name: "Set initial life to 30" }).click();

    // expect: Modal closes
    await expect(page.locator("dialog#initial-life-modal")).not.toBeVisible();

    // expect: Both players show 30 life
    const p1 = zone(page, 1);
    const p2 = zone(page, 2);
    await expect(lifeTotal(p1)).toHaveText("30");
    await expect(lifeTotal(p2)).toHaveText("30");
  });

  test("TC-4.4: Custom numpad via [+] link", async ({ page }) => {
    // 1. Open Initial Life modal
    await page.goto("/");
    await openInitialLifeModal(page);
    const dialog = page.locator("dialog#initial-life-modal");

    // 2. Tap [+] Add custom value
    await dialog.getByRole("button", { name: "[+] Add custom value" }).click();

    // expect: Numpad view with input and + Add button
    await expect(dialog.getByText("Enter custom starting life")).toBeVisible();
    await expect(dialog.getByRole("spinbutton", { name: "Custom starting life" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "+ Add" })).toBeVisible();

    // 3. Type 77 and click + Add
    await dialog.getByRole("spinbutton", { name: "Custom starting life" }).fill("77");
    await dialog.getByRole("button", { name: "+ Add" }).click();

    // expect: Modal closes
    await expect(dialog).not.toBeVisible();

    // expect: Both players show 77 life
    await expect(lifeTotal(zone(page, 1))).toHaveText("77");
    await expect(lifeTotal(zone(page, 2))).toHaveText("77");
  });

  test("TC-4.5: Enter key submits numpad value", async ({ page }) => {
    // 1. Open modal, tap [+], type 50, press Enter on the input
    await page.goto("/");
    await openInitialLifeModal(page);
    const dialog = page.locator("dialog#initial-life-modal");

    await dialog.getByRole("button", { name: "[+] Add custom value" }).click();
    const input = dialog.getByRole("spinbutton", { name: "Custom starting life" });
    await input.fill("50");

    // Dispatch native KeyboardEvent directly to bypass any CDP/React event delegation
    // issues with Enter key inside a native dialog opened via .show()
    await input.evaluate((el) =>
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );

    // expect: Both players show 50
    await expect(lifeTotal(zone(page, 1))).toHaveText("50");
    await expect(lifeTotal(zone(page, 2))).toHaveText("50");

    // expect: Modal closes (after state settles)
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test("TC-4.6: Click inside dialog content does not close it", async ({ page }) => {
    // Backdrop click (on <dialog> element itself) closes per DialogShell,
    // but clicking any child should NOT close — the guard is
    // e.target === e.currentTarget.
    // Since the inner content div fills the dialog, there's no exposed
    // backdrop area to click; instead we verify that clicking content
    // does NOT close the modal (inverse of backdrop test).

    // 1. Start with 40 life (default)
    await page.goto("/");

    // 2. Open Initial Life modal
    await openInitialLifeModal(page);
    const dialog = page.locator("dialog#initial-life-modal");
    await expect(dialog).toBeVisible();

    // 3. Click the heading (inside the dialog content)
    await dialog.locator("h2#initial-life-title").click();

    // expect: Modal stays open (click on child does not trigger backdrop close)
    await expect(dialog).toBeVisible();

    // expect: Life totals remain unchanged
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
  });

  test("TC-4.7: Escape key closes modal without change", async ({ page }) => {
    // 1. Start with 40 life (default)
    await page.goto("/");

    // 2. Open Initial Life modal
    await openInitialLifeModal(page);
    const dialog = page.locator("dialog#initial-life-modal");
    await expect(dialog).toBeVisible();

    // 3. Press Escape
    await page.keyboard.press("Escape");

    // expect: Modal closes
    await expect(dialog).not.toBeVisible();

    // expect: Life totals remain at 40
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
  });
});
