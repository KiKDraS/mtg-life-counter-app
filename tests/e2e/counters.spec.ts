// spec: specs/qa-modals.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers (aligned with counters-overlay.spec.ts patterns) ── */

function zone(page: Page, n: 1 | 2): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function lifeTotal(zoneLocator: Locator): Locator {
  return zoneLocator.locator('[aria-live="polite"]');
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

function counterValue(dlg: Locator, name: string): Locator {
  const btn = dlg.getByRole("button", { name: `+1 ${name} counter` });
  return btn.locator("xpath=../preceding-sibling::*[@aria-live='polite']");
}

async function openBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
}

/* ───────────────────────────────────────────────
 * §7 — Counters Overlay
 * ─────────────────────────────────────────────── */

test.describe("Counters Overlay", () => {
  test("TC-7.1: Swipe right opens counters overlay", async ({ page }) => {
    // 1. Navigate to /
    await page.goto("/");

    // 2. Swipe right on Player 1 zone
    await swipeOn(zone(page, 1), "left");

    // expect: Counters overlay opens as dialog with heading "Counters"
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();
    const heading = dlg.locator("h2#counters-title");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Counters");
  });

  test("TC-7.2: 4 default counters visible", async ({ page }) => {
    // 1. Open Counters overlay for Player 1
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();

    // expect: 4 default counters visible
    for (const label of ["Poison counter", "Energy counter", "Experience counter", "Time counter"]) {
      await expect(dlg.getByRole("img", { name: label }).first()).toBeVisible();
    }

    // expect: Each starts at 0
    for (const name of ["poison", "energy", "experience", "time"]) {
      await expect(counterValue(dlg, name)).toHaveText("0");
    }

    // expect: [+] Add custom counter button at bottom-right
    await expect(dlg.getByRole("button", { name: "Add custom counter" })).toBeVisible();
  });

  test("TC-7.3: Custom counter modal adds new counter", async ({ page }) => {
    // 1. Open Counters overlay
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();

    // 2. Tap [+] button
    await dlg.getByRole("button", { name: "Add custom counter" }).click();
    const customDlg = page.getByRole("dialog", { name: "Custom Counter" });
    await expect(customDlg).toBeVisible();

    // 3. Type "Lore" in input
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("Lore");

    // 4. Submit via Enter
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();

    // expect: Custom counter "Lore" appears in grid (value 0)
    await expect(dlg).toBeVisible();
    const lorePill = dlg.locator('[aria-label="Lore counter"]');
    await expect(lorePill).toBeVisible();
    await expect(lorePill).toHaveText("L");
    await expect(counterValue(dlg, "Lore")).toHaveText("0");

    // 5. Tap [+] on Lore counter → value becomes 1
    await dlg.getByRole("button", { name: "+1 Lore counter" }).click();
    await expect(counterValue(dlg, "Lore")).toHaveText("1");

    // 6. Tap [-] on Lore counter twice → value becomes 0 (floor)
    await dlg.getByRole("button", { name: "-1 Lore counter" }).click();
    await expect(counterValue(dlg, "Lore")).toHaveText("0");
    await dlg.getByRole("button", { name: "-1 Lore counter" }).click();
    // expect: Value stays at 0 (Math.max(0, ...) floor — cannot go below 0)
    await expect(counterValue(dlg, "Lore")).toHaveText("0");
  });

  test("TC-7.4: Restart clears custom counters", async ({ page }) => {
    // 1. Add custom counter "Lore"
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();

    await dlg.getByRole("button", { name: "Add custom counter" }).click();
    const customDlg = page.getByRole("dialog", { name: "Custom Counter" });
    await expect(customDlg).toBeVisible();
    await customDlg.getByRole("textbox", { name: "Counter name" }).fill("Lore");
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();
    await expect(dlg.locator('[aria-label="Lore counter"]')).toBeVisible();

    // 2. Close overlay, open belt, tap Restart Life
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();

    await openBelt(page);
    await page.getByRole("button", { name: "Restart Life" }).click();

    // expect: Life totals reset to 40
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");

    // Belt auto-collapsed on the Restart Life tap (DESIGN §5.2) — no manual close needed

    // 3. Reopen Counters overlay
    await swipeOn(zone(page, 1), "left");
    await expect(dlg).toBeVisible();

    // expect: Custom counter "Lore" absent
    await expect(dlg.locator('[aria-label="Lore counter"]')).toHaveCount(0);

    // expect: Only 4 default counters present (rows = aria-live value spans;
    // layout is flex-wrap since the counters UI polish)
    const counterRows = dlg.locator('[aria-live="polite"]');
    await expect(counterRows).toHaveCount(4);

    // expect: Default counters all reset to 0
    for (const name of ["poison", "energy", "experience", "time"]) {
      await expect(counterValue(dlg, name)).toHaveText("0");
    }
  });
});
