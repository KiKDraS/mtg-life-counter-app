// spec: specs/commander-damage-minus.spec.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers (aligned with commander-damage.spec.ts patterns) ── */

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
  return dlg.locator('[aria-live="polite"]').first();
}

function plusButton(dlg: Locator): Locator {
  return dlg.getByRole("button", { name: "+1 commander damage" }).first();
}

function minusButton(dlg: Locator): Locator {
  return dlg.getByRole("button", { name: "-1 commander damage" }).first();
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

async function holdButton(
  page: Page,
  button: Locator,
  ms: number,
): Promise<void> {
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

/* ───────────────────────────────────────────────
 * §1 — Commander Damage Decrement
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage Decrement", () => {
  test("CDM-01: Tap +3 then -1 shows damage 2, life reduced by net 2", async ({
    page,
  }) => {
    // 1. Navigate to `/`
    await page.goto("/");
    // expect: P1 life reads `40`
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 2. Swipe right on P1 zone (180° slot) to open Commander Damage dialog
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page);
    // expect: dialog[id="commander-dmg-0"] is visible
    await expect(page.locator('dialog[id="commander-dmg-0"]')).toBeVisible();
    // expect: First column damage counter reads `0`
    await expect(damageCounter(dlg)).toHaveText("0");

    // 3. Tap the first column `+1 commander damage` button three times
    const btn = plusButton(dlg);
    await btn.click();
    await btn.click();
    await btn.click();
    // expect: Damage counter reads `3`
    await expect(damageCounter(dlg)).toHaveText("3");

    // 4. Tap the first column `-1 commander damage` button once
    await minusButton(dlg).click();
    // expect: Damage counter reads `2`
    await expect(damageCounter(dlg)).toHaveText("2");

    // 5. Read P1 life total from the zone behind the dialog
    // expect: P1 life reads `38` (40 − 2 net damage)
    await expect(lifeTotal(zone(page, 1))).toHaveText("38");

    // 6. Close with Escape and read P1 life again
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
    // expect: P1 life still reads `38`
    await expect(lifeTotal(zone(page, 1))).toHaveText("38");
  });

  test("CDM-02: Tap - at 0 keeps damage 0, life unchanged", async ({ page }) => {
    // 1. Navigate to `/` (fresh game)
    await page.goto("/");
    // expect: P1 life reads `40`
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 2. Swipe right on P1 zone to open Commander Damage dialog
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page);
    // expect: First column damage counter reads `0`
    await expect(damageCounter(dlg)).toHaveText("0");

    // 3. Tap the first column `-1 commander damage` button once
    const btn = minusButton(dlg);
    await btn.click();
    // expect: Damage counter still reads `0` (floor)
    await expect(damageCounter(dlg)).toHaveText("0");

    // 4. Tap `-1 commander damage` twice more
    await btn.click();
    await btn.click();
    // expect: Damage counter still reads `0`
    await expect(damageCounter(dlg)).toHaveText("0");

    // 5. Read P1 life total
    // expect: P1 life still reads `40` (floored press applies 0 delta,
    //         restores nothing)
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
  });

  test("CDM-03: Lethal clears - 21 to 20 removes badge, life +1", async ({
    page,
  }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe right on P1 zone to open Commander Damage dialog
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page);

    // 3. Tap the first column `+1 commander damage` button 21 times
    const plus = plusButton(dlg);
    for (let i = 0; i < 21; i++) {
      await plus.click();
    }
    // expect: Damage counter reads `21`
    await expect(damageCounter(dlg)).toHaveText("21");
    // expect: Damage counter color is danger red
    await expect(damageCounter(dlg)).toHaveCSS("color", "rgb(213, 0, 0)");
    // expect: `Commander Damage Lethal` zone label visible on P1 zone
    await expect(zone(page, 1).getByText("Commander Damage Lethal")).toBeVisible();
    // expect: P1 life reads `19` and is danger red
    await expect(lifeTotal(zone(page, 1))).toHaveText("19");
    await expect(lifeTotal(zone(page, 1))).toHaveCSS(
      "color",
      "rgb(213, 0, 0)",
    );

    // 4. Tap the first column `-1 commander damage` button once
    await minusButton(dlg).click();
    // expect: Damage counter reads `20`
    await expect(damageCounter(dlg)).toHaveText("20");
    // expect: Damage counter color is NOT danger red
    await expect(damageCounter(dlg)).not.toHaveCSS("color", "rgb(213, 0, 0)");
    // expect: `Commander Damage Lethal` label NOT visible
    await expect(zone(page, 1).getByText("Commander Damage Lethal")).not.toBeVisible();
    // expect: P1 life reads `20` (19 + 1 restored)
    await expect(lifeTotal(zone(page, 1))).toHaveText("20");
  });

  test("CDM-04: Hold - applies -10 after 1s", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe right on P1 zone to open Commander Damage dialog
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page);

    // 3. Tap the first column `+1 commander damage` button 15 times
    const plus = plusButton(dlg);
    for (let i = 0; i < 15; i++) {
      await plus.click();
    }
    // expect: Damage counter reads `15`
    await expect(damageCounter(dlg)).toHaveText("15");

    // 4. Hold (pointerdown) the first column `-1 commander damage` button for
    //    1200ms, then release (same holdButton helper as counters-overlay
    //    spec 2.3/2.4)
    await holdButton(page, minusButton(dlg), 1200);

    // expect: Damage applied >= 10 (hold fires -10 per tick after 1000ms delay)
    const dmg = Number(await damageCounter(dlg).textContent());
    expect(15 - dmg).toBeGreaterThanOrEqual(10);
    // expect: Damage counter reads <= 5 (15 − >=10; up to ~3 ticks at 100ms
    //         interval)
    expect(dmg).toBeLessThanOrEqual(5);
    // expect: Damage counter reads >= 0 (floor)
    expect(dmg).toBeGreaterThanOrEqual(0);

    // 5. Read P1 life total
    // expect: P1 life reads `40 - finalDamage` (life restored exactly by
    //         applied delta)
    expect(await lifeValue(zone(page, 1))).toBe(40 - dmg);
  });

  test("CDM-05: [-] layout & accessibility - visible, order, focusable, aria-labels", async ({
    page,
  }) => {
    // 1. Navigate to `/` and open Commander Damage dialog on P1
    await page.goto("/");
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page);
    await expect(dlg).toBeVisible();

    // 2. Locate button by aria-label="-1 commander damage"
    const btn = minusButton(dlg);
    // expect: Button is visible and enabled
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    // expect: Button text content is `−`
    await expect(btn).toHaveText("−");
    // expect: Button has classes select-none and touch-manipulation
    await expect(btn).toHaveClass(/select-none/);
    await expect(btn).toHaveClass(/touch-manipulation/);
    // expect: Computed font-size >= 28px (text-heading)
    const fs = await btn.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize),
    );
    expect(fs).toBeGreaterThanOrEqual(28);
    // expect: Bounding box >= 10x10px
    const box = await visibleBox(btn);
    expect(box.width).toBeGreaterThanOrEqual(10);
    expect(box.height).toBeGreaterThanOrEqual(10);

    // 3. Assert button order within the first column
    const order = await dlg.evaluate((el) => {
      const btns = Array.from(
        el.querySelectorAll<HTMLButtonElement>(
          'button[aria-label$="commander damage"]',
        ),
      );
      const idx = (label: string) =>
        btns.findIndex((b) => b.getAttribute("aria-label") === label);
      return { minus: idx("-1 commander damage"), plus: idx("+1 commander damage") };
    });
    // expect: `-1 commander damage` button precedes `+1 commander damage`
    //         button in DOM order
    expect(order.minus).toBeLessThan(order.plus);

    // 4. Focus the [−] button, then focus the [+] button
    await btn.focus();
    // expect: [−] is focused
    await expect(btn).toBeFocused();
    const plus = plusButton(dlg);
    await plus.focus();
    // expect: [+] is focused
    await expect(plus).toBeFocused();

    // 5. Close with Escape
    await page.keyboard.press("Escape");
    // expect: Dialog closes
    await expect(dlg).not.toBeVisible();
  });

  test("CDM-06: Regression - [+] tap +1 and hold +10 unchanged", async ({
    page,
  }) => {
    // 1. Navigate to `/` and open Commander Damage dialog on P1
    await page.goto("/");
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page);
    // expect: First column damage counter reads `0`
    await expect(damageCounter(dlg)).toHaveText("0");

    // 2. Tap the first column `+1 commander damage` button once
    const btn = plusButton(dlg);
    await btn.click();
    // expect: Damage counter reads `1`
    await expect(damageCounter(dlg)).toHaveText("1");

    // 3. Tap three more times
    await btn.click();
    await btn.click();
    await btn.click();
    // expect: Damage counter reads `4`
    await expect(damageCounter(dlg)).toHaveText("4");

    // 4. Hold (pointerdown) `+1 commander damage` for 1200ms, then release
    await holdButton(page, btn, 1200);

    // expect: Damage counter >= 10 (hold fires +10 per tick after 1000ms delay)
    const dmg = Number(await damageCounter(dlg).textContent());
    expect(dmg).toBeGreaterThanOrEqual(10);
    // expect: Damage counter <= 35 (3-tick upper bound, mirrors
    //         commander-damage.spec 3.3)
    expect(dmg).toBeLessThanOrEqual(35);

    // 5. Close with Escape and read P1 life
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
    // expect: P1 life = 40 − final damage
    expect(await lifeValue(zone(page, 1))).toBe(40 - dmg);
  });
});
