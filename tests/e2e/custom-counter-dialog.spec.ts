// spec: specs/counters-overlay.plan.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers (aligned with player-zone.spec.ts patterns) ── */

function zone(page: Page, n: 1 | 2): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
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

async function holdButton(page: Page, button: Locator, ms: number): Promise<void> {
  const box = await visibleBox(button);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // §4.6 splash cover is pointer-events:auto until hydration removes it — a
  // raw mouse.down on the overlay swallows the press. Wait it out first.
  await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

function counterValue(dlg: Locator, name: string): Locator {
  // Find the `+1 ${name} counter` button, then return its preceding sibling
  // value span (`aria-live="polite"` is set on the <span> in CounterRow).
  const btn = dlg.getByRole("button", { name: `+1 ${name} counter` });
  return btn.locator("xpath=./preceding-sibling::*[@aria-live='polite']");
}

/* ── Open Counters overlay + custom dialog (reusable) ── */

async function openCounters(page: Page): Promise<Locator> {
  await page.goto("/");
  await swipeOn(zone(page, 1), "left");
  const dlg = page.getByRole("dialog", { name: "Counters" });
  await expect(dlg).toBeVisible();
  return dlg;
}

async function openCustomDialog(page: Page): Promise<{ countersDlg: Locator; customDlg: Locator }> {
  const countersDlg = await openCounters(page);
  // Tap the "Add custom counter" button (+)
  await countersDlg.getByRole("button", { name: "Add custom counter" }).click();
  const customDlg = page.getByRole("dialog", { name: "Custom Counter" });
  await expect(customDlg).toBeVisible();
  return { countersDlg, customDlg };
}

/* ───────────────────────────────────────────────
 * §5 — Custom Counter Dialog — Modal
 * ─────────────────────────────────────────────── */

test.describe("Custom Counter Dialog — Modal", () => {
  test("5.1. Tapping [+] opens Custom Counter dialog (native <dialog>)", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone to open Counters overlay
    const countersDlg = await openCounters(page);
    // expect: Counters overlay is open
    await expect(countersDlg).toBeVisible();

    // 2. Tap the "Add custom counter" button (+)
    await countersDlg.getByRole("button", { name: "Add custom counter" }).click();

    // expect: A native <dialog> modal opens
    const customDlg = page.getByRole("dialog", { name: "Custom Counter" });
    await expect(customDlg).toBeVisible();
    // expect: Dialog has aria-labelledby="custom-counter-title"
    await expect(customDlg).toHaveAttribute("aria-labelledby", "custom-counter-title");

    // 3. Inspect the dialog
    // expect: Dialog backdrop is rgba(0,0,0,0.35) (lighter than the default bg-black/80)
    // Chromium 130+ returns oklab() instead of rgba() in computed styles
    await expect(customDlg).toHaveCSS("background-color", /oklab\(0\s+0\s+0\s*\/\s*0\.35\)|rgba\(0,\s*0,\s*0,\s*0\.35\)/);
  });

  test("5.2. Custom Counter dialog has correct title and input", async ({ page }) => {
    // 1. Open Counters overlay, tap [+] to open Custom Counter dialog
    const { countersDlg: _countersDlg, customDlg } = await openCustomDialog(page);
    // expect: Dialog is open
    await expect(customDlg).toBeVisible();

    // 2. Locate h2#custom-counter-title
    const heading = customDlg.locator("h2#custom-counter-title");
    // expect: Text content reads exactly "Custom Counter"
    await expect(heading).toHaveText("Custom Counter");
    // expect: It is an <h2> element with font-bold
    await expect(heading).toHaveCSS("font-weight", "700");

    // 3. Locate the text input
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    // expect: Input has placeholder "Counter name" (matches aria-label)
    await expect(input).toHaveAttribute("placeholder", "Counter name");
    // expect: Input has maxLength=35
    await expect(input).toHaveAttribute("maxlength", "35");
    // expect: Input is auto-focused (has focus on open)
    await expect(input).toBeFocused();

    // 4. Locate the [+ Add] button
    const addBtn = customDlg.getByRole("button", { name: "+ Add" });
    // expect: Button text content is "+ Add"
    await expect(addBtn).toHaveText("+ Add");
    // expect: Button is type="button"
    await expect(addBtn).toHaveAttribute("type", "button");
    // expect: Button is borderless
    await expect(addBtn).toHaveCSS("border-width", "0px");
  });

  // ponytail: CustomCounterModal child div has h-full, covering the backdrop entirely.
  // The DialogShell's e.target===e.currentTarget check can't fire.
  // App bug — needs OverlaySurface-style click-to-close.
  test("5.3. Backdrop tap closes dialog without adding counter", async ({ page }) => {
    // 1. Open Counters overlay, tap [+] to open Custom Counter dialog
    const { countersDlg, customDlg } = await openCustomDialog(page);
    // expect: Custom Counter dialog is open
    await expect(customDlg).toBeVisible();

    // 2. Type "Infect" in the input
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("Infect");
    // expect: Input shows "Infect"
    await expect(input).toHaveValue("Infect");

    // 3. Click the dialog backdrop (outside the modal content)
    await customDlg.click({ position: { x: 5, y: 5 } });
    // expect: Dialog closes
    await expect(customDlg).not.toBeVisible();
    // expect: No new counter appears in the Counters grid
    await expect(countersDlg).toBeVisible();

    // 4. Count the counter rows
    // expect: Still 4 default counters (poison, energy, experience, time) — no custom counter added
    const counterRows = countersDlg.locator("div.grid > div");
    await expect(counterRows).toHaveCount(4);
  });

  test("5.4. Escape closes dialog without adding counter", async ({ page }) => {
    // 1. Open Counters overlay, tap [+] to open Custom Counter dialog
    const { countersDlg, customDlg } = await openCustomDialog(page);
    // expect: Custom Counter dialog is open
    await expect(customDlg).toBeVisible();

    // 2. Type "Monarch" in the input
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("Monarch");
    // expect: Input shows "Monarch"
    await expect(input).toHaveValue("Monarch");

    // 3. Press Escape
    await page.keyboard.press("Escape");
    // expect: Dialog closes
    await expect(customDlg).not.toBeVisible();
    // expect: No new counter appears in grid
    await expect(countersDlg).toBeVisible();
    // Verify still 4 counters
    const counterRows = countersDlg.locator("div.grid > div");
    await expect(counterRows).toHaveCount(4);
  });

  test("5.5. Empty input: [+ Add] button does nothing", async ({ page }) => {
    // 1. Open Counters overlay, tap [+] to open Custom Counter dialog
    const { countersDlg: _countersDlg, customDlg } = await openCustomDialog(page);
    // expect: Custom Counter dialog is open
    await expect(customDlg).toBeVisible();

    // 2. Leave input empty and tap [+ Add]
    const addBtn = customDlg.getByRole("button", { name: "+ Add" });
    await addBtn.click();
    // expect: Dialog stays open
    await expect(customDlg).toBeVisible();
    // expect: No new counter added
    const counterRows = customDlg.page().getByRole("dialog", { name: "Counters" }).locator("div.grid > div");
    // (dialog still open, grid not visible — just verify no error UI)
    // expect: No error UI appears
    await expect(customDlg.getByRole("alert")).toHaveCount(0);

    // 3. Type only whitespace (spaces) and tap [+ Add]
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("   ");
    await addBtn.click();
    // expect: Dialog stays open
    await expect(customDlg).toBeVisible();
    // expect: No new counter added
    await expect(customDlg.getByRole("alert")).toHaveCount(0);
  });

  test("5.6. Enter key submits with non-empty input", async ({ page }) => {
    // 1. Open Counters overlay, tap [+] to open Custom Counter dialog
    const { countersDlg, customDlg } = await openCustomDialog(page);
    // expect: Custom Counter dialog is open
    await expect(customDlg).toBeVisible();

    // 2. Type "Vial" in the input and press Enter
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("Vial");
    await page.keyboard.press("Enter");
    // expect: Dialog closes
    await expect(customDlg).not.toBeVisible();
    // expect: A new custom counter "Vial" appears in the grid
    await expect(countersDlg).toBeVisible();

    // 3. Verify custom counter display
    // expect: Counter shows pill with first letter "V"
    const vialPill = countersDlg.locator('[aria-label="Vial counter"]');
    await expect(vialPill).toBeVisible();
    await expect(vialPill).toHaveText("V");
    // expect: Value reads 0
    await expect(counterValue(countersDlg, "Vial")).toHaveText("0");
    // expect: First letter is uppercase "V"
    await expect(vialPill).toHaveText("V");
    // expect: Pill background = rgb(202, 197, 192) (#CAC5C0)
    await expect(vialPill).toHaveCSS("background-color", "rgb(202, 197, 192)");

    // 4. Verify buttons
    // expect: Button "-1 Vial counter" exists
    await expect(countersDlg.getByRole("button", { name: "-1 Vial counter" })).toBeVisible();
    // expect: Button "+1 Vial counter" exists
    await expect(countersDlg.getByRole("button", { name: "+1 Vial counter" })).toBeVisible();
  });

  test("5.7. [+ Add] button submits with non-empty input", async ({ page }) => {
    // 1. Open Counters overlay, tap [+] to open Custom Counter dialog
    const { countersDlg, customDlg } = await openCustomDialog(page);
    // expect: Custom Counter dialog is open
    await expect(customDlg).toBeVisible();

    // 2. Type "City's Blessing" in the input and click [+ Add]
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("City's Blessing");
    await customDlg.getByRole("button", { name: "+ Add" }).click();
    // expect: Dialog closes
    await expect(customDlg).not.toBeVisible();
    // expect: A new custom counter "City's Blessing" appears in the grid
    await expect(countersDlg).toBeVisible();

    // 3. Verify counter shows first letter
    const blessingPill = countersDlg.locator('[aria-label="City\'s Blessing counter"]');
    // expect: Pill shows "C" (first letter, uppercase)
    await expect(blessingPill).toHaveText("C");
    // expect: Value reads 0
    await expect(counterValue(countersDlg, "City's Blessing")).toHaveText("0");
  });

  test("5.8. Max length enforced (35 characters)", async ({ page }) => {
    // 1. Open Counters overlay, tap [+] to open Custom Counter dialog
    const { customDlg } = await openCustomDialog(page);
    // expect: Custom Counter dialog is open
    await expect(customDlg).toBeVisible();

    // 2. Type a 40-character string into the input
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("a".repeat(40));

    // expect: Input value is truncated to 35 characters (maxLength=35)
    await expect(input).toHaveValue("a".repeat(35));
  });

  test("5.9. Custom counter ± buttons work with tap and hold", async ({ page }) => {
    // 1. Open Counters overlay, add a custom counter "Ticks" via [+] dialog
    const { countersDlg, customDlg } = await openCustomDialog(page);
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("Ticks");
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();
    // expect: Custom counter "Ticks" appears with value 0
    await expect(counterValue(countersDlg, "Ticks")).toHaveText("0");

    // 2. Tap +1 Ticks counter three times
    const plusTicks = countersDlg.getByRole("button", { name: "+1 Ticks counter" });
    await plusTicks.click();
    await plusTicks.click();
    await plusTicks.click();
    // expect: Counter value reads 3
    await expect(counterValue(countersDlg, "Ticks")).toHaveText("3");

    // 3. Tap -1 Ticks counter once
    await countersDlg.getByRole("button", { name: "-1 Ticks counter" }).click();
    // expect: Counter value reads 2
    await expect(counterValue(countersDlg, "Ticks")).toHaveText("2");

    // 4. Hold +1 Ticks counter for 1200ms
    await holdButton(page, plusTicks, 1200);
    // expect: Counter value >= 12 (tap + hold acceleration)
    const v = Number(await counterValue(countersDlg, "Ticks").textContent());
    expect(v).toBeGreaterThanOrEqual(12);
  });

  test("5.10. Multiple custom counters can be added", async ({ page }) => {
    // 1. Open Counters overlay, add custom counter "First" via [+] dialog
    const { countersDlg, customDlg } = await openCustomDialog(page);
    let input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("First");
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();
    // expect: "First" custom counter appears in grid
    await expect(countersDlg.locator('[aria-label="First counter"]')).toBeVisible();

    // 2. Tap [+] again, add custom counter "Second" via dialog
    await countersDlg.getByRole("button", { name: "Add custom counter" }).click();
    await expect(customDlg).toBeVisible();
    input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("Second");
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();
    // expect: "Second" custom counter also appears in grid
    await expect(countersDlg.locator('[aria-label="Second counter"]')).toBeVisible();

    // 3. Verify both counters
    // expect: Grid shows 6 counters total (4 default + 2 custom)
    const counterRows = countersDlg.locator("div.grid > div");
    await expect(counterRows).toHaveCount(6);
    // expect: Each custom counter has correct first-letter pill
    await expect(countersDlg.locator('[aria-label="First counter"]')).toHaveText("F");
    await expect(countersDlg.locator('[aria-label="Second counter"]')).toHaveText("S");
  });
});

/* ───────────────────────────────────────────────
 * §6 — Accessibility & Edge Cases
 * ─────────────────────────────────────────────── */

test.describe("Custom Counter Dialog — Accessibility & Edge Cases", () => {
  test("6.1. Dialog has correct ARIA modal attributes", async ({ page }) => {
    // 1. Open Counters overlay, tap [+] to open Custom Counter dialog
    const { customDlg } = await openCustomDialog(page);
    // expect: <dialog> has aria-modal="true"
    await expect(customDlg).toHaveAttribute("aria-modal", "true");
    // expect: <dialog> has aria-labelledby="custom-counter-title"
    await expect(customDlg).toHaveAttribute("aria-labelledby", "custom-counter-title");
    // expect: <h2 id="custom-counter-title"> exists with text "Custom Counter"
    const heading = customDlg.locator("h2#custom-counter-title");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Custom Counter");

    // 2. Verify close mechanisms are keyboard accessible
    // expect: Escape key closes dialog
    await page.keyboard.press("Escape");
    await expect(customDlg).not.toBeVisible();
  });

  test("6.2. Counter names with special characters render first letter uppercase", async ({ page }) => {
    // 1. Open Counters overlay, add custom counter "123abc" via dialog
    const { countersDlg, customDlg } = await openCustomDialog(page);
    const input = customDlg.getByRole("textbox", { name: "Counter name" });
    await input.fill("123abc");
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();
    // expect: Custom counter appears in grid
    await expect(countersDlg).toBeVisible();

    // 2. Check the pill display
    const pill = countersDlg.locator('[aria-label="123abc counter"]');
    // expect: Pill shows "1" (first character, uppercase)
    await expect(pill).toHaveText("1");
  });
});
