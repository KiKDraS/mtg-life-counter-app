// spec: specs/counters-overlay.plan.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers (aligned with player-zone.spec.ts patterns) ── */

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

/* ───────────────────────────────────────────────
 * §1 — Layout & Content
 * ─────────────────────────────────────────────── */

test.describe("Counters Overlay — Layout & Content", () => {
  test("1.1. Counters overlay opens via swipe right and displays heading", async ({ page }) => {
    // 1. Navigate to /
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    // expect: Page loads with two player zones
    await expect(zone(page, 1)).toBeVisible();
    await expect(zone(page, 2)).toBeVisible();

    // 2. Swipe right (~50px, <300ms) on the P1 zone wrapper
    await swipeOn(zone(page, 1), "left");

    // expect: A dialog with aria-labelledby="counters-title" opens
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute("aria-labelledby", "counters-title");

    // expect: Dialog is contained within P1's viewport half
    const dlgBox = await dlg.boundingBox();
    const p1Box = await zone(page, 1).boundingBox();
    if (!dlgBox || !p1Box) throw new Error("cannot measure bounding boxes");
    expect(dlgBox.y).toBeGreaterThanOrEqual(0);
    expect(dlgBox.y + dlgBox.height).toBeLessThanOrEqual(p1Box.y + p1Box.height + 1);

    // 3. Locate the element with id="counters-title"
    const heading = dlg.locator("#counters-title");

    // expect: Text content reads exactly "Counters"
    await expect(heading).toHaveText("Counters");
    // expect: It is an <h2> element (aria-level is implicit for <h2>, no explicit attr)
    await expect(heading).toHaveJSProperty("tagName", "H2");

    // 4. Assert the dialog's aria-labelledby attribute
    // expect: aria-labelledby="counters-title" is set on the <dialog>
    await expect(dlg).toHaveAttribute("aria-labelledby", "counters-title");
    // expect: aria-modal="true" is set on the <dialog>
    await expect(dlg).toHaveAttribute("aria-modal", "true");
  });

  test("1.2. Four default counters render with icons", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone to open Counters overlay
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();

    // 2. Check for default counter icons
    // expect: "Poison counter" icon is visible
    // expect: "Energy counter" icon is visible
    // expect: "Experience counter" icon is visible
    // expect: "Time counter" icon is visible
    for (const label of ["Poison counter", "Energy counter", "Experience counter", "Time counter"]) {
      // Icon components render <span role="img"> wrapping <svg>, both with
      // the same aria-label via {...props} spread — use .first() to avoid
      // strict-mode violation.
      await expect(dlg.getByRole("img", { name: label }).first()).toBeVisible();
    }

    // 3. Verify each counter value starts at 0
    // expect: All four counters display "0"
    for (const name of ["poison", "energy", "experience", "time"]) {
      await expect(counterValue(dlg, name)).toHaveText("0");
    }

    // 4. Verify each counter has [+]/[-] buttons with correct labels
    // expect: Button "-1 poison counter" exists
    // expect: Button "+1 poison counter" exists
    // expect: Button "-1 energy counter" exists
    // expect: Button "+1 energy counter" exists
    // expect: Button "-1 experience counter" exists
    // expect: Button "+1 experience counter" exists
    // expect: Button "-1 time counter" exists
    // expect: Button "+1 time counter" exists
    for (const prefix of ["-1", "+1"]) {
      for (const name of ["poison", "energy", "experience", "time"]) {
        await expect(dlg.getByRole("button", { name: `${prefix} ${name} counter` })).toBeVisible();
      }
    }

    // 5. Verify the grid is 2-column
    // expect: The grid container has CSS class grid-cols-2
    await expect(dlg.locator(".grid")).toHaveClass(/grid-cols-2/);
  });

  test("1.3. [+] button renders at bottom-right", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone to open Counters overlay
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();

    // 2. Locate the + button by aria-label="Add custom counter"
    const plusBtn = dlg.getByRole("button", { name: "Add custom counter" });

    // expect: Button is visible and enabled
    await expect(plusBtn).toBeVisible();
    await expect(plusBtn).toBeEnabled();
    // expect: Button text content is "+"
    await expect(plusBtn).toHaveText("+");
    // expect: Button has classes select-none and touch-manipulation
    await expect(plusBtn).toHaveClass(/select-none/);
    await expect(plusBtn).toHaveClass(/touch-manipulation/);
    // expect: Button is positioned bottom-right within the dialog
    await expect(plusBtn).toHaveClass(/right-4/);
    await expect(plusBtn).toHaveClass(/bottom-4/);
  });
});

/* ───────────────────────────────────────────────
 * §2 — Counter Adjustment
 * ─────────────────────────────────────────────── */

test.describe("Counters Overlay — Counter Adjustment", () => {
  test("2.1. Tap [+]/[-] adjusts by exactly 1 per counter", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone to open Counters overlay
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();

    // expect: Poison counter reads 0
    await expect(counterValue(dlg, "poison")).toHaveText("0");

    // 2. Tap +1 poison counter once
    await dlg.getByRole("button", { name: "+1 poison counter" }).click();
    // expect: Poison counter reads 1
    await expect(counterValue(dlg, "poison")).toHaveText("1");

    // 3. Tap +1 poison counter three more times
    await dlg.getByRole("button", { name: "+1 poison counter" }).click();
    await dlg.getByRole("button", { name: "+1 poison counter" }).click();
    await dlg.getByRole("button", { name: "+1 poison counter" }).click();
    // expect: Poison counter reads 4
    await expect(counterValue(dlg, "poison")).toHaveText("4");

    // 4. Tap -1 poison counter twice
    await dlg.getByRole("button", { name: "-1 poison counter" }).click();
    await dlg.getByRole("button", { name: "-1 poison counter" }).click();
    // expect: Poison counter reads 2
    await expect(counterValue(dlg, "poison")).toHaveText("2");

    // 5. Tap -1 poison counter twice more
    await dlg.getByRole("button", { name: "-1 poison counter" }).click();
    await dlg.getByRole("button", { name: "-1 poison counter" }).click();
    // expect: Poison counter reads 0
    await expect(counterValue(dlg, "poison")).toHaveText("0");
  });

  test("2.2. Counter adjustment is independent per player", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone, set poison to 5, close (Escape)
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg1 = page.getByRole("dialog", { name: "Counters" });
    const plusPoison = dlg1.getByRole("button", { name: "+1 poison counter" });
    for (let i = 0; i < 5; i++) {
      await plusPoison.click();
    }
    // expect: P1 poison = 5
    await expect(counterValue(dlg1, "poison")).toHaveText("5");
    await page.keyboard.press("Escape");

    // 2. Swipe right on P2 zone (bottom half)
    await swipeOn(zone(page, 2), "right");
    const dlg2 = page.getByRole("dialog", { name: "Counters" });
    // expect: P2 Counters overlay opens
    await expect(dlg2).toBeVisible();

    // 3. Check P2 poison value
    // expect: P2 poison reads 0 (independent from P1)
    await expect(counterValue(dlg2, "poison")).toHaveText("0");

    // 4. Set P2 energy to 3, close (Escape)
    const plusP2Energy = dlg2.getByRole("button", { name: "+1 energy counter" });
    for (let i = 0; i < 3; i++) {
      await plusP2Energy.click();
    }
    await expect(counterValue(dlg2, "energy")).toHaveText("3");
    await page.keyboard.press("Escape");

    // 5. Swipe right on P1 zone
    await swipeOn(zone(page, 1), "left");
    const dlg1Reopen = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg1Reopen).toBeVisible();
    // expect: P1 poison still reads 5
    await expect(counterValue(dlg1Reopen, "poison")).toHaveText("5");
    // expect: P1 energy still reads 0
    await expect(counterValue(dlg1Reopen, "energy")).toHaveText("0");
  });

  test("2.3. Hold [+] accelerates to +10 after 1s", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone to open Counters overlay
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    // expect: Poison counter reads 0
    await expect(counterValue(dlg, "poison")).toHaveText("0");

    // 2. Hold (pointerdown) the +1 poison counter button for 1200ms, then release
    await holdButton(page, dlg.getByRole("button", { name: "+1 poison counter" }), 1200);

    // expect: Poison counter >= 10
    const v = Number(await counterValue(dlg, "poison").textContent());
    expect(v).toBeGreaterThanOrEqual(10);
    // Upper bound: hold fires every 100ms after 1s delay → 3 fires × 10 = 30
    //   in 1200ms. Set to 35 for timing tolerance.
    expect(v).toBeLessThanOrEqual(35);
  });

  test("2.4. Hold [-] also accelerates", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone, tap +1 poison 15 times (total=15)
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    const plusPoison = dlg.getByRole("button", { name: "+1 poison counter" });
    for (let i = 0; i < 15; i++) {
      await plusPoison.click();
    }
    // expect: Poison counter reads 15
    await expect(counterValue(dlg, "poison")).toHaveText("15");

    // 2. Hold -1 poison counter for 1200ms, then release
    await holdButton(page, dlg.getByRole("button", { name: "-1 poison counter" }), 1200);

    // expect: Poison counter <= 5
    const v = Number(await counterValue(dlg, "poison").textContent());
    expect(v).toBeLessThanOrEqual(5);
  });
});

/* ───────────────────────────────────────────────
 * §3 — Poison Lethal State
 * ─────────────────────────────────────────────── */

test.describe("Counters Overlay — Poison Lethal State", () => {
  test("3.1. Poison at 10+ turns value danger red and life total red", async ({ page }) => {
    // 1. Navigate to /
    await page.goto("/");
    // expect: P1 life reads 40
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 2. Swipe right on P1 zone, set poison to 10 (tap +1 poison 10 times), close dialog
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    const plusPoison = dlg.getByRole("button", { name: "+1 poison counter" });
    for (let i = 0; i < 10; i++) {
      await plusPoison.click();
    }
    // expect: Poison set to 10
    await expect(counterValue(dlg, "poison")).toHaveText("10");
    await page.keyboard.press("Escape");

    // 3. Read P1 life total
    // expect: P1 life = 30 (40 - 10)

    // ponytail: App tracks poison as a separate lethal condition per MTG rules.
    // Life total stays at 40; color turns danger red and "Poison Lethal" text
    // appears below the life total.
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    // expect: P1 life total color = rgb(213, 0, 0) (danger red)
    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(213, 0, 0)");

    // 4. Check P2 life total
    // expect: P2 life = 40 (unchanged)
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
    // expect: P2 life total NOT danger red
    await expect(lifeTotal(zone(page, 2))).not.toHaveCSS("color", "rgb(213, 0, 0)");

    // 5. Reopen P1 Counters overlay
    await swipeOn(zone(page, 1), "left");
    const dlgReopen = page.getByRole("dialog", { name: "Counters" });
    await expect(dlgReopen).toBeVisible();
    // expect: Poison counter value = 10
    await expect(counterValue(dlgReopen, "poison")).toHaveText("10");
    // expect: Poison counter color = rgb(213, 0, 0)
    await expect(counterValue(dlgReopen, "poison")).toHaveCSS("color", "rgb(213, 0, 0)");
  });

  test("3.2. Poison below 10 is not lethal", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone, set poison to 9, close dialog
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    const plusPoison = dlg.getByRole("button", { name: "+1 poison counter" });
    for (let i = 0; i < 9; i++) {
      await plusPoison.click();
    }
    // expect: P1 poison = 9
    await expect(counterValue(dlg, "poison")).toHaveText("9");
    await page.keyboard.press("Escape");

    // 2. Read P1 life
    // expect: P1 life = 31 (40 - 9)

    // ponytail: App tracks poison as a separate lethal condition per MTG rules.
    // Life total stays at 40; only the text color turns red when poison >= 10.
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    // expect: P1 life total color is NOT rgb(213, 0, 0)
    await expect(lifeTotal(zone(page, 1))).not.toHaveCSS("color", "rgb(213, 0, 0)");

    // 3. Reopen P1 Counters, tap +1 poison once (total=10)
    await swipeOn(zone(page, 1), "left");
    const dlgReopen = page.getByRole("dialog", { name: "Counters" });
    await dlgReopen.getByRole("button", { name: "+1 poison counter" }).click();
    // expect: Poison value turns rgb(213, 0, 0)
    await expect(counterValue(dlgReopen, "poison")).toHaveCSS("color", "rgb(213, 0, 0)");
  });

  test("3.3. Poison lethal persists across open/close", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone, set poison to 10, close
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    const plusPoison = dlg.getByRole("button", { name: "+1 poison counter" });
    for (let i = 0; i < 10; i++) {
      await plusPoison.click();
    }
    await expect(counterValue(dlg, "poison")).toHaveText("10");
    await page.keyboard.press("Escape");
    // expect: Poison set to 10, life is danger red

    // ponytail: App tracks poison as a separate lethal condition per MTG rules.
    // Life total stays at 40; text color turns danger red.
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(213, 0, 0)");

    // 2. Reopen P1 Counters overlay
    await swipeOn(zone(page, 1), "left");
    const dlg2 = page.getByRole("dialog", { name: "Counters" });
    // expect: Poison still reads 10, still danger red
    await expect(counterValue(dlg2, "poison")).toHaveText("10");
    await expect(counterValue(dlg2, "poison")).toHaveCSS("color", "rgb(213, 0, 0)");
    await page.keyboard.press("Escape");

    // 3. Close and reopen again
    await swipeOn(zone(page, 1), "left");
    const dlg3 = page.getByRole("dialog", { name: "Counters" });
    // expect: Poison still reads 10, still danger red
    await expect(counterValue(dlg3, "poison")).toHaveText("10");
    await expect(counterValue(dlg3, "poison")).toHaveCSS("color", "rgb(213, 0, 0)");
    // expect: Life still reads 40 (unchanged by poison), still danger red
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(213, 0, 0)");
  });
});

/* ───────────────────────────────────────────────
 * §4 — Closing Mechanisms
 * ─────────────────────────────────────────────── */

test.describe("Counters Overlay — Closing Mechanisms", () => {
  test("4.1. Backdrop click dismisses Counters overlay", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    // expect: Counters overlay opens
    await expect(dlg).toBeVisible();

    // 2. Click the dialog backdrop (top-left corner, outside content area)
    await dlg.click({ position: { x: 5, y: 5 } });

    // expect: Dialog closes
    await expect(dlg).not.toBeVisible();
    // expect: P1 life total unchanged
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
  });

  test("4.2. Escape dismisses Counters overlay", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    // expect: Counters overlay opens
    await expect(dlg).toBeVisible();

    // 2. Press Escape
    await page.keyboard.press("Escape");
    // expect: Dialog closes
    await expect(dlg).not.toBeVisible();
    // expect: P1 life total unchanged
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 3. Reopen and press Escape again
    await swipeOn(zone(page, 1), "left");
    await expect(dlg).toBeVisible();
    await page.keyboard.press("Escape");
    // expect: Dialog closes again
    await expect(dlg).not.toBeVisible();
  });

  test("4.3. Swipe on overlay content closes Counters overlay", async ({ page }) => {
    // 1. Navigate to /, swipe right on P1 zone
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    // expect: Counters overlay opens
    await expect(dlg).toBeVisible();

    // 2. Swipe left on the overlay content (the div inside the dialog)
    await swipeOn(dlg, "left");
    // expect: Dialog closes
    await expect(dlg).not.toBeVisible();
    // expect: Commander Damage overlay was NOT opened (zone behind didn't react)
    await expect(page.getByRole("dialog", { name: "Commander Damage" })).toHaveCount(0);

    // 3. Swipe right on P1 zone to reopen, then swipe right on overlay content
    await swipeOn(zone(page, 1), "left");
    await expect(dlg).toBeVisible();
    await swipeOn(dlg, "right");
    // expect: Dialog also closes with right-direction swipe on content
    await expect(dlg).not.toBeVisible();
  });
});

/* ───────────────────────────────────────────────
 * §4.2/4.3 — Plan CT-02 floor invariant + CT-03 lethal badge
 * ─────────────────────────────────────────────── */

test.describe("Counters Overlay — Custom Counter Floor & Lethal Badge", () => {
  test("CT-02: Custom counter floors at 0 and persists across reopen", async ({
    page,
  }) => {
    // 1. open Counters (P1); add custom counter 'Lore' via [+] dialog
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();
    await dlg.getByRole("button", { name: "Add custom counter" }).click();
    const customDlg = page.getByRole("dialog", { name: "Custom Counter" });
    await customDlg.getByRole("textbox", { name: "Counter name" }).fill("Lore");
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();
    // expect: Lore pill present at 0
    await expect(dlg.locator('[aria-label="Lore counter"]')).toBeVisible();
    await expect(counterValue(dlg, "Lore")).toHaveText("0");

    // 2. tap Lore + twice, then − five times
    const plusLore = dlg.getByRole("button", { name: "+1 Lore counter" });
    const minusLore = dlg.getByRole("button", { name: "-1 Lore counter" });
    await plusLore.click();
    await plusLore.click();
    // expect: Lore = 2
    await expect(counterValue(dlg, "Lore")).toHaveText("2");
    for (let i = 0; i < 5; i++) {
      await minusLore.click();
    }
    // expect: Lore floors at 0 (never negative)
    await expect(counterValue(dlg, "Lore")).toHaveText("0");

    // 3. close and reopen Counters
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
    await swipeOn(zone(page, 1), "left");
    const dlgReopen = page.getByRole("dialog", { name: "Counters" });
    // expect: Lore still present (persists)
    await expect(dlgReopen.locator('[aria-label="Lore counter"]')).toBeVisible();
    await expect(counterValue(dlgReopen, "Lore")).toHaveText("0");
  });

  test("CT-03: Poison lethal at 10 → badge + danger red", async ({ page }) => {
    // 1. open Counters (P1); tap Poison + 10 times
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    await expect(dlg).toBeVisible();
    const plusPoison = dlg.getByRole("button", { name: "+1 poison counter" });
    for (let i = 0; i < 10; i++) {
      await plusPoison.click();
    }
    // expect: Poison reads 10
    await expect(counterValue(dlg, "poison")).toHaveText("10");
    // expect: Poison value color rgb(213,0,0)
    await expect(counterValue(dlg, "poison")).toHaveCSS(
      "color",
      "rgb(213, 0, 0)",
    );

    // 2. close overlay
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
    // expect: P1 life total color rgb(213,0,0)
    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(213, 0, 0)");
    // expect: 'Poison Lethal' badge visible under P1 life
    await expect(zone(page, 1).getByText("Poison Lethal")).toBeVisible();
  });
});
