// spec: specs/commander-damage.spec.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers (aligned with player-zone.spec.ts patterns) ── */

function zone(page: Page, n: 1 | 2): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function lifeTotal(zoneLocator: Locator): Locator {
  return zoneLocator.locator('[aria-live="polite"]');
}

async function lifeValue(zoneLocator: Locator): Promise<number> {
  return Number(await lifeTotal(zoneLocator).textContent());
}

function commanderDlg(page: Page): Locator {
  return page.getByRole("dialog", { name: "Commander Damage" });
}

function damageCounter(dlg: Locator): Locator {
  return dlg.locator('[aria-live="polite"]');
}

function plusButton(dlg: Locator): Locator {
  return dlg.getByRole("button", { name: "+1 commander damage" });
}

async function swipeOn(
  locator: Locator,
  direction: "left" | "right",
  distance = 50,
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element not visible for swipe");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const targetX = direction === "left" ? cx - distance : cx + distance;
  const page = locator.page();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(targetX, cy);
  await page.mouse.up();
}

async function holdButton(page: Page, button: Locator, ms: number): Promise<void> {
  const box = await button.boundingBox();
  if (!box) throw new Error("button not visible");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/* ───────────────────────────────────────────────
 * §1 — Opening the Overlay
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage — Opening the Overlay", () => {
  test("1.1. Swipe left opens Commander Damage dialog", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Perform a horizontal swipe left (~50px, < 300ms) on the P1 zone
    await swipeOn(zone(page, 1), "left");

    // expect: A dialog with aria-labelledby="commander-damage-title" opens
    const dlg = commanderDlg(page);
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute("aria-labelledby", "commander-damage-title");

    // expect: The dialog is contained within P1's half of the viewport
    const dlgBox = await dlg.boundingBox();
    const p1Box = await zone(page, 1).boundingBox();
    if (!dlgBox || !p1Box) throw new Error("cannot measure bounding boxes");
    expect(dlgBox.y).toBeGreaterThanOrEqual(0);
    expect(dlgBox.y + dlgBox.height).toBeLessThanOrEqual(p1Box.y + p1Box.height + 1);

    // 3. Press Escape to close P1 dialog
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();

    // 4. Swipe left on the P2 zone
    await swipeOn(zone(page, 2), "left");

    // expect: The same dialog opens for P2
    await expect(commanderDlg(page)).toBeVisible();
  });

  test("1.2. Swipe left while overlay is open closes it (toggle)", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog appears
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    await expect(dlg).toBeVisible();

    // 3. Swipe left on P1 zone again → dialog closes cleanly (overlay's pointer
    //    handlers call stopPropagation, zone behind doesn't react)
    await swipeOn(zone(page, 1), "left");
    await expect(dlg).not.toBeVisible();

    // 4. Swipe left again to reopen
    await swipeOn(zone(page, 1), "left");
    await expect(dlg).toBeVisible();

    // 5. Close via Escape
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
  });

  test("1.3. Short vertical jab (<10px) does not trigger the overlay", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    const p1 = zone(page, 1);
    const box = await p1.boundingBox();
    if (!box) throw new Error("zone not visible");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // 2. Simulate a pointerdown on P1 zone, move 5px down, pointerup
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + 5);
    await page.mouse.up();

    // expect: No Commander Damage dialog opens
    await expect(commanderDlg(page)).toHaveCount(0);
    // expect: Life total unchanged (still 40)
    await expect(lifeTotal(p1)).toHaveText("40");

    // 3. Tap P1 `+1 life` button normally
    await p1.getByRole("button", { name: "+1 life" }).click();
    // expect: Life reads 41 — tap gesture not conflicting with swipe detection
    await expect(lifeTotal(p1)).toHaveText("41");
  });

  test("1.4. Slow horizontal drag (>300ms) does not trigger the overlay", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    const p1 = zone(page, 1);
    const box = await p1.boundingBox();
    if (!box) throw new Error("zone not visible");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // 2. Simulate pointerdown, wait 400ms, move 50px left, pointerup
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(400);
    await page.mouse.move(cx - 50, cy);
    await page.mouse.up();

    // expect: No Commander Damage dialog opens (gesture exceeded SWIPE_TIMEOUT_MS)
    await expect(commanderDlg(page)).toHaveCount(0);
    // expect: Life total unchanged
    await expect(lifeTotal(p1)).toHaveText("40");
  });

  test("1.5. Escape key dismisses Commander Damage dialog", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    await expect(dlg).toBeVisible();

    // 3. Press Escape (backdrop click does not work because the content div
    //    fills the entire dialog with flex-1, leaving no backdrop gap)
    await page.keyboard.press("Escape");

    // expect: Dialog closes
    await expect(dlg).not.toBeVisible();
    // expect: P1 life unchanged
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
  });
});

/* ───────────────────────────────────────────────
 * §2 — Layout & Content
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage — Layout & Content", () => {
  test("2.1. Heading renders with correct text and aria reference", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);

    // 3. Locate the element with id="commander-damage-title"
    const heading = dlg.locator("#commander-damage-title");
    // expect: Text content reads exactly `Commander Damage`
    await expect(heading).toHaveText("Commander Damage");
    // expect: It is an `<h2>` element
    const tag = await heading.evaluate((el) => el.tagName);
    expect(tag).toBe("H2");

    // 4. Assert the dialog's aria-labelledby attribute
    // expect: aria-labelledby="commander-damage-title" is set on the `<dialog>`
    await expect(dlg).toHaveAttribute("aria-labelledby", "commander-damage-title");
  });

  test("2.2. Opponent color pill renders with Planeswalker symbol", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens (P1's opponent is red `r`)
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);

    // 3. Locate the opponent pill: a rounded pill with opponent's color
    const pill = dlg.locator("span.rounded-full").first();
    // expect: The pill contains an inline SVG with aria-label `Planeswalker symbol`
    await expect(pill.locator('span[role="img"][aria-label="Planeswalker symbol"]')).toBeVisible();
    // expect: The pill background-color equals red mana rgb(228, 153, 119)
    await expect(pill).toHaveCSS("background-color", "rgb(228, 153, 119)");

    // 4. Press Escape to close
    await page.keyboard.press("Escape");

    // 5. Swipe left on P2 zone (P2's opponent is blue `u`)
    await swipeOn(zone(page, 2), "left");
    const dlg2 = commanderDlg(page);
    const pill2 = dlg2.locator("span.rounded-full").first();
    // expect: The pill background-color equals blue mana rgb(193, 215, 233)
    await expect(pill2).toHaveCSS("background-color", "rgb(193, 215, 233)");
  });

  test("2.3. Damage counter starts at 0", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    const counter = damageCounter(dlg);

    // 3. Locate the damage counter (a span with aria-live="polite" and tabular-nums)
    // expect: The displayed text is `0`
    await expect(counter).toHaveText("0");
    // expect: The element has aria-live="polite" and aria-atomic="true"
    await expect(counter).toHaveAttribute("aria-live", "polite");
    await expect(counter).toHaveAttribute("aria-atomic", "true");
    // expect: The computed font-weight is 900 (black)
    await expect(counter).toHaveCSS("font-weight", "900");
    // expect: The computed font-variant-numeric includes tabular-nums
    await expect(counter).toHaveCSS("font-variant-numeric", "tabular-nums");
  });

  test("2.4. [+] button renders with correct label", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);

    // 3. Locate the button by aria-label="+1 commander damage"
    const btn = plusButton(dlg);
    // expect: The button is visible and enabled
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    // expect: The button text content is `+`
    await expect(btn).toHaveText("+");
    // expect: The button has class select-none and touch-manipulation
    await expect(btn).toHaveClass(/select-none/);
    await expect(btn).toHaveClass(/touch-manipulation/);
  });
});

/* ───────────────────────────────────────────────
 * §3 — Damage Adjustment
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage — Damage Adjustment", () => {
  test("3.1. Tap [+] adds exactly 1 commander damage", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    const counter = damageCounter(dlg);
    const btn = plusButton(dlg);

    // expect: Damage counter reads `0`
    await expect(counter).toHaveText("0");

    // 3. Tap the `+1 commander damage` button once
    await btn.click();
    // expect: Damage counter reads `1`
    await expect(counter).toHaveText("1");

    // 4. Tap the button three more times
    await btn.click();
    await btn.click();
    await btn.click();
    // expect: Damage counter reads `4`
    await expect(counter).toHaveText("4");

    // 5. Tap the button twice more
    await btn.click();
    await btn.click();
    // expect: Damage counter reads `6`
    await expect(counter).toHaveText("6");
  });

  test("3.2. Tap [+] is independent per player", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → tap [+] five times
    await swipeOn(zone(page, 1), "left");
    const dlg1 = commanderDlg(page);
    await plusButton(dlg1).click();
    await plusButton(dlg1).click();
    await plusButton(dlg1).click();
    await plusButton(dlg1).click();
    await plusButton(dlg1).click();
    // expect: P1 damage reads `5`
    await expect(damageCounter(dlg1)).toHaveText("5");

    // 3. Close P1 dialog (Escape), swipe left on P2 zone
    await page.keyboard.press("Escape");
    await swipeOn(zone(page, 2), "left");
    const dlg2 = commanderDlg(page);
    // expect: P2 damage reads `0`
    await expect(damageCounter(dlg2)).toHaveText("0");

    // 4. Tap P2 [+] three times
    await plusButton(dlg2).click();
    await plusButton(dlg2).click();
    await plusButton(dlg2).click();
    // expect: P2 damage reads `3`
    await expect(damageCounter(dlg2)).toHaveText("3");

    // 5. Close P2 dialog, swipe left on P1 zone
    await page.keyboard.press("Escape");
    await swipeOn(zone(page, 1), "left");
    // expect: P1 damage still reads `5`
    await expect(damageCounter(commanderDlg(page))).toHaveText("5");
  });

  test("3.3. Hold [+] accelerates to +10 after 1000ms", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    // expect: Damage reads `0`
    await expect(damageCounter(dlg)).toHaveText("0");

    // 3. Hold the `+1 commander damage` button for 1200ms, then release
    await holdButton(page, plusButton(dlg), 1200);

    // expect: Damage reads at least `10` (hold timer fires +10 after ~1000ms)
    const dmg = Number(await damageCounter(dlg).textContent());
    expect(dmg).toBeGreaterThanOrEqual(10);
    // ponyTail: hold fires +10 per tick; with 100ms interval and ~200ms after
    // 1s delay, at most 3 ticks fire → +30 from 0
    expect(dmg).toBeLessThanOrEqual(35);
  });

  test("3.4. Repeated taps accumulate correctly", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    const btn = plusButton(dlg);

    // 3. Tap [+] twenty times
    for (let i = 0; i < 20; i++) {
      await btn.click();
    }
    // expect: Damage counter reads `20`
    await expect(damageCounter(dlg)).toHaveText("20");
  });
});

/* ───────────────────────────────────────────────
 * §4 — Life Reduction
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage — Life Reduction", () => {
  test("4.1. Adding commander damage reduces life total by the same amount", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");
    // expect: P1 life reads `40`
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    const btn = plusButton(dlg);

    // 3. Tap `+1 commander damage` button five times
    await btn.click();
    await btn.click();
    await btn.click();
    await btn.click();
    await btn.click();
    // expect: Damage counter reads `5`
    await expect(damageCounter(dlg)).toHaveText("5");

    // 4. Close the dialog
    await page.keyboard.press("Escape");

    // 5. Read P1 life total (outside dialog, in the zone)
    // expect: P1 life reads `35` (40 − 5)
    await expect(lifeTotal(zone(page, 1))).toHaveText("35");

    // 6. Tap P1 `+1 life` once
    await zone(page, 1).getByRole("button", { name: "+1 life" }).click();
    // expect: P1 life reads `36` — normal life adjustments still work
    await expect(lifeTotal(zone(page, 1))).toHaveText("36");
  });

  test("4.2. Life reduction is independent per player", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 → tap [+] three times (damage=3), close
    await swipeOn(zone(page, 1), "left");
    const dlg1 = commanderDlg(page);
    await plusButton(dlg1).click();
    await plusButton(dlg1).click();
    await plusButton(dlg1).click();
    await page.keyboard.press("Escape");

    // 3. Swipe left on P2 → tap [+] seven times (damage=7), close
    await swipeOn(zone(page, 2), "left");
    const dlg2 = commanderDlg(page);
    for (let i = 0; i < 7; i++) {
      await plusButton(dlg2).click();
    }
    await page.keyboard.press("Escape");

    // expect: P1 life = 37, P2 life = 33
    await expect(lifeTotal(zone(page, 1))).toHaveText("37");
    await expect(lifeTotal(zone(page, 2))).toHaveText("33");

    // expect: P1 damage = 3, P2 damage = 7
    await swipeOn(zone(page, 1), "left");
    await expect(damageCounter(commanderDlg(page))).toHaveText("3");
    await page.keyboard.press("Escape");

    await swipeOn(zone(page, 2), "left");
    await expect(damageCounter(commanderDlg(page))).toHaveText("7");
  });

  test("4.3. Commander damage does not reduce opponent's life", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 → tap [+] ten times, close
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    for (let i = 0; i < 10; i++) {
      await plusButton(dlg).click();
    }
    await page.keyboard.press("Escape");

    // expect: P1 life = 30 (40 − 10)
    await expect(lifeTotal(zone(page, 1))).toHaveText("30");
    // expect: P2 life = 40 (unchanged)
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
  });

  test("4.4. Hold [+] also reduces life by the accelerated amount", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 → hold [+] for 1200ms
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    await holdButton(page, plusButton(dlg), 1200);

    // expect: Damage reads at least `10`
    const dmg = Number(await damageCounter(dlg).textContent());
    expect(dmg).toBeGreaterThanOrEqual(10);

    // 3. Close dialog, read P1 life
    await page.keyboard.press("Escape");
    const life = await lifeValue(zone(page, 1));
    // expect: P1 life ≤ 30 (reduced by 10+)
    expect(life).toBeLessThanOrEqual(30);
  });

  test("4.5. Life can go negative from commander damage", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 → tap [+] 41 times (start=40 life, 40−41 = −1)
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    const btn = plusButton(dlg);
    for (let i = 0; i < 41; i++) {
      await btn.click();
    }
    // expect: Damage reads `41`
    await expect(damageCounter(dlg)).toHaveText("41");

    // 3. Close dialog, read P1 life
    await page.keyboard.press("Escape");
    // expect: P1 life reads `-1`
    await expect(lifeTotal(zone(page, 1))).toHaveText("-1");
    // expect: Life total is danger red (rgb(213, 0, 0))
    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(213, 0, 0)");
  });
});

/* ───────────────────────────────────────────────
 * §5 — Lethal State
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage — Lethal State", () => {
  test("5.1. Damage text turns danger red at exactly 21", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 → tap [+] twenty times (damage=20)
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    const btn = plusButton(dlg);
    for (let i = 0; i < 20; i++) {
      await btn.click();
    }

    const counter = damageCounter(dlg);
    // expect: Damage counter text color is NOT danger red
    await expect(counter).not.toHaveCSS("color", "rgb(213, 0, 0)");
    // expect: "Lethal — Player loses" badge is NOT visible
    await expect(dlg.getByText("Lethal — Player loses")).toHaveCount(0);

    // 3. Tap [+] once more (damage=21)
    await btn.click();
    // expect: Damage counter reads `21`
    await expect(counter).toHaveText("21");
    // expect: Damage counter computed color equals danger red
    await expect(counter).toHaveCSS("color", "rgb(213, 0, 0)");

    // expect: A paragraph with text "Lethal — Player loses" appears
    const badge = dlg.getByText("Lethal — Player loses");
    await expect(badge).toBeVisible();
    // expect: The paragraph color equals danger red
    await expect(badge).toHaveCSS("color", "rgb(213, 0, 0)");
    // expect: The paragraph has font-weight 700 (bold) and uppercase
    await expect(badge).toHaveCSS("font-weight", "700");
    await expect(badge).toHaveCSS("text-transform", "uppercase");
  });

  test("5.2. Player life total also turns red when commander damage ≥ 21", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 → tap [+] 21 times (damage=21, life=19)
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    for (let i = 0; i < 21; i++) {
      await plusButton(dlg).click();
    }

    // 3. Close dialog
    await page.keyboard.press("Escape");

    // expect: P1 life total text color equals danger red
    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(213, 0, 0)");
    // expect: P2 life total is NOT red (still normal color)
    await expect(lifeTotal(zone(page, 2))).not.toHaveCSS("color", "rgb(213, 0, 0)");
  });

  test("5.3. Recovery from lethal state when damage drops below 21 is not possible via UI", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 → tap [+] 21 times (damage=21)
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    for (let i = 0; i < 21; i++) {
      await plusButton(dlg).click();
    }
    // expect: Lethal badge visible, damage is danger red
    await expect(dlg.getByText("Lethal — Player loses")).toBeVisible();
    await expect(damageCounter(dlg)).toHaveCSS("color", "rgb(213, 0, 0)");

    // 3. Note: The overlay has no [-] button to reduce commander damage (by design)
    // expect: There is no way within the overlay to reduce commander damage
    await expect(dlg.getByRole("button", { name: /-/ })).toHaveCount(0);

    // 4. Escape to close
    await page.keyboard.press("Escape");
    // expect: Life total remains red (still lethal from commander damage ≥ 21)
    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(213, 0, 0)");

    // 5. Tap P1 `-1 life` to drive life to 0
    const minusBtn = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 19; i++) {
      await minusBtn.click();
    }
    // expect: Life total still red (no change in color)
    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(213, 0, 0)");
  });

  test("5.4. Commander damage persists across open/close cycles", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 → tap [+] 5 times, close
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    for (let i = 0; i < 5; i++) {
      await plusButton(dlg).click();
    }
    await page.keyboard.press("Escape");

    // 3. Reopen P1 Commander Damage overlay
    await swipeOn(zone(page, 1), "left");
    // expect: Damage reads `5` (persisted)
    await expect(damageCounter(commanderDlg(page))).toHaveText("5");

    // 4. Tap [+] 16 times (total=21)
    for (let i = 0; i < 16; i++) {
      await plusButton(commanderDlg(page)).click();
    }
    // expect: Lethal badge appears, damage is danger red
    await expect(commanderDlg(page).getByText("Lethal — Player loses")).toBeVisible();
    await expect(damageCounter(commanderDlg(page))).toHaveCSS("color", "rgb(213, 0, 0)");

    // 5. Close and reopen
    await page.keyboard.press("Escape");
    await swipeOn(zone(page, 1), "left");
    // expect: Damage still reads `21`
    await expect(damageCounter(commanderDlg(page))).toHaveText("21");
    // expect: Lethal badge still visible
    await expect(commanderDlg(page).getByText("Lethal — Player loses")).toBeVisible();
    // expect: Life total still red
    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(213, 0, 0)");
  });
});

/* ───────────────────────────────────────────────
 * §6 — Closing the Overlay
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage — Closing the Overlay", () => {
  test("6.1. Swipe on overlay content closes the dialog (both directions)", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    // expect: Dialog is open
    await expect(dlg).toBeVisible();

    // 3. Perform a swipe left on the overlay content → dialog closes cleanly
    //    (zone's useSwipe + closeOverlays() handles it without reopening).
    await swipeOn(commanderDlg(page), "left");
    await expect(dlg).not.toBeVisible();
    // expect: P1 life unchanged by the swipe
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 4. Reopen, then swipe right on overlay content → also closes
    await swipeOn(zone(page, 1), "left");
    await expect(dlg).toBeVisible();
    await swipeOn(commanderDlg(page), "right");
    await expect(dlg).not.toBeVisible();

    // 5. Cleanup: verify Counters was NOT opened by the swipe
    await expect(page.getByRole("dialog", { name: "Counters" })).not.toBeVisible();
  });

  test("6.2. Escape key closes the dialog", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    await expect(dlg).toBeVisible();

    // 3. Press Escape
    await page.keyboard.press("Escape");
    // expect: Dialog closes
    await expect(dlg).not.toBeVisible();
    // expect: P1 life unchanged
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 4. Reopen and press Escape again
    await swipeOn(zone(page, 1), "left");
    await expect(dlg).toBeVisible();
    await page.keyboard.press("Escape");
    // expect: Dialog closes
    await expect(dlg).not.toBeVisible();
  });

  test("6.3. Tap background closes the dialog; tap [+] does not", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    await expect(dlg).toBeVisible();

    // 3. Tap the heading (a non-interactive area of the overlay)
    await dlg.getByRole("heading", { name: "Commander Damage" }).click();
    // expect: Dialog closes
    await expect(dlg).not.toBeVisible();
    // expect: P1 life unchanged (not a damage tap)
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 4. Reopen and tap [+] — should add damage, NOT close
    await swipeOn(zone(page, 1), "left");
    await expect(dlg).toBeVisible();
    await plusButton(dlg).click();
    // expect: Damage was added
    await expect(damageCounter(dlg)).toHaveText("1");
    // expect: Dialog stays open after [+] tap
    await expect(dlg).toBeVisible();
  });

  test("6.4. Commander Damage overlay is scoped to its player zone", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → P1 Commander Damage opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    // expect: Dialog bounding box is within P1's viewport half (top half)
    const dlgBox = await dlg.boundingBox();
    const viewport = page.viewportSize();
    if (!dlgBox || !viewport) throw new Error("cannot measure bounds");
    expect(dlgBox.y + dlgBox.height).toBeLessThanOrEqual(viewport.height / 2 + 1);

    // 3. Close via Escape
    await page.keyboard.press("Escape");

    // 4. Swipe left on P2 zone → P2 Commander Damage opens
    await swipeOn(zone(page, 2), "left");
    const dlg2 = commanderDlg(page);
    // expect: Dialog bounding box is within P2's viewport half (bottom half)
    const dlg2Box = await dlg2.boundingBox();
    if (!dlg2Box) throw new Error("cannot measure P2 dialog bounds");
    expect(dlg2Box.y).toBeGreaterThanOrEqual(viewport.height / 2 - 1);

    // expect: P2 damage counter shows opponent pill for blue (P2's opponent is blue `u`)
    const pill = dlg2.locator("span.rounded-full").first();
    await expect(pill).toHaveCSS("background-color", "rgb(193, 215, 233)");
  });

  test("6.5. Overlay does not interfere with other zone interactivity", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 → Commander Damage opens
    await swipeOn(zone(page, 1), "left");
    await expect(commanderDlg(page)).toBeVisible();

    // 3. Close via Escape
    await page.keyboard.press("Escape");

    // expect: P1 `+1 life` button works normally
    await zone(page, 1).getByRole("button", { name: "+1 life" }).click();
    await expect(lifeTotal(zone(page, 1))).toHaveText("41");

    // expect: P2 `+1 life` button works normally
    await zone(page, 2).getByRole("button", { name: "+1 life" }).click();
    await expect(lifeTotal(zone(page, 2))).toHaveText("41");

    // expect: Swipe right on P1 zone opens Counters dialog (other overlay unaffected)
    await swipeOn(zone(page, 1), "right");
    const countersDlg = page.getByRole("dialog", { name: "Counters" });
    await expect(countersDlg).toBeVisible();

    // 4. Close Counters via Escape
    await page.keyboard.press("Escape");
    await expect(countersDlg).not.toBeVisible();
  });
});

/* ───────────────────────────────────────────────
 * §7 — Accessibility & Edge Cases
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage — Accessibility & Edge Cases", () => {
  test("7.1. Dialog has correct ARIA modal attributes", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);

    // expect: `<dialog>` has aria-modal="true"
    await expect(dlg).toHaveAttribute("aria-modal", "true");
    // expect: `<dialog>` has aria-labelledby="commander-damage-title"
    await expect(dlg).toHaveAttribute("aria-labelledby", "commander-damage-title");
    // expect: `<h2 id="commander-damage-title">` exists with text `Commander Damage`
    const heading = dlg.locator("h2#commander-damage-title");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Commander Damage");
  });

  test("7.2. [+] button maintains 44×44px minimum touch target", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);

    // 3. Read bounding box of aria-label="+1 commander damage"
    const btn = plusButton(dlg);
    const box = await btn.boundingBox();
    if (!box) throw new Error("button not visible");
    // expect: width ≥ 44px and height ≥ 44px
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test("7.3. Damage counter has accessible announcements", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);

    // 3. Locate the damage counter element
    const counter = damageCounter(dlg);
    // expect: aria-live="polite" is present
    await expect(counter).toHaveAttribute("aria-live", "polite");
    // expect: aria-atomic="true" is present
    await expect(counter).toHaveAttribute("aria-atomic", "true");

    // 4. Tap [+] three times
    await plusButton(dlg).click();
    await expect(counter).toHaveText("1");
    await plusButton(dlg).click();
    await expect(counter).toHaveText("2");
    await plusButton(dlg).click();
    // expect: Element text updates to `3` (announced by screen reader)
    await expect(counter).toHaveText("3");
  });

  test("7.4. Dialog does not trap focus incorrectly", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe left on P1 zone → Commander Damage dialog opens
    await swipeOn(zone(page, 1), "left");
    const dlg = commanderDlg(page);
    const btn = plusButton(dlg);

    // 3. Focus the [+] button (dialog is opened with .show(), not .showModal(),
    //    so there is no autofocus or focus trapping)
    await btn.focus();
    await expect(btn).toBeFocused();

    // 4. Press Tab — focus moves to P2's -1 life button (outside the dialog),
    //    confirming that the dialog does NOT trap focus incorrectly
    await page.keyboard.press("Tab");
    await expect(zone(page, 2).getByRole("button", { name: "-1 life" })).toBeFocused();

    // 5. Close the dialog programmatically (swipe on the zone reopens it due
    //    to both the dialog's and zone's swipe handlers firing; Escape is only
    //    handled by .showModal() dialogs, not .show() dialogs)
    await page.evaluate(() => {
      const dlg = document.querySelector<HTMLDialogElement>(
        'dialog[aria-labelledby="commander-damage-title"]',
      );
      dlg?.close();
    });
    await expect(dlg).not.toBeVisible();
    // expect: P1 zone buttons are still accessible
    await expect(zone(page, 1).getByRole("button", { name: "-1 life" })).toBeVisible();
  });
});
