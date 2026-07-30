// spec: specs/qa-modals.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers ── */

function zone(page: Page, n: number): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function colorPickerDialog(page: Page, playerId: number): Locator {
  return page.locator(`dialog[id="color-picker-${playerId}"]`);
}

/* ───────────────────────────────────────────────
 * §6 — Color Picker
 * ─────────────────────────────────────────────── */

test.describe("Color Picker", () => {
  test("TC-6.1: Gear icon opens color picker dialog", async ({ page }) => {
    // 1. Navigate to /
    await page.goto("/");

    // 2. Tap gear icon on Player 1 zone
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();

    // expect: Native dialog opens with id="color-picker-0"
    const dialog = colorPickerDialog(page, 0);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("aria-labelledby", "color-picker-title");
  });

  test("TC-6.2: WUBRG wheel renders 5 mana symbols", async ({ page }) => {
    // 1. Open Color Picker for Player 1
    await page.goto("/");
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog = colorPickerDialog(page, 0);

    // expect: 5 mana symbol buttons visible
    await expect(dialog.getByRole("button", { name: "White mana" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Blue mana" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Black mana" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Red mana" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Green mana" })).toBeVisible();

    // expect: Bottom filter strip with WUBRG and Colorless
    await expect(dialog.getByRole("button", { name: "WUBRG colors" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Colorless mana" })).toBeVisible();
  });

  test("TC-6.3: Tap mana color closes dialog updates zone", async ({ page }) => {
    // 1. Open Color Picker for Player 1
    await page.goto("/");
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();

    // 2. Tap Red mana symbol
    await page.getByRole("button", { name: "Red mana" }).first().click();

    // expect: Dialog closes immediately
    await expect(colorPickerDialog(page, 0)).not.toBeVisible();

    // expect: Player 1 zone background changes to red (#E49977)
    await expect(zone(page, 1)).toHaveCSS("background-color", "rgb(228, 153, 119)");

    // 3. Open Color Picker for Player 1 again
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();

    // 4. Tap Blue mana symbol
    await page.getByRole("button", { name: "Blue mana" }).first().click();

    // expect: Dialog closes
    await expect(colorPickerDialog(page, 0)).not.toBeVisible();

    // expect: Player 1 zone changes to blue (#C1D7E9)
    await expect(zone(page, 1)).toHaveCSS("background-color", "rgb(193, 215, 233)");
  });

  test("TC-6.4: WUBRG and Colorless actions work", async ({ page }) => {
    // 1. Open Color Picker for Player 2
    await page.goto("/");
    await zone(page, 2).getByRole("button", { name: "Change color" }).click();

    // 2. Tap WUBRG action button
    // There are 2 WUBRG buttons (one per player dialog), pick the last-opened one
    await page.getByRole("button", { name: "WUBRG colors" }).last().click();

    // expect: Dialog closes
    await expect(colorPickerDialog(page, 1)).not.toBeVisible();

    // expect: Player 2 zone background is no longer default red
    // WUBRG gradient won't match a single color, so checking it changed
    const p2Bg = await zone(page, 2).evaluate((el) => getComputedStyle(el).background);
    expect(p2Bg).not.toBe("rgb(228, 153, 119)");

    // 3. Open Color Picker for Player 2 again
    await zone(page, 2).getByRole("button", { name: "Change color" }).click();

    // 4. Tap Colorless action button
    await page.getByRole("button", { name: "Colorless mana" }).last().click();

    // expect: Dialog closes
    await expect(colorPickerDialog(page, 1)).not.toBeVisible();

    // expect: Player 2 zone changes to colorless (#CAC5C0)
    await expect(zone(page, 2)).toHaveCSS("background-color", "rgb(202, 197, 192)");
  });

  test("TC-6.5: Escape closes without change", async ({ page }) => {
    // 1. Set Player 1 to Red first
    await page.goto("/");
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    await page.getByRole("button", { name: "Red mana" }).first().click();
    await expect(zone(page, 1)).toHaveCSS("background-color", "rgb(228, 153, 119)");

    // 2. Open Color Picker for Player 1
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    await expect(colorPickerDialog(page, 0)).toBeVisible();

    // 3. Press Escape
    await page.keyboard.press("Escape");

    // expect: Dialog closes
    await expect(colorPickerDialog(page, 0)).not.toBeVisible();

    // expect: Player 1 remains Red (no change)
    await expect(zone(page, 1)).toHaveCSS("background-color", "rgb(228, 153, 119)");
  });
});
