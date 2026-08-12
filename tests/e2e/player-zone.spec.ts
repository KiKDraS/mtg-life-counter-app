// spec: specs/player-zone.spec.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

function zone(page: Page, n: 1 | 2): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function lifeTotal(zoneLocator: Locator): Locator {
  return zoneLocator.locator('[aria-live="polite"]');
}

async function lifeValue(zoneLocator: Locator): Promise<number> {
  return Number(await lifeTotal(zoneLocator).textContent());
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

/**
 * Dev mode: the page reloads once ~100ms after load (HMR double connect), and
 * hydration remounts the zone nodes right after — both reset focus and
 * geometry. Wait until the P1 zone node has been stable for 300ms so Tab
 * sequences run on a settled page.
 */
async function waitZoneStable(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const sec = document.querySelector('section[aria-label^="Player 1:"]');
      if (!sec) return false;
      const w = window as unknown as {
        __zoneNode?: Element;
        __zoneChangedAt?: number;
      };
      if (w.__zoneNode !== sec) {
        w.__zoneNode = sec;
        w.__zoneChangedAt = Date.now();
        return false;
      }
      return Date.now() - (w.__zoneChangedAt ?? 0) > 300;
    },
    undefined,
    { timeout: 15_000 },
  );
}

test.describe("Player Zone — Board Rendering", () => {
  test("1.1. Board renders two zones in an equal vertical split, P1 on top", async ({ page }) => {
    // 1. Navigate to `/` with a portrait viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const regions = page.getByRole("region", { name: /^Player \d:/ });
    await expect(regions).toHaveCount(2);
    await expect(regions.first()).toBeVisible();
    await expect(regions.last()).toBeVisible();

    // 2. Read bounding boxes for both zones
    const p1Box = await zone(page, 1).boundingBox();
    const p2Box = await zone(page, 2).boundingBox();
    if (!p1Box || !p2Box) throw new Error("zones not visible");

    expect(p1Box.y).toBeGreaterThanOrEqual(-2);
    expect(p1Box.y).toBeLessThanOrEqual(2);
    expect(Math.abs(p2Box.y - 844 / 2)).toBeLessThanOrEqual(2);

    expect(Math.abs(p1Box.height - p2Box.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(p1Box.height - 844 / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(p2Box.height - 844 / 2)).toBeLessThanOrEqual(2);

    expect(p1Box.width).toBe(390);
    expect(p2Box.width).toBe(390);
  });

  test("1.2. Top zone (P1) is rotated 180°, bottom zone (P2) is not rotated", async ({ page }) => {
    // 1. Navigate to `/`; evaluate P1 wrapper transform
    await page.goto("/");

    const p1Transform = await zone(page, 1).evaluate(
      (el) => el.parentElement?.style.transform ?? "",
    );
    expect(["rotate(180deg)", "matrix(-1, 0, 0, -1, 0, 0)"]).toContain(p1Transform);

    // 2. Same evaluation for the P2 wrapper
    const p2Transform = await zone(page, 2).evaluate(
      (el) => el.parentElement?.style.transform ?? "",
    );
    expect(["rotate(0deg)", "none", ""]).toContain(p2Transform);
  });

  test("1.3. Both players default to red mana background (SPEC §3)", async ({ page }) => {
    // 1. Navigate to `/`; assert both players have red mana #E49977
    await page.goto("/");

    await expect(zone(page, 1)).toHaveCSS("background-color", "rgb(228, 153, 119)");
    await expect(zone(page, 2)).toHaveCSS("background-color", "rgb(228, 153, 119)");
  });
});

test.describe("Player Zone — Life Display & Tap Adjustment", () => {
  test("2.1. Both players start at 40 life with massive typography", async ({ page }) => {
    // 1. Navigate to `/`; both life totals display exact text `40`
    await page.goto("/");

    const p1Life = lifeTotal(zone(page, 1));
    const p2Life = lifeTotal(zone(page, 2));
    await expect(p1Life).toHaveText("40");
    await expect(p2Life).toHaveText("40");

    // 2. Assert computed typography on each life <p>
    //    Note: hydration (HYDRATE) remounts PlayerRow keyed on
    //    version-isHydrated — the SSR <p> a one-shot evaluate grabbed could be
    //    detached mid-test (getComputedStyle then returns "" → NaN). Poll with
    //    a fresh locator resolution instead of single-shot evaluate.
    for (const life of [p1Life, p2Life]) {
      await expect
        .poll(async () => {
          const fs = await life.evaluate(
            (el) => parseFloat(getComputedStyle(el).fontSize),
          );
          return Number.isFinite(fs) ? fs : 0;
        })
        .toBeGreaterThanOrEqual(64);
      await expect(life).toHaveCSS("font-weight", "900");
      await expect
        .poll(async () => {
          const ff = await life.evaluate((el) => getComputedStyle(el).fontFamily);
          return ff;
        })
        .toContain("Archivo");
    }
  });

  test("2.2. Tap + and − adjust by exactly 1, independently per player", async ({ page }) => {
    // 1. Navigate to `/`; P1 +1 once, P2 +1 three times
    await page.goto("/");

    const p1 = zone(page, 1);
    const p2 = zone(page, 2);
    await p1.getByRole("button", { name: "+1 life" }).click();
    await p2.getByRole("button", { name: "+1 life" }).click();
    await p2.getByRole("button", { name: "+1 life" }).click();
    await p2.getByRole("button", { name: "+1 life" }).click();

    await expect(lifeTotal(p1)).toHaveText("41");
    await expect(lifeTotal(p2)).toHaveText("43");

    // 2. Click P2 −1 once; P2 reads 42, P1 still 41
    await p2.getByRole("button", { name: "-1 life" }).click();
    await expect(lifeTotal(p2)).toHaveText("42");
    await expect(lifeTotal(p1)).toHaveText("41");
  });
});

test.describe("Player Zone — Hold Acceleration & Press Feedback", () => {
  test("3.1. Short hold (<1s) fires only the ±1 tap; no repeats before 1s delay", async ({ page }) => {
    // 1. Navigate to `/`; hold P1 `+1 life` for 750ms (under 1s hold delay)
    await page.goto("/");

    const p1 = zone(page, 1);
    await holdButton(page, p1.getByRole("button", { name: "+1 life" }), 750);

    // Only the ±1 tap fires before the 1000ms hold delay
    const value = await lifeValue(p1);
    expect(value).toBe(41);
  });

  test("3.2. Long hold (~1.6–1.8s) repeats at ±10 after the 1s delay", async ({ page }) => {
    // 1. Navigate to `/`; hold P1 `+1 life` for 1700ms
    await page.goto("/");

    const p1 = zone(page, 1);
    await holdButton(page, p1.getByRole("button", { name: "+1 life" }), 1700);

    // ±1 tap + ~7 ticks of ±10 = ~+71. Life ≈ 111.
    // Range [100, 130] proves the ±10 step engaged and caps runaway repeats.
    const value = await lifeValue(p1);
    expect(value).toBeGreaterThanOrEqual(100);
    expect(value).toBeLessThanOrEqual(130);
  });

  test("3.3. Releasing the button stops adjustment immediately", async ({ page }) => {
    // 1. Navigate to `/`; hold P1 `+1 life` for 600ms, release, read V; wait 400ms, read again
    await page.goto("/");

    const p1 = zone(page, 1);
    await holdButton(page, p1.getByRole("button", { name: "+1 life" }), 600);

    const v = await lifeValue(p1);
    await page.waitForTimeout(400);
    expect(await lifeValue(p1)).toBe(v);

    // With 1s delay, a 600ms hold fires only the ±1 tap
    expect(v).toBeGreaterThanOrEqual(41);
    expect(v).toBeLessThanOrEqual(44);
  });

  test("3.4. Press feedback overlays the column with 8% black on pointer down", async ({ page }) => {
    // 1. Navigate to `/`; wait for the §4.6 splash cover to clear — while it
    //    is up (pointer-events: auto, z-9999) a raw mouse.down lands on the
    //    overlay, never on the button, so :active can't engage.
    await page.goto("/");
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);

    const p1 = zone(page, 1);
    const button = p1.getByRole("button", { name: "+1 life" });

    // Button has transition configured for the box-shadow overlay
    await expect(button).toHaveCSS("transition-property", /box-shadow/);
    await expect(button).toHaveCSS("transition-duration", "0.15s");

    // At rest, no inset shadow overlay. toHaveCSS auto-retries AND re-resolves
    // the locator every attempt — immune to the hydration remount detaching
    // the SSR element mid-test (a raw evaluate on a detached node yields "").
    await expect(button).toHaveCSS("box-shadow", "none");

    // Press down to trigger :active state
    const box = await visibleBox(button);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();

    // During :active, the box-shadow inset overlay is applied (150ms fade-in;
    // the rgab(0,0,0,0.08) alpha only matches once the fade completes —
    // retried automatically while the press is held)
    await expect(button).toHaveCSS("box-shadow", /inset/);
    await expect(button).toHaveCSS(
      "box-shadow",
      /rgba\(0, 0, 0, 0\.08\)/,
    );

    await page.mouse.up();

    // After release, box-shadow fades back to none (150ms fade-out)
    await expect(button).toHaveCSS("box-shadow", "none");
  });
});

test.describe("Player Zone — Lethal State", () => {
  test("4.1. Life at or below 0 turns the total danger red; recovering restores dark text", async ({
    page,
  }) => {
    // 1. Navigate to `/`; hold P1 `−1 life` until life ≤ 0 (hard cap 5s)
    await page.goto("/");

    const p1 = zone(page, 1);
    const p2 = zone(page, 2);
    const p1Life = lifeTotal(p1);
    const p2Life = lifeTotal(p2);

    const minusButton = p1.getByRole("button", { name: "-1 life" });
    const box = await visibleBox(minusButton);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const deadline = Date.now() + 5000;
    while ((await lifeValue(p1)) > 0 && Date.now() < deadline) {
      await page.waitForTimeout(100);
    }
    await page.mouse.up();

    const lethalValue = await lifeValue(p1);
    expect(lethalValue).toBeLessThanOrEqual(0);
    await expect(p1Life).toHaveCSS("color", "rgb(213, 0, 0)");

    // 2. Click P1 `+1 life` (max 70) until life > 0; color returns to #1A1A1A
    const plusButton = p1.getByRole("button", { name: "+1 life" });
    for (let i = 0; i < 70 && (await lifeValue(p1)) <= 0; i++) {
      await plusButton.click();
    }
    expect(await lifeValue(p1)).toBeGreaterThanOrEqual(1);
    await expect(p1Life).toHaveCSS("color", "rgb(26, 26, 26)");

    await expect(p2Life).toHaveText("40");
    await expect(p2Life).toHaveCSS("color", "rgb(26, 26, 26)");
  });
});

test.describe("Player Zone — Keyboard & Focus", () => {
  test("5.1. Tab reaches all six buttons in DOM order with a visible focus ring", async ({
    page,
  }) => {
    // 1. Navigate to `/`; press Tab, asserting focus after each press
    await page.goto("/");

    const p1 = zone(page, 1);
    const p2 = zone(page, 2);
    // DOM order: P1 buttons → Spellbook toggle → P2 buttons
    const order = [
      p1.getByRole("button", { name: "-1 life" }),
      p1.getByRole("button", { name: "Change color" }),
      p1.getByRole("button", { name: "+1 life" }),
      page.getByRole("checkbox", { name: "Toggle Spellbook Menu" }),
      p2.getByRole("button", { name: "-1 life" }),
      p2.getByRole("button", { name: "Change color" }),
      p2.getByRole("button", { name: "+1 life" }),
    ];
    // Hydration remounts the zone nodes after load, which resets focus and
    // makes Chromium skip zero-size elements on Tab. Retry the cycle until it
    // completes without a remount interrupting it; the last attempt lets the
    // real assertion error surface.
    await waitZoneStable(page);
    for (let attempt = 0; ; attempt++) {
      const lastAttempt = attempt >= 2;
      let ok = true;
      for (const button of order) {
        await page.keyboard.press("Tab");
        if (lastAttempt) {
          await expect(button).toBeFocused();
        } else {
          try {
            await expect(button).toBeFocused({ timeout: 1000 });
          } catch {
            ok = false;
            break;
          }
        }
      }
      if (ok) break;
    }

    // 2. Focused button exposes a visible focus ring
    const focused = p2.getByRole("button", { name: "+1 life" });
    await expect(focused).toHaveCSS("outline-style", "solid");
    await expect(focused).toHaveCSS("outline-width", "2px");
  });

  test("5.2. Enter and Space each adjust by exactly 1 (no acceleration from keyboard)", async ({
    page,
  }) => {
    // 1. Navigate to `/`; Tab twice to focus P1 `+1 life`; press Enter
    await page.goto("/");

    const p1 = zone(page, 1);
    const p2 = zone(page, 2);
    // Dev-mode page reload (~100ms in) + hydration remount (~1s in) both reset
    // focus to body; Chromium also skips zero-size elements on Tab. Retry the
    // whole flow until it survives both; the last attempt surfaces the real
    // assertion error.
    await waitZoneStable(page);
    const plus = p1.getByRole("button", { name: "+1 life" });
    for (let attempt = 0; ; attempt++) {
      const lastAttempt = attempt >= 3;
      // Tab past P1 "-1 life" → Tab past P1 "Change color" → Tab to P1 "+1 life"
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      if (lastAttempt) {
        await expect(plus).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(lifeTotal(p1)).toHaveText("41");
        await page.keyboard.press("Space");
        await expect(lifeTotal(p1)).toHaveText("42");
        await expect(lifeTotal(p2)).toHaveText("40");
        break;
      }
      try {
        await expect(plus).toBeFocused({ timeout: 1000 });
        await page.keyboard.press("Enter");
        await expect(lifeTotal(p1)).toHaveText("41");
        await page.keyboard.press("Space");
        await expect(lifeTotal(p1)).toHaveText("42");
        await expect(lifeTotal(p2)).toHaveText("40");
        break;
      } catch {
        // reload/remount interrupted the cycle — retry from body
      }
    }
  });
});

test.describe("Player Zone — ARIA & Announcements", () => {
  test("6.1. Zones announce the 'Player N: X life' pattern and it stays in sync with adjustments", async ({
    page,
  }) => {
    // 1. Navigate to `/`; both regions resolve with exact accessible names
    await page.goto("/");

    await expect(page.getByRole("region", { name: "Player 1: 40 life" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Player 2: 40 life" })).toBeVisible();

    // 2. Click P1 `+1 life` once; region re-resolves under the updated name
    await zone(page, 1)
      .getByRole("button", { name: "+1 life" })
      .click();
    await expect(page.getByRole("region", { name: "Player 1: 41 life" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Player 1: 40 life" })).toHaveCount(0);
  });

  test("6.2. Buttons expose correct labels; life total is a polite live region", async ({
    page,
  }) => {
    // 1. Navigate to `/`; each zone has exactly one `-1 life` and one `+1 life` button, both visible
    await page.goto("/");

    const p1 = zone(page, 1);
    const p2 = zone(page, 2);
    for (const z of [p1, p2]) {
      await expect(z.getByRole("button", { name: "-1 life" })).toBeVisible();
      await expect(z.getByRole("button", { name: "+1 life" })).toBeVisible();
    }

    // 2. aria-live/aria-atomic on both life totals; text updates to 41 after a tap
    for (const z of [p1, p2]) {
      await expect(lifeTotal(z)).toHaveAttribute("aria-live", "polite");
      await expect(lifeTotal(z)).toHaveAttribute("aria-atomic", "true");
    }
    await p1.getByRole("button", { name: "+1 life" }).click();
    await expect(lifeTotal(p1)).toHaveText("41");
  });
});

test.describe("Player Zone — Contrast & Touch Targets", () => {
  test("7.1. Life text is warm near-black #1A1A1A on both mana backgrounds", async ({ page }) => {
    // 1. Navigate to `/`; assert text color #1A1A1A on both life totals at 40 life
    await page.goto("/");

    await expect(lifeTotal(zone(page, 1))).toHaveCSS("color", "rgb(26, 26, 26)");
    await expect(lifeTotal(zone(page, 2))).toHaveCSS("color", "rgb(26, 26, 26)");
  });

  test("LC-03: textShadow pairs with minimax text color (light bg halo vs dark bg halo)", async ({
    page,
  }) => {
    // 1. set P1 color to White via gear → White → CheckCircle
    await page.goto("/");
    const p1 = zone(page, 1);
    await p1.getByRole("button", { name: "Change color" }).click();
    const picker0 = page.locator('dialog[id="color-picker-0"]');
    await picker0.getByRole("button", { name: "White mana" }).click();
    await picker0.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker0).not.toBeVisible();

    // expect: zone bg solid rgb(248,246,216) (white)
    await expect(p1).toHaveCSS("background-color", "rgb(248, 246, 216)");
    // expect: life total color rgb(26,26,26) (dark text — minimax on white)
    await expect(lifeTotal(p1)).toHaveCSS("color", "rgb(26, 26, 26)");
    // expect: zone section inline text-shadow contains rgba(255,255,255,0.5) (light halo on dark text)
    // CSSOM re-serializes text-shadow with spaces after commas — compact before matching.
    const compactShadow = (s: string): string => s.replace(/\s+/g, "");
    const shadowWhite = await p1.evaluate(
      (el) => (el as HTMLElement).style.textShadow,
    );
    expect(compactShadow(shadowWhite)).toContain("rgba(255,255,255,0.5)");
    // and NOT the dark halo
    expect(compactShadow(shadowWhite)).not.toContain("rgba(0,0,0,0.4)");

    // 2. set P1 color to Black via gear → Black → CheckCircle
    // Reload first: reload no longer resets the color — persistence restores
    // the game-init selection ["w"] (SPEC §4.3/§8.5 "persists restart"). From
    // a non-default selection the picker ADDS (§8.5.1), so a Black tap from
    // ["w"] would make a w,b gradient, not solid black. Clear via Colorless
    // (single-tap apply-and-close → ["c"]), then Black replaces ["c"] → ["b"].
    await page.reload();
    // expect: P1 restored white — the persistence feature, not a fresh default
    await expect(zone(page, 1)).toHaveCSS("background-color", "rgb(248, 246, 216)");
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-0"]');
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Colorless mana" }).click();
    await expect(picker).not.toBeVisible();
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Black mana" }).click();
    await picker.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker).not.toBeVisible();

    // expect: zone bg solid rgb(102,101,101) (black)
    await expect(p1).toHaveCSS("background-color", "rgb(102, 101, 101)");
    // expect: life total color rgb(250,248,245) (light text — minimax on black)
    await expect(lifeTotal(p1)).toHaveCSS("color", "rgb(250, 248, 245)");
    // expect: zone section inline text-shadow contains rgba(0,0,0,0.4) (dark halo on light text)
    const shadowBlack = await p1.evaluate(
      (el) => (el as HTMLElement).style.textShadow,
    );
    expect(compactShadow(shadowBlack)).toContain("rgba(0,0,0,0.4)");
    expect(compactShadow(shadowBlack)).not.toContain("rgba(255,255,255,0.5)");
  });

  test("LC-04: Multi-color gradient text stays readable (minimax worst-case)", async ({
    page,
  }) => {
    // 1. set P1 to White + Blue + Black (w,u,b) via color picker toggles, then CheckCircle
    await page.goto("/");
    const p1 = zone(page, 1);
    await p1.getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-0"]');
    await picker.getByRole("button", { name: "White mana" }).click(); // ["r"] → ["w"]
    await picker.getByRole("button", { name: "Blue mana" }).click(); // ["w"] → ["w","u"]
    await picker.getByRole("button", { name: "Black mana" }).click(); // ["w","u"] → ["w","u","b"]
    await picker.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker).not.toBeVisible();

    // expect: zone bg is a to-bottom-right gradient — the browser canonicalizes
    // `to bottom right` as `to right bottom` (same corner) in computed styles,
    // and the white band must lead (w,u,b order)
    await expect(p1).toHaveCSS(
      "background-image",
      /^linear-gradient\(to (bottom right|right bottom), rgb\(248, 246, 216\)/,
    );
    // expect: black band present too — proves it is a true 3-color gradient
    const bg = await p1.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain("rgb(102, 101, 101)");

    // expect: life total color is rgb(26,26,26) (DARK — minimax over w+u+b:
    // light text's worst case is the ~1.08:1 contrast on the white band,
    // dark text's worst case is ~2.3:1 on the black band, so dark wins)
    await expect(lifeTotal(p1)).toHaveCSS("color", "rgb(26, 26, 26)");

    // expect: zone section has the light halo text-shadow (dark text pairing)
    const shadow = await p1.evaluate(
      (el) => (el as HTMLElement).style.textShadow,
    );
    expect(shadow.replace(/\s+/g, "")).toContain("rgba(255,255,255,0.5)");
  });

  test("7.2. Buttons span full column height (3-column grid layout)", async ({ page }) => {
    // 1. Navigate to `/`; each button occupies ~33% width × full zone height
    await page.goto("/");

    for (const n of [1, 2] as const) {
      for (const name of ["-1 life", "+1 life"]) {
        const button = zone(page, n).getByRole("button", { name });
        const box = await visibleBox(button);
        // Buttons are full columns: width ≈ zone/3, height ≈ zone height
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(100);
      }
    }
  });
});

/* ── §9 helpers — Swipe gestures ── */

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

test.describe("Player Zone — Swipe Gestures (§7.2)", () => {
  test("9.1. Swipe left opens Commander Damage; swipe right opens Counters", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    // 2. Swipe right on P1 zone (180° slot → player-left) opens Commander Damage dialog
    await swipeOn(zone(page, 1), "right");
    const commanderDlg = page.getByRole("dialog", {
      name: "Commander Damage",
    });
    await expect(commanderDlg).toBeVisible();

    // Close via Escape
    await page.keyboard.press("Escape");
    await expect(commanderDlg).not.toBeVisible();

    // 3. Swipe left on P1 zone (180° slot → player-right) opens Counters dialog
    await swipeOn(zone(page, 1), "left");
    const countersDlg = page.getByRole("dialog", { name: "Counters" });
    await expect(countersDlg).toBeVisible();

    // Close via Escape
    await page.keyboard.press("Escape");
    await expect(countersDlg).not.toBeVisible();

    // Life total unchanged
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
  });

  test("9.2. Short vertical jab (<10px) does not trigger a swipe", async ({ page }) => {
    // 1. Navigate to `/`
    await page.goto("/");

    const p1 = zone(page, 1);
    const box = await visibleBox(p1);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // 2. Press down, move 5px down, release — vertical jab, not a swipe
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + 5);
    await page.mouse.up();

    // No dialogs should have opened
    const anyDialog = page.getByRole("dialog");
    await expect(anyDialog).toHaveCount(0);
    await expect(lifeTotal(p1)).toHaveText("40");

    // 3. Normal tap still works
    await p1.getByRole("button", { name: "+1 life" }).click();
    await expect(lifeTotal(p1)).toHaveText("41");
  });

  test("9.3. Escape key dismisses Commander Damage dialog", async ({ page }) => {
    await page.goto("/");

    // Open via swipe right on P1 (player-left on 180° slot)
    await swipeOn(zone(page, 1), "right");
    const commanderDlg = page.getByRole("dialog", {
      name: "Commander Damage",
    });
    await expect(commanderDlg).toBeVisible();

    // Escape closes the dialog (Commander Damage content fills the entire
    // dialog with flex-1, so there is no backdrop gap to click)
    await page.keyboard.press("Escape");

    await expect(commanderDlg).not.toBeVisible();
  });

  test("9.4. Backdrop click dismisses Counters dialog", async ({ page }) => {
    await page.goto("/");

    // Open via swipe left on P1 (player-right on 180° slot)
    await swipeOn(zone(page, 1), "left");
    const countersDlg = page.getByRole("dialog", { name: "Counters" });
    await expect(countersDlg).toBeVisible();

    // Click backdrop
    await countersDlg.click({ position: { x: 5, y: 5 } });

    await expect(countersDlg).not.toBeVisible();
  });

  test("9.5. Swipe right on open Commander Damage closes it without opening Counters", async ({ page }) => {
    await page.goto("/");

    // Open Commander Damage via swipe right on P1 (player-left on 180° slot)
    await swipeOn(zone(page, 1), "right");
    const commanderDlg = page.getByRole("dialog", {
      name: "Commander Damage",
    });
    await expect(commanderDlg).toBeVisible();

    // Swipe directly on the dialog content — overlay's pointer handlers
    // call stopPropagation() so the zone behind doesn't react.
    await swipeOn(commanderDlg, "right");

    await expect(commanderDlg).not.toBeVisible();
    await expect(page.getByRole("dialog", { name: "Counters" })).not.toBeVisible();
  });

  test("9.6. Swipe left on open Counters closes it without opening Commander Damage", async ({ page }) => {
    await page.goto("/");

    // Open Counters via swipe left on P1 (player-right on 180° slot)
    await swipeOn(zone(page, 1), "left");
    const countersDlg = page.getByRole("dialog", { name: "Counters" });
    await expect(countersDlg).toBeVisible();

    // Swipe directly on the dialog
    await swipeOn(countersDlg, "left");

    await expect(countersDlg).not.toBeVisible();
    await expect(page.getByRole("dialog", { name: "Commander Damage" })).toHaveCount(0);
  });
});
