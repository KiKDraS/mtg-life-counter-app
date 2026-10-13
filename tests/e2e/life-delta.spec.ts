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

/* ── §4.2 life-change flash probes ── */

/**
 * §4.2 flash target 2 — pre-mounted center-column tint overlay. Disambiguated
 * from the `.text-delta` span (also `aria-hidden`) by `pointer-events-none`.
 */
function tintOverlay(zoneLocator: Locator): Locator {
  return zoneLocator.locator('span[aria-hidden="true"].pointer-events-none');
}

/** Running WAAPI animation count on an element (flash presence probe). */
function animationCount(locator: Locator): Promise<number> {
  return locator.evaluate((el) => el.getAnimations().length);
}

/**
 * Positive flash probe: poll with a tight window (the WAAPI animations are
 * created in a passive effect that flushes a frame or two after the press, so
 * the first `getAnimations()` read can legitimately be empty).
 */
async function expectFlash(locator: Locator): Promise<void> {
  await expect
    .poll(() => animationCount(locator), { timeout: 500 })
    .toBeGreaterThan(0);
}

/**
 * Negative flash probe (§4.2 testability): sample the animation count at
 * ~0/100/200/300ms and return the highest seen. A wrongly-fired 200ms flash is
 * caught by any sample inside its window; a lone post-hoc read would not.
 */
async function samplePeakAnimations(...locators: Locator[]): Promise<number> {
  let peak = 0;
  for (const wait of [0, 100, 100, 100]) {
    if (wait > 0) await locators[0].page().waitForTimeout(wait);
    for (const locator of locators) {
      peak = Math.max(peak, await animationCount(locator));
    }
  }
  return peak;
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
    // The flash scales the life <p> (transform) for ~200ms; sample the box
    // after it ends so the scaled rect is not mistaken for a layout shift —
    // the layout box itself never moves.
    await page.waitForTimeout(250);
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

  test("6.1. Hold 1.9s commits two +10s at the 1s fallback / 1.5s repeat — delta +20, life 60 (no preview)", async ({
    page,
  }) => {
    // 1. Navigate to /; hold P1 '+1 life' for 1900ms (no `contextmenu` — the
    //    desktop mouse hold path commits via the 1s fallback)
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

    // expect: At ~1050ms: P1 life reads 50 — first ±10 COMMITTED at the 1s
    // fallback; delta text +10 at full opacity (the old opacity-0.5 preview
    // stage is gone — there is no pre-commit state)
    await page.waitForTimeout(1050);
    await expect(lifeTotal(p1)).toHaveText("50");
    await expect(delta(p1)).toHaveText("+10");
    await expect(delta(p1)).toHaveCSS("opacity", "1");

    // 2. Continue holding to ~1550ms
    await page.waitForTimeout(500);
    // expect: P1 life reads 60 (second ±10 @1.5s = 500ms after the first)
    await expect(lifeTotal(p1)).toHaveText("60");
    // expect: delta text +20 at full opacity — cumulative burst, never "+10"
    await expect(delta(p1)).toHaveText("+20");
    await expect(delta(p1)).toHaveCSS("opacity", "1");

    // 3. Release at 1900ms (+30 @2s not reached)
    await page.waitForTimeout(350);
    await page.mouse.up();
    await page.waitForTimeout(150);
    // expect: P1 life still reads 60 (committed ±10s stay)
    await expect(lifeTotal(p1)).toHaveText("60");
    // expect: No +1 on release (hold suppresses the click; would read 61)

    // 4. Wait 1200ms
    await page.waitForTimeout(1200);
    // expect: delta(zone(1)) count = 0 (hide timer re-armed by the last commit)
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

/* ───────────────────────────────────────────────
 * §2 — Life-Change Flash (NEW — DESIGN.md §4.2, §9)
 * ─────────────────────────────────────────────── */

/** Tight poll that BOTH flash targets carry a live animation (same effect frame). */
async function expectFlashOnBoth(life: Locator, tint: Locator): Promise<void> {
  await expect
    .poll(
      async () =>
        (await animationCount(life)) > 0 && (await animationCount(tint)) > 0,
      { timeout: 500 },
    )
    .toBe(true);
}

test.describe("Life-Change Flash", () => {
  test("10.1. A committed ± life change pulses the flash: life scale + tint fade, ~200ms, WAAPI-only", async ({
    page,
  }) => {
    // 1. Navigate to /; wait out the hydration remount; sample getAnimations()
    //    on lifeTotal(zone(1)) and the tint span at ~0/100/200/300ms
    await page.goto("/");
    const p1 = zone(page, 1);
    const life = lifeTotal(p1);
    const tint = tintOverlay(p1);
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);

    // expect: 0 running animations on both at every sample (the initial mount
    // never flashes — the `flashKey` skip applies)
    expect(await samplePeakAnimations(life, tint)).toBe(0);

    // Marker proving the life <p> is never remounted by the delta/flash path.
    await life.evaluate((el) => {
      (el as HTMLElement).dataset.flashNodeMarker = "same-node";
    });
    const baseline = await visibleBox(life);

    // 2. Tap P1 '+1 life' once, then poll getAnimations() on both elements
    await p1.getByRole("button", { name: "+1 life" }).click();
    // expect: ≥1 animation on the life <p> and ≥1 on the tint span (fresh
    // flash fired by the committed ±1) — tight 500ms poll
    await expectFlashOnBoth(life, tint);

    // expect: Timing/keyframes: duration 200ms; life keyframes scale 1 → 1.08
    // → 1; tint keyframes opacity 1 → 0
    const lifeAnim = await life.evaluate((el) => {
      const anim = el.getAnimations()[0];
      const effect = anim.effect as KeyframeEffect | null;
      return {
        duration: effect?.getTiming().duration,
        keyframes: effect?.getKeyframes().map((k) => k.transform ?? k.opacity),
      };
    });
    expect(lifeAnim.duration).toBe(200);
    expect(lifeAnim.keyframes).toEqual(["scale(1)", "scale(1.08)", "scale(1)"]);
    const tintAnim = await tint.evaluate((el) => {
      const anim = el.getAnimations()[0];
      const effect = anim.effect as KeyframeEffect | null;
      return {
        duration: effect?.getTiming().duration,
        keyframes: effect?.getKeyframes().map((k) => k.opacity),
      };
    });
    expect(tintAnim.duration).toBe(200);
    expect(tintAnim.keyframes).toEqual(["1", "0"]);

    // 3. Read the life total box and the delta box
    // expect: Delta burst reads +1
    await expect(delta(p1)).toHaveText("+1");
    // expect: life <p> is the same DOM node (not remounted) — aria-live preserved
    await expect(life).toHaveAttribute("aria-live", "polite");
    expect(
      await life.evaluate((el) => (el as HTMLElement).dataset.flashNodeMarker),
    ).toBe("same-node");
    // The flash scales the life <p> (transform) for ~200ms — sample the box
    // after it ends so the scaled rect is not mistaken for a layout shift.
    await page.waitForTimeout(250);
    // expect: no layout shift (life box unchanged vs baseline)
    expectBoxEqual(await visibleBox(life), baseline);

    // 4. Past the 200ms window — both elements must report 0 again — then tap
    //    P1 '-1 life' and poll again
    expect(await samplePeakAnimations(life, tint)).toBe(0);
    await p1.getByRole("button", { name: "-1 life" }).click();
    // expect: the −1 commit fires a new flash (≥1 each) — every committed
    // change re-triggers, no commit is skipped
    await expectFlashOnBoth(life, tint);
    await expect(life).toHaveText("40");

    // 5. Hold P1 '+1 life' for ~1200ms (fallback commit @1s), release, poll again
    const button = p1.getByRole("button", { name: "+1 life" });
    const box = await visibleBox(button);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    // Wait for the committed +10 while still held — a post-release read at
    // 1.2s+ could legitimately miss the 200ms animation created at the 1s commit.
    await expect(life).toHaveText("50");
    // expect: ≥1 on both (the ±10 hold commit also flashes). Tight poll
    // intervals: default intervals would overshoot the +10 @1.5s repeat and
    // turn the 1.2s hold into a 60.
    await expect
      .poll(
        async () =>
          (await animationCount(life)) > 0 && (await animationCount(tint)) > 0,
        { intervals: [10, 25, 50], timeout: 400 },
      )
      .toBe(true);
    await page.mouse.up();
    await page.waitForTimeout(150);
    // expect: P1 life reads 50 (40 → +1 → −1 → 40, then +10 from the hold commit)
    await expect(life).toHaveText("50");
    // expect: No ±1 applied on a hold release after a commit (would read 51)
  });

  test("10.2. `prefers-reduced-motion: reduce` suppresses the flash; life still changes", async ({
    page,
  }) => {
    // 1. emulateMedia reduce; navigate to /
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const p1 = zone(page, 1);
    const life = lifeTotal(p1);
    const tint = tintOverlay(p1);
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
    // expect: matchMedia("(prefers-reduced-motion: reduce)").matches is true
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);

    // 2. Tap P1 '+1 life' once, then sample both elements across a ≥400ms window
    await p1.getByRole("button", { name: "+1 life" }).click();
    // expect: 0 animations on both at every sample (§9: no life-change flash)
    expect(await samplePeakAnimations(life, tint)).toBe(0);
    // expect: P1 life reads 41 (the change itself is NOT suppressed)
    await expect(life).toHaveText("41");
    // expect: the delta burst still shows +1 (reduced motion removes the flash only)
    await expect(delta(p1)).toHaveText("+1");

    // 3. Hold P1 '+1 life' for 1200ms (fallback commit) and sample the same window
    const button = p1.getByRole("button", { name: "+1 life" });
    const box = await visibleBox(button);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Move into the commit window (~1000ms) before sampling so any wrongly-fired
    // flash around the fallback commit falls inside the sampled window.
    await page.waitForTimeout(900);
    expect(await samplePeakAnimations(life, tint)).toBe(0);
    await page.mouse.up();
    // expect: 0 animations at every sample; P1 life reads 51 (+10 committed — hold works)
    await expect(life).toHaveText("51");

    // 4. Restore the media feature, then tap P1 '+1 life'
    await page.emulateMedia({ reducedMotion: null });
    await button.click();
    // expect: ≥1 animation on the life <p> and the tint span (tight poll) — the
    // suppression is media-driven, not permanent
    await expectFlashOnBoth(life, tint);
    await expect(life).toHaveText("52");
  });

  test("10.3. No flash on reset/remount and no flash from commander damage or counters", async ({
    page,
  }) => {
    // 1. Navigate to /; tap P1 '+1 life' → tight poll on the life <p> shows ≥1
    //    (baseline: the flash fires for the life-button path)
    await page.goto("/");
    const p1 = zone(page, 1);
    const life = lifeTotal(p1);
    const tint = tintOverlay(p1);
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
    await p1.getByRole("button", { name: "+1 life" }).click();
    // expect: ≥1 animation on the life <p> (tight poll)
    await expectFlash(life);
    await expectFlash(tint);

    // 2. Wait 300ms for the flash to finish; open belt → tap 'Restart Life';
    //    sample the (remounted) life <p> and tint span at ~0/100/200/300ms
    await page.waitForTimeout(300);
    await page.getByLabel("Open Spellbook Menu").click();
    await page.getByRole("button", { name: "Restart Life" }).click();
    // expect: 0 at every sample — remount/`flashKey` reset never flashes
    expect(await samplePeakAnimations(life, tint)).toBe(0);
    // expect: P1 life reads 40; delta(zone(1)) count = 0
    await expect(life).toHaveText("40");
    await expect(delta(p1)).toHaveCount(0);

    // 3. Swipe physical right on P1 zone (Commander Damage overlay); tap
    //    '+1 commander damage' twice; sample the same window
    await swipeOn(p1, "right");
    const commander = page.getByRole("dialog", { name: "Commander Damage" });
    await expect(commander).toBeVisible();
    const commanderPlus = commander
      .getByRole("button", { name: "+1 commander damage" })
      .first();
    await commanderPlus.click();
    await commanderPlus.click();
    // expect: 0 at every sample on the life <p> and tint span — commander-driven
    // life changes (40 → 38) do not flash (§4.2: same trigger as the delta burst)
    expect(await samplePeakAnimations(life, tint)).toBe(0);
    // expect: delta(zone(1)) count = 0
    await expect(delta(p1)).toHaveCount(0);

    // 4. Escape to close; swipe physical left on P1 zone (Counters overlay);
    //    tap '+1 poison counter' twice; sample the same window
    await page.keyboard.press("Escape");
    await expect(commander).not.toBeVisible();
    await swipeOn(p1, "left");
    const counters = page.getByRole("dialog", { name: "Counters" });
    await expect(counters).toBeVisible();
    const poisonPlus = counters.getByRole("button", {
      name: "+1 poison counter",
    });
    await poisonPlus.click();
    await poisonPlus.click();
    // expect: 0 animations at every sample — counter changes do not flash
    expect(await samplePeakAnimations(life, tint)).toBe(0);

    // 5. Close the overlay (Escape); tap P1 '+1 life' once
    await page.keyboard.press("Escape");
    await expect(counters).not.toBeVisible();
    await p1.getByRole("button", { name: "+1 life" }).click();
    // expect: ≥1 animation on both (tight poll) — the life-button path flashes
    // again (baseline restored after the flash-free paths)
    await expectFlashOnBoth(life, tint);
    await expect(life).toHaveText("39");
  });
});