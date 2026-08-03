// spec: specs/qa-modals.md Suite 6 (behavior per SPEC.md §8.5.1 — spec trumps plan)
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers ── */

function zone(page: Page, n: number): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function colorPickerDialog(page: Page, playerId: number): Locator {
  return page.locator(`dialog[id="color-picker-${playerId}"]`);
}

/** Read a player zone's effective background (handles gradient or solid). */
async function zoneBackground(page: Page, n: number): Promise<string> {
  // The <section role="region"> carries the zone's `background` style directly.
  return zone(page, n).evaluate((el) => {
    const style = getComputedStyle(el);
    return `${style.backgroundImage} | ${style.backgroundColor}`;
  });
}

/* ───────────────────────────────────────────────
 * §6 — Color Picker (per SPEC.md §8.5.1)
 * ───────────────────────────────────────────────
 */

test.describe("Color Picker", () => {
  test("TC-6.1: Gear icon opens color picker dialog", async ({ page }) => {
    await page.goto("/");

    await zone(page, 1).getByRole("button", { name: "Change color" }).click();

    const dialog = colorPickerDialog(page, 0);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute(
      "aria-labelledby",
      "color-picker-title",
    );
  });

  test("TC-6.2: Circular wheel renders 6 mana symbols + CheckCircle, default Red pressed", async ({
    page,
  }) => {
    await page.goto("/");
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog = colorPickerDialog(page, 0);

    // 6 mana symbol buttons visible clockwise from top: C, W, U, B, R, G
    await expect(
      dialog.getByRole("button", { name: "Colorless mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Blue mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Black mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Green mana" }),
    ).toBeVisible();

    // CheckCircle ✓ centered (§6.5)
    await expect(
      dialog.getByRole("button", { name: "Confirm color" }),
    ).toBeVisible();

    // No WUBRG filter-strip action button (old 80/20 layout gone)
    await expect(
      dialog.getByRole("button", { name: "WUBRG colors" }),
    ).toHaveCount(0);

    // Default ["r"] — Red aria-pressed=true; WUBRG siblings false
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Blue mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Black mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Green mana" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("TC-6.3: Multi-select — replace default, add non-default, remove multi, NO-OP last", async ({
    page,
  }) => {
    await page.goto("/");

    // Sanity: default Player 1 zone is red (#E49977)
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(228, 153, 119)");

    // Open Color Picker for Player 1
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog = colorPickerDialog(page, 0);

    const tap = (name: string) =>
      page.getByRole("button", { name: name }).first().click();

    // 1. Tap White: unselected + default (["r"]) → REPLACE → ["w"]
    await tap("White mana");
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(dialog).toBeVisible(); // dialog stays open
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(248, 246, 216)"); // #F8F6D8 — solid white

    // 2. Tap Blue: unselected + non-default (["w"]) → ADD → ["w","u"]
    await tap("Blue mana");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "Blue mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => zoneBackground(page, 1)).toContain("gradient");

    // 3. Tap Blue again: selected + multi → REMOVE → ["w"]
    await tap("Blue mana");
    await expect(
      dialog.getByRole("button", { name: "Blue mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(248, 246, 216)"); // back to solid white

    // 4. Tap White again: selected + length 1 → NO-OP (cannot remove last)
    await tap("White mana");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(248, 246, 216)"); // unchanged

    // 5. Tap Green: unselected + non-default single (["w"]) → ADD → ["w","g"]
    await tap("Green mana");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "Green mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => zoneBackground(page, 1)).toContain("gradient");

    // 6. Tap White: selected + multi → REMOVE → ["g"] solid green
    await tap("White mana");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Green mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(163, 192, 149)"); // #A3C095 — solid green
  });

  test("TC-6.4: Colorless closes immediately, CheckCircle closes without dispatch", async ({
    page,
  }) => {
    await page.goto("/");

    // Player 1 — Colorless dispatches ["c"] and closes immediately
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog0 = colorPickerDialog(page, 0);
    await page
      .getByRole("button", { name: "Colorless mana" })
      .first()
      .click();
    await expect(dialog0).not.toBeVisible();
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(202, 197, 192)"); // #CAC5C0 — solid colorless

    // Player 2 — White (toggle, dialog stays open) then ✓ close (no resetBehavior)
    await zone(page, 2).getByRole("button", { name: "Change color" }).click();
    const dialog1 = colorPickerDialog(page, 1);
    await expect(dialog1).toBeVisible();

    await page.getByRole("button", { name: "White mana" }).first().click();
    await expect(dialog1).toBeVisible(); // toggle does NOT close
    await expect
      .poll(() => zoneBackground(page, 2))
      .toContain("rgb(248, 246, 216)"); // white applied live

    await dialog1.getByRole("button", { name: "Confirm color" }).click();
    await expect(dialog1).not.toBeVisible();
    // Color stays white — Confirm closes only, no dispatch per §8.5.1
    await expect
      .poll(() => zoneBackground(page, 2))
      .toContain("rgb(248, 246, 216)");
  });

  test("TC-6.5: Backdrop/Escape closes — colors already applied (no revert)", async ({
    page,
  }) => {
    await page.goto("/");

    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog = colorPickerDialog(page, 0);

    // Tap Blue: REPLACE from ["r"] → ["b"], goes live, dialog stays open
    await page.getByRole("button", { name: "Blue mana" }).first().click();
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(193, 215, 233)"); // #C1D7E9 — solid blue

    // Escape closes; color persists (WYSIWYG — no revert)
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(193, 215, 233)");
  });
});