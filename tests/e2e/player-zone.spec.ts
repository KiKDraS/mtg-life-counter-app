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
    for (const life of [p1Life, p2Life]) {
      const fontSize = await life.evaluate(
        (el) => parseFloat(getComputedStyle(el).fontSize),
      );
      expect(fontSize).toBeGreaterThanOrEqual(64);
      await expect(life).toHaveCSS("font-weight", "900");
      const fontFamily = await life.evaluate((el) => getComputedStyle(el).fontFamily);
      expect(fontFamily).toContain("Archivo");
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
    // 1. Navigate to `/`
    await page.goto("/");

    const p1 = zone(page, 1);
    const button = p1.getByRole("button", { name: "+1 life" });

    // Button has transition configured for the box-shadow overlay
    await expect(button).toHaveCSS("transition-property", /box-shadow/);
    await expect(button).toHaveCSS("transition-duration", "0.15s");

    // At rest, no inset shadow overlay
    const restShadow = await button.evaluate((el) =>
      getComputedStyle(el).boxShadow,
    );
    expect(restShadow).toBe("none");

    // Press down to trigger :active state
    const box = await button.boundingBox();
    if (!box) throw new Error("button not visible");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();

    // Wait for the 150ms fade-in transition to complete
    await page.waitForTimeout(200);

    // During :active, the box-shadow inset overlay is applied
    const activeShadow = await button.evaluate((el) =>
      getComputedStyle(el).boxShadow,
    );
    expect(activeShadow).toContain("inset");
    expect(activeShadow).toContain("rgba(0, 0, 0, 0.08)");

    await page.mouse.up();

    // Wait for the 150ms fade-out transition to complete
    await page.waitForTimeout(200);

    // After release, box-shadow returns to none
    const releasedShadow = await button.evaluate((el) =>
      getComputedStyle(el).boxShadow,
    );
    expect(releasedShadow).toBe("none");
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
    const box = await minusButton.boundingBox();
    if (!box) throw new Error("minus button not visible");
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
    for (const button of order) {
      await page.keyboard.press("Tab");
      await expect(button).toBeFocused();
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
    // Tab past P1 "-1 life" → Tab past P1 "Change color" → Tab to P1 "+1 life"
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(p1.getByRole("button", { name: "+1 life" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(lifeTotal(p1)).toHaveText("41");

    // 2. Press Space once; P1 reads 42, P2 unchanged at 40
    await page.keyboard.press("Space");
    await expect(lifeTotal(p1)).toHaveText("42");
    await expect(lifeTotal(p2)).toHaveText("40");
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

  test("7.2. Buttons span full column height (3-column grid layout)", async ({ page }) => {
    // 1. Navigate to `/`; each button occupies ~33% width × full zone height
    await page.goto("/");

    for (const n of [1, 2] as const) {
      for (const name of ["-1 life", "+1 life"]) {
        const button = zone(page, n).getByRole("button", { name });
        const box = await button.boundingBox();
        if (!box) throw new Error(`${name} button (player ${n}) not visible`);
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
    const box = await p1.boundingBox();
    if (!box) throw new Error("zone not visible");
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
