// spec: specs/qa-modals.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers ── */

function belt(page: Page): Locator {
  return page.locator("#spellbook-toggle");
}

function zone(page: Page, n: number): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function lifeTotal(zoneLocator: Locator): Locator {
  return zoneLocator.locator('[aria-live="polite"]');
}

async function openBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).toBeChecked();
}

/**
 * Zone layout settles late (cqw/cqh container sizing + hydration remount), so
 * a single-shot `boundingBox()` can return null right after load. Poll until a
 * real box exists.
 */
async function visibleBox(locator: Locator): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const deadline = Date.now() + 10_000;
  let box = await locator.boundingBox();
  while (!box) {
    if (Date.now() > deadline) throw new Error("element not visible");
    await locator.page().waitForTimeout(100);
    box = await locator.boundingBox();
  }
  return box;
}

async function swipeOn(
  locator: Locator,
  direction: "left" | "right",
  distance = 50,
): Promise<void> {
  const box = await visibleBox(locator);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const targetX = direction === "left" ? cx - distance : cx + distance;
  const page = locator.page();
  // §4.6 splash cover is pointer-events:auto until hydration removes it — a
  // raw mouse.down on the overlay swallows the gesture. Wait it out first.
  await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(targetX, cy);
  await page.mouse.up();
}

/* ───────────────────────────────────────────────
 * §3 — Restart Life
 * ─────────────────────────────────────────────── */

test.describe("Restart Life", () => {
  test("TC-3.1: Restart resets life to initialLife", async ({ page }) => {
    // 1. Set initialLife to 30 via modal
    await page.goto("/");
    await openBelt(page);
    await page.getByRole("button", { name: "Initial Life" }).click();
    await page.getByRole("button", { name: "Set initial life to 30" }).click();

    // expect: Both players show 30
    await expect(lifeTotal(zone(page, 1))).toHaveText("30");
    await expect(lifeTotal(zone(page, 2))).toHaveText("30");

    // Belt auto-collapsed on the Initial Life tap (DESIGN §5.2) — no manual close needed

    // 2. Tap - on Player 1 three times
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    await p1Minus.click();
    await p1Minus.click();
    await p1Minus.click();

    // expect: P1=27, P2=30
    await expect(lifeTotal(zone(page, 1))).toHaveText("27");
    await expect(lifeTotal(zone(page, 2))).toHaveText("30");

    // 3. Tap Restart Life
    await openBelt(page);
    await page.getByRole("button", { name: "Restart Life" }).click();

    // expect: Both players show 30 (initialLife), no modal
    await expect(lifeTotal(zone(page, 1))).toHaveText("30");
    await expect(lifeTotal(zone(page, 2))).toHaveText("30");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("TC-3.2: Custom counters cleared after restart", async ({ page }) => {
    // 1. Set initialLife to 40
    await page.goto("/");

    // 2. Open Counters overlay for Player 1
    await swipeOn(zone(page, 1), "left");
    const countersDlg = page.getByRole("dialog", { name: "Counters" });
    await expect(countersDlg).toBeVisible();

    // 3. Verify 4 default counters visible
    for (const label of ["Poison counter", "Energy counter", "Experience counter", "Time counter"]) {
      await expect(countersDlg.getByRole("img", { name: label }).first()).toBeVisible();
    }

    // 4. Tap [+] to open custom counter modal, type "Lore", submit
    await countersDlg.getByRole("button", { name: "Add custom counter" }).click();
    const customDlg = page.getByRole("dialog", { name: "Custom Counter" });
    await expect(customDlg).toBeVisible();
    await customDlg.getByRole("textbox", { name: "Counter name" }).fill("Lore");
    await page.keyboard.press("Enter");

    // 5. Verify Lore appears in counters grid
    await expect(countersDlg).toBeVisible();
    const lorePill = countersDlg.locator('[aria-label="Lore counter"]');
    await expect(lorePill).toBeVisible();
    await expect(lorePill).toHaveText("L");

    // 6. Close overlay, open belt, tap Restart Life
    await page.keyboard.press("Escape");
    await expect(countersDlg).not.toBeVisible();

    await openBelt(page);
    await page.getByRole("button", { name: "Restart Life" }).click();

    // expect: Life totals reset to 40
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");

    // Belt auto-collapsed on the Restart Life tap (DESIGN §5.2) — no manual close needed

    // 7. Reopen Counters overlay for Player 1
    await swipeOn(zone(page, 1), "left");
    await expect(countersDlg).toBeVisible();

    // expect: Custom counter "Lore" absent
    await expect(countersDlg.locator('[aria-label="Lore counter"]')).toHaveCount(0);

    // expect: Only 4 default counters remain
    const counterRows = countersDlg.locator("div.grid > div");
    await expect(counterRows).toHaveCount(4);
  });

  test("TC-3.3: Player colors preserved after restart", async ({ page }) => {
    // 1. Open Color Picker for Player 1
    await page.goto("/");
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();

    // Select Red (R) mana symbol
    const colorPicker = page.locator(`dialog[id="color-picker-0"]`);
    await expect(colorPicker).toBeVisible();
    await colorPicker.getByRole("button", { name: "Red mana" }).click();

    // Red is the default §8.5.1 color — a color tap toggles selection but does
    // not close the picker (only ✓/Colorless/backdrop/Escape close). Confirm.
    await colorPicker.getByRole("button", { name: "Confirm color" }).click();

    // expect: P1 zone background changes to red
    await expect(colorPicker).not.toBeVisible();
    await expect(zone(page, 1)).toHaveCSS("background-color", "rgb(228, 153, 119)");

    // 2. Open belt and tap Restart Life
    await openBelt(page);
    await page.getByRole("button", { name: "Restart Life" }).click();

    // expect: Life totals reset to 40
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // expect: Player 1 zone remains red (color preserved)
    await expect(zone(page, 1)).toHaveCSS("background-color", "rgb(228, 153, 119)");
  });
});
