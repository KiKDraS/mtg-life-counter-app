// spec: specs/life-delta.spec.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers (aligned with player-zone.spec.ts / restart-life.spec.ts) ── */

type Box = { x: number; y: number; width: number; height: number };

function zone(page: Page, n: 1 | 2): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function lifeTotal(zoneLocator: Locator): Locator {
  return zoneLocator.locator('[aria-live="polite"]');
}

/** §4.2 transient burst-net delta — the only `.text-delta` span in a zone. */
function delta(zoneLocator: Locator): Locator {
  return zoneLocator.locator(".text-delta");
}

/**
 * Zone layout settles late (cqw/cqh container sizing + hydration remount), so
 * a single-shot `boundingBox()` can return null right after load. Poll until a
 * real box exists.
 */
async function visibleBox(locator: Locator): Promise<Box> {
  const deadline = Date.now() + 10_000;
  let box = await locator.boundingBox();
  while (!box) {
    if (Date.now() > deadline) throw new Error("element not visible");
    await locator.page().waitForTimeout(100);
    box = await locator.boundingBox();
  }
  return box;
}

/**
 * Simulate a horizontal swipe on an element using pointer events.
 * Moves `distance` px in the given direction, fast enough to qualify as a
 * swipe (≥10px within 300ms per §4.2).
 */
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

/**
 * No-layout-shift check: the burst delta is absolutely positioned directly
 * above the life total (bottom-full of the life wrapper), so the life-total
 * box must not move when it appears. 1px tolerance covers sub-pixel rounding —
 * a real in-flow shift would move life by at least the delta height (~14px).
 */
function expectBoxEqual(actual: Box, baseline: Box): void {
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(Math.abs(actual[key] - baseline[key])).toBeLessThanOrEqual(1);
  }
}

test.describe("life-delta", () => {
  test("1.1. Single tap shows +1, aria-hidden, absolute above life, no layout shift", async ({
    page,
  }) => {
    // 1. Navigate to /; record lifeTotal(zone(1)) bounding box; assert P1 life reads 40 and delta count is 0
    await page.goto("/");
    const p1 = zone(page, 1);
    const p2 = zone(page, 2);
    const life = lifeTotal(p1);
    await expect(life).toHaveText("40");
    await expect(delta(p1)).toHaveCount(0);
    const baseline = await visibleBox(life);

    // 2. Tap P1 '+1 life' button once
    await p1.getByRole("button", { name: "+1 life" }).click();

    // expect: delta(zone(1)) visible with text exactly +1
    await expect(delta(p1)).toHaveText("+1");
    // expect: span has aria-hidden="true"
    await expect(delta(p1)).toHaveAttribute("aria-hidden", "true");
    // expect: span has class absolute, font-weight 700
    await expect(delta(p1)).toHaveClass(/absolute/);
    await expect(delta(p1)).toHaveCSS("font-weight", "700");
    // expect: delta box above life box — in the zone's OWN layout frame. P1 is
    // rotated 180° on screen, which flips the screen-space relationship (the
    // boundingBox of an element above the life lands BELOW the centered life
    // total on screen). offsetTop/offsetHeight are transform-independent layout
    // coords: the delta is above the life total (bottom-full of its wrapper).
    const above = await delta(p1).evaluate((el) => {
      const span = el as HTMLElement;
      const parent = span.offsetParent;
      if (!parent) return false;
      const lifeEl = Array.from(parent.children).find(
        (s) => s.getAttribute("aria-live") === "polite",
      );
      if (!lifeEl) return false;
      return span.offsetTop + span.offsetHeight <= (lifeEl as HTMLElement).offsetTop;
    });
    expect(above).toBe(true);
    // expect: lifeTotal box unchanged vs baseline (no layout shift)
    expectBoxEqual(await visibleBox(life), baseline);

    // 3. Read P1 life total; assert aria-live contract; tap P2 '+1 life' once
    // expect: P1 life reads 41
    await expect(life).toHaveText("41");
    // expect: lifeTotal still has aria-live="polite" aria-atomic="true"
    await expect(life).toHaveAttribute("aria-live", "polite");
    await expect(life).toHaveAttribute("aria-atomic", "true");
    await p2.getByRole("button", { name: "+1 life" }).click();
    // expect: delta(zone(2)) shows +1
    await expect(delta(p2)).toHaveText("+1");
    // expect: P1 delta still +1
    await expect(delta(p1)).toHaveText("+1");
  });

  test("2.1. Three taps accumulate burst net delta to +3", async ({ page }) => {
    // 1. Navigate to /; tap P1 '+1 life' three times in quick succession (<1s)
    await page.goto("/");
    const p1 = zone(page, 1);
    const plus = p1.getByRole("button", { name: "+1 life" });
    await plus.click();
    await plus.click();
    await plus.click();
    // expect: delta(zone(1)) text is +3
    await expect(delta(p1)).toHaveText("+3");
    // expect: P1 life reads 43
    await expect(lifeTotal(p1)).toHaveText("43");
    // expect: P2 life still reads 40
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
  });

  test("3.1. Opposing taps cancel to hidden; negative sign renders as U+2212", async ({
    page,
  }) => {
    // 1. Navigate to /; tap P1 '-1 life' once
    await page.goto("/");
    const p1 = zone(page, 1);
    const plus = p1.getByRole("button", { name: "+1 life" });
    const minus = p1.getByRole("button", { name: "-1 life" });
    await minus.click();
    // expect: delta(zone(1)) visible, text −1 with U+2212 (assert code point 0x2212)
    await expect(delta(p1)).toHaveText("\u22121");
    const codePoint = ((await delta(p1).textContent()) ?? "").charCodeAt(0);
    expect(codePoint).toBe(0x2212);

    // 2. Tap P1 '+1 life' once within 1s window
    await plus.click();
    // expect: delta(zone(1)) count = 0 (net 0)
    await expect(delta(p1)).toHaveCount(0);
    // expect: P1 life reads 40
    await expect(lifeTotal(p1)).toHaveText("40");

    // 3. Tap P1 '+1 life' twice then '-1 life' once
    await plus.click();
    await plus.click();
    await minus.click();
    // expect: delta(zone(1)) text is +1 (net 2-1)
    await expect(delta(p1)).toHaveText("+1");

    // 4. Tap P1 '-1 life' once more
    await minus.click();
    // expect: delta(zone(1)) count = 0
    await expect(delta(p1)).toHaveCount(0);
    // expect: P1 life reads 40
    await expect(lifeTotal(p1)).toHaveText("40");
  });

  test("4.1. Delta hides 1.2s after last tap", async ({ page }) => {
    // 1. Navigate to /; tap P1 '+1 life' twice
    await page.goto("/");
    const p1 = zone(page, 1);
    const plus = p1.getByRole("button", { name: "+1 life" });
    await plus.click();
    await plus.click();
    // expect: delta(zone(1)) visible, text +2
    await expect(delta(p1)).toHaveText("+2");

    // 2. Wait 1200ms
    await page.waitForTimeout(1200);
    // expect: delta(zone(1)) count = 0
    await expect(delta(p1)).toHaveCount(0);
    // expect: P1 life still reads 42
    await expect(lifeTotal(p1)).toHaveText("42");
  });

  test("5.1. Timer resets per change: visible at 1.1s from first tap", async ({
    page,
  }) => {
    // 1. Navigate to /; tap P1 '+1 life' (t=0)
    await page.goto("/");
    const p1 = zone(page, 1);
    const plus = p1.getByRole("button", { name: "+1 life" });
    await plus.click();
    // expect: delta(zone(1)) visible, text +1 (timer A fires at t=1000)
    await expect(delta(p1)).toHaveText("+1");

    // 2. Wait 600ms, tap P1 '+1 life' again (t=600)
    await page.waitForTimeout(600);
    await plus.click();
    // expect: delta(zone(1)) text +2 (timer B re-armed, fires at t=1600)
    await expect(delta(p1)).toHaveText("+2");

    // 3. Wait 500ms (t=1100, 1100ms after first tap)
    await page.waitForTimeout(500);
    // expect: delta(zone(1)) still visible, text +2 (would have hidden at t=1000 if timer had not re-armed)
    await expect(delta(p1)).toHaveText("+2");

    // 4. Wait 700ms more (t=1800)
    await page.waitForTimeout(700);
    // expect: delta(zone(1)) count = 0
    await expect(delta(p1)).toHaveCount(0);
  });

  test("6.1. Hold 1.3s accumulates +10 repeats: delta +20..+40, life matches", async ({
    page,
  }) => {
    // 1. Navigate to /; holdButton P1 '+1 life' for 1300ms
    await page.goto("/");
    const p1 = zone(page, 1);
    const button = p1.getByRole("button", { name: "+1 life" });
    const box = await visibleBox(button);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // §4.6 splash cover is pointer-events:auto until hydration removes it — a
    // raw mouse.down on the overlay swallows the press. Wait it out first.
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
    await page.mouse.move(cx, cy);
    await page.mouse.down();

    // expect: At ~1050ms into hold: delta matches /^\+[12]0$/ (+10 or +20, accumulation across repeats)
    await page.waitForTimeout(1050);
    await expect(delta(p1)).toHaveText(/^\+[12]0$/);

    // 2. Release; read delta
    await page.waitForTimeout(250);
    await page.mouse.up();
    // expect: delta(zone(1)) matches /^\+[234]0$/ (+20..+40)
    await expect(delta(p1)).toHaveText(/^\+[234]0$/);
    const burst = Number(((await delta(p1).textContent()) ?? "").slice(1));
    // expect: No +1 on release (hold suppresses click) — life = 40 + exact delta, within [60, 80]
    await expect(lifeTotal(p1)).toHaveText(String(40 + burst));
    expect(40 + burst).toBeGreaterThanOrEqual(60);
    expect(40 + burst).toBeLessThanOrEqual(80);

    // 3. Wait 1200ms
    await page.waitForTimeout(1200);
    // expect: delta(zone(1)) count = 0
    await expect(delta(p1)).toHaveCount(0);
  });

  test("7.1. Restart while delta visible clears it, no spurious delta", async ({
    page,
  }) => {
    // 1. Navigate to /; tap P1 '+1 life' twice
    await page.goto("/");
    const p1 = zone(page, 1);
    const plus = p1.getByRole("button", { name: "+1 life" });
    await plus.click();
    await plus.click();
    // expect: delta(zone(1)) visible, text +2
    await expect(delta(p1)).toHaveText("+2");

    // 2. Open belt (Open Spellbook Menu), tap 'Restart Life' within 1s window
    await page.getByLabel("Open Spellbook Menu").click();
    await page.getByRole("button", { name: "Restart Life" }).click();
    // expect: Belt auto-collapses
    await expect(page.locator("#spellbook-toggle")).not.toBeChecked();
    // expect: P1 life reads 40
    await expect(lifeTotal(p1)).toHaveText("40");
    // expect: delta(zone(1)) count = 0 immediately
    await expect(delta(p1)).toHaveCount(0);

    // 3. Wait 1200ms
    await page.waitForTimeout(1200);
    // expect: delta(zone(1)) count = 0 (no spurious delta)
    await expect(delta(p1)).toHaveCount(0);

    // 4. Tap P1 '+1 life' once post-restart
    await plus.click();
    // expect: delta(zone(1)) shows +1
    await expect(delta(p1)).toHaveText("+1");
    // expect: P1 life reads 41
    await expect(lifeTotal(p1)).toHaveText("41");
  });

  test("8.1. Life value correct: 40 -> 43 with +3, then 38 with −2", async ({
    page,
  }) => {
    // 1. Navigate to /; tap P1 '+1 life' three times
    await page.goto("/");
    const p1 = zone(page, 1);
    const plus = p1.getByRole("button", { name: "+1 life" });
    const minus = p1.getByRole("button", { name: "-1 life" });
    await plus.click();
    await plus.click();
    await plus.click();
    // expect: delta(zone(1)) text +3
    await expect(delta(p1)).toHaveText("+3");
    // expect: lifeTotal(zone(1)) text exactly 43
    await expect(lifeTotal(p1)).toHaveText("43");

    // 2. Tap P1 '-1 life' five times
    for (let i = 0; i < 5; i++) {
      await minus.click();
    }
    // expect: delta(zone(1)) text −2 (U+2212)
    await expect(delta(p1)).toHaveText("\u22122");
    // expect: P1 life reads 38
    await expect(lifeTotal(p1)).toHaveText("38");

    // 3. Wait 1200ms
    await page.waitForTimeout(1200);
    // expect: delta(zone(1)) count = 0
    await expect(delta(p1)).toHaveCount(0);
    // expect: P1 life still 38
    await expect(lifeTotal(p1)).toHaveText("38");
  });

  test("9.1. Commander damage adjustments produce no delta", async ({ page }) => {
    // 1. Navigate to /; swipe physical right on P1 zone (180° slot = Commander)
    await page.goto("/");
    await swipeOn(zone(page, 1), "right");
    const dlg = page.getByRole("dialog", { name: "Commander Damage" });
    // expect: Commander Damage dialog (aria-labelledby="commander-damage-title") opens
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute("aria-labelledby", "commander-damage-title");

    // 2. Tap '+1 commander damage' three times
    const plus = dlg
      .getByRole("button", { name: "+1 commander damage" })
      .first();
    await plus.click();
    await plus.click();
    await plus.click();
    // expect: Damage counter reads 3
    await expect(dlg.locator('[aria-live="polite"]').first()).toHaveText("3");
    // expect: delta(zone(1)) count = 0 (life 40→37 but no delta)
    await expect(delta(zone(page, 1))).toHaveCount(0);

    // 3. Close dialog (Escape); wait 1200ms
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
    await page.waitForTimeout(1200);
    // expect: P1 life reads 37
    await expect(lifeTotal(zone(page, 1))).toHaveText("37");
    // expect: delta(zone(1)) count = 0
    await expect(delta(zone(page, 1))).toHaveCount(0);
  });

  test("9.2. Counter adjustments produce no delta", async ({ page }) => {
    // 1. Navigate to /; swipe physical left on P1 zone (Counters)
    await page.goto("/");
    await swipeOn(zone(page, 1), "left");
    const dlg = page.getByRole("dialog", { name: "Counters" });
    // expect: Counters dialog opens
    await expect(dlg).toBeVisible();

    // 2. Tap '+1 Poison counter' twice
    const poisonPlus = dlg.getByRole("button", { name: "+1 Poison counter" });
    await poisonPlus.click();
    await poisonPlus.click();
    // expect: Poison counter reads 2
    await expect(
      poisonPlus.locator("xpath=../preceding-sibling::*[@aria-live='polite']"),
    ).toHaveText("2");
    // expect: delta(zone(1)) count = 0
    await expect(delta(zone(page, 1))).toHaveCount(0);

    // 3. Close dialog (Escape); wait 1200ms
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
    await page.waitForTimeout(1200);
    // expect: delta(zone(1)) count = 0
    await expect(delta(zone(page, 1))).toHaveCount(0);
    // expect: P1 life still reads 40
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 4. Tap P1 '+1 life' once
    await zone(page, 1).getByRole("button", { name: "+1 life" }).click();
    // expect: delta(zone(1)) shows +1 (life-button path still feeds delta)
    await expect(delta(zone(page, 1))).toHaveText("+1");
  });
});