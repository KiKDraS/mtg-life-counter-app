// spec: specs/qa-modals.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers ── */

function zone(page: Page, n: number): Locator {
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

async function openPlayersModal(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await page.getByRole("button", { name: "Players" }).click();
}

async function closeBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(page.locator("#spellbook-toggle")).not.toBeChecked();
  // Belt container animates h-18 → h-0 over 300ms (CSS checkbox hack); wait
  // for the wrapper to reach 0px height so row geometry is settled before
  // swipe/click actions on zones.
  await expect(page.locator("div.relative.z-50").first()).toHaveCSS(
    "height",
    "0px",
  );
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
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(targetX, cy);
  await page.mouse.up();
}

/** Physical vertical swipe (used on ±90° slots where the player's horizontal axis is vertical on screen). */
async function swipeY(
  locator: Locator,
  direction: "up" | "down",
  distance = 80,
): Promise<void> {
  const box = await visibleBox(locator);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const targetY = direction === "up" ? cy - distance : cy + distance;
  const page = locator.page();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, targetY);
  await page.mouse.up();
}

function counterValue(dlg: Locator, name: string): Locator {
  // Find the `+1 ${name} counter` button, then return its preceding sibling
  // value span (`aria-live="polite"` is set on the <span> in CounterRow).
  const btn = dlg.getByRole("button", { name: `+1 ${name} counter` });
  return btn.locator("xpath=./preceding-sibling::*[@aria-live='polite']");
}

/* ───────────────────────────────────────────────
 * §5 — Player Selector Modal
 * ─────────────────────────────────────────────── */

test.describe("Player Selector Modal", () => {
  test("TC-5.1: Modal opens from belt", async ({ page }) => {
    // 1. Navigate to /
    await page.goto("/");

    // 2. Open belt and tap Players
    await openPlayersModal(page);

    // expect: Native dialog opens with id="player-selector-modal"
    const dialog = page.locator("dialog#player-selector-modal");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute("aria-labelledby", "player-selector-title");

    // expect: Heading text is "Players"
    const heading = dialog.locator("h2#player-selector-title");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Players");

    // expect: No ✕ close button
    await expect(dialog.getByRole("button", { name: /✕|×|close/i })).toHaveCount(0);
  });

  test("TC-5.2: All 5 SVG layouts visible", async ({ page }) => {
    // 1. Open Players modal
    await page.goto("/");
    await openPlayersModal(page);
    const dialog = page.locator("dialog#player-selector-modal");

    // expect: 5 SVG layout buttons
    await expect(dialog.getByRole("button", { name: "2 players" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "3 players" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "4 players" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "5 players" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "6 players" })).toBeVisible();
  });

  test("TC-5.3: Tap 2p shows 2 players", async ({ page }) => {
    // 1. Open Players modal and select 2 players (default, but verify)
    await page.goto("/");
    await openPlayersModal(page);
    await page.getByRole("button", { name: "2 players" }).click();

    // expect: Modal closes
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();

    // expect: Exactly 2 player zones visible
    await expect(zone(page, 1)).toBeVisible();
    await expect(zone(page, 2)).toBeVisible();
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);

    // expect: Life totals at 40
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
  });

  test("TC-5.4: Tap 4p from 2p shows 4 players (count UP)", async ({ page }) => {
    // 1. Start with 2 players
    await page.goto("/");
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);

    // 2. Open Players modal and select 4
    await openPlayersModal(page);
    await page.getByRole("button", { name: "4 players" }).click();

    // expect: Modal closes
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();

    // expect: 4 player zones visible
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(4);
    await expect(zone(page, 1)).toBeVisible();
    await expect(zone(page, 2)).toBeVisible();
    await expect(zone(page, 3)).toBeVisible();
    await expect(zone(page, 4)).toBeVisible();

    // expect: All at 40 life
    for (const n of [1, 2, 3, 4]) {
      await expect(lifeTotal(zone(page, n))).toHaveText("40");
    }
  });

  test("TC-5.5: Tap 2p from 4p shows 2 players (count DOWN)", async ({ page }) => {
    // 1. Start with 4 players
    await page.goto("/");
    await openPlayersModal(page);
    await page.getByRole("button", { name: "4 players" }).click();
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(4);

    // 2. Open Players modal and select 2
    await page.getByRole("button", { name: "Players" }).click();
    await page.getByRole("button", { name: "2 players" }).click();

    // expect: Modal closes
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();

    // expect: 2 player zones visible
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);
    await expect(zone(page, 1)).toBeVisible();
    await expect(zone(page, 2)).toBeVisible();
  });

  test("TC-5.7: Escape key closes modal without change", async ({ page }) => {
    // 1. Open Players modal (default 2 players)
    await page.goto("/");
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);

    await openPlayersModal(page);
    const dialog = page.locator("dialog#player-selector-modal");
    await expect(dialog).toBeVisible();

    // 2. Press Escape
    await page.keyboard.press("Escape");

    // expect: Modal closes
    await expect(dialog).not.toBeVisible();

    // expect: Player count unchanged (still 2)
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);
  });

  test("PS-01: Count UP 2→5 — new players appended with defaults, existing preserved", async ({
    page,
  }) => {
    // 1. set P1 color White; set initial life 30; tap P1 −2 (life 28)
    await page.goto("/");
    const p1 = zone(page, 1);
    await p1.getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-0"]');
    await picker.getByRole("button", { name: "White mana" }).click();
    await picker.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker).not.toBeVisible();
    await expect(p1).toHaveCSS("background-color", "rgb(248, 246, 216)");

    await page.getByLabel("Open Spellbook Menu").click();
    await page.getByRole("button", { name: "Initial Life" }).click();
    await page.getByRole("button", { name: "Set initial life to 30" }).click();
    await expect(page.locator("dialog#initial-life-modal")).not.toBeVisible();
    await closeBelt(page);
    await expect(lifeTotal(p1)).toHaveText("30");

    const minus = p1.getByRole("button", { name: "-1 life" });
    await minus.click();
    await minus.click();
    // expect: P1 white, life 28
    await expect(lifeTotal(p1)).toHaveText("28");

    // 2. open belt → Players → tap 5 players
    await openPlayersModal(page);
    await page.getByRole("button", { name: "5 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    await closeBelt(page);
    // expect: 5 regions
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(5);
    // expect: P1 still white with life 30 (common reset with new count)
    await expect(p1).toHaveCSS("background-color", "rgb(248, 246, 216)");
    await expect(lifeTotal(p1)).toHaveText("30");
    // expect: P2–P5 red default, all at 30
    for (const n of [2, 3, 4, 5]) {
      await expect(zone(page, n)).toHaveCSS(
        "background-color",
        "rgb(228, 153, 119)",
      );
      await expect(lifeTotal(zone(page, n))).toHaveText("30");
    }

    // 3. open P1 commander grid (180° slot → physical right)
    await swipeOn(p1, "right");
    const dlg = page.locator('dialog[id="commander-dmg-0"]');
    await expect(dlg).toBeVisible();
    // expect: 5 columns all 0 (array length = new player count)
    await expect(dlg.locator("span.rounded-full")).toHaveCount(5);
    await expect(dlg.getByRole("button", { name: "+1 commander damage" })).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(dlg.locator('[aria-live="polite"]').nth(i)).toHaveText("0");
    }
  });

  test("PS-02: Count DOWN 5→2 — removed players gone, commander arrays rebuilt", async ({
    page,
  }) => {
    // 1. select 5 players; open P1 grid, tap +4 on column 5, close
    await page.goto("/");
    await openPlayersModal(page);
    await page.getByRole("button", { name: "5 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    await closeBelt(page);

    await swipeOn(zone(page, 1), "right");
    const dlg5 = page.locator('dialog[id="commander-dmg-0"]');
    await expect(dlg5).toBeVisible();
    await expect(dlg5.locator("span.rounded-full")).toHaveCount(5);
    const col5 = dlg5.getByRole("button", { name: "+1 commander damage" }).nth(4);
    for (let i = 0; i < 4; i++) {
      await col5.click();
    }
    // expect: P1 life = 36, 5 columns
    await expect(dlg5.locator('[aria-live="polite"]').nth(4)).toHaveText("4");
    await expect(lifeTotal(zone(page, 1))).toHaveText("36");
    await page.keyboard.press("Escape");
    await expect(dlg5).not.toBeVisible();

    // 2. open belt → Players → tap 2 players
    await openPlayersModal(page);
    await page.getByRole("button", { name: "2 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    await closeBelt(page);
    // expect: 2 regions
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);
    // expect: P1 life reset to 40
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    // expect: P1 grid shows exactly 2 columns all 0 (damage array rebuilt for new count, §8.4.3)
    await swipeOn(zone(page, 1), "right");
    const dlg2 = page.locator('dialog[id="commander-dmg-0"]');
    await expect(dlg2).toBeVisible();
    await expect(dlg2.locator("span.rounded-full")).toHaveCount(2);
    await expect(dlg2.getByRole("button", { name: "+1 commander damage" })).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(dlg2.locator('[aria-live="polite"]').nth(i)).toHaveText("0");
    }
  });

  test("PS-03: Same count re-selected still performs common reset", async ({
    page,
  }) => {
    // 1. select 4 players; tap P1 −5 (life 35); add custom counter 'Lore' to P1
    await page.goto("/");
    await openPlayersModal(page);
    await page.getByRole("button", { name: "4 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    await closeBelt(page);

    const p1 = zone(page, 1);
    const minus = p1.getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 5; i++) {
      await minus.click();
    }
    // expect: life 35
    await expect(lifeTotal(p1)).toHaveText("35");

    // P1 at 4p sits on a 90° slot → player-right (Counters) is physical DOWN
    await swipeY(p1, "down");
    const counters = page.getByRole("dialog", { name: "Counters" });
    await expect(counters).toBeVisible();
    await counters.getByRole("button", { name: "Add custom counter" }).click();
    const custom = page.getByRole("dialog", { name: "Custom Counter" });
    await custom.getByRole("textbox", { name: "Counter name" }).fill("Lore");
    await page.keyboard.press("Enter");
    await expect(custom).not.toBeVisible();
    // expect: Lore present
    await expect(counters.locator('[aria-label="Lore counter"]')).toBeVisible();
    await expect(counterValue(counters, "Lore")).toHaveText("0");
    await page.keyboard.press("Escape");
    await expect(counters).not.toBeVisible();

    // 2. open belt → Players → tap 4 players again
    await openPlayersModal(page);
    await page.getByRole("button", { name: "4 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    await closeBelt(page);

    // expect: still exactly 4 players
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(4);
    // expect: life back to 40 (reset)
    await expect(lifeTotal(p1)).toHaveText("40");
    // expect: Lore cleared (custom counters cleared on common reset)
    await swipeY(p1, "down");
    const countersReopen = page.getByRole("dialog", { name: "Counters" });
    await expect(countersReopen).toBeVisible();
    await expect(
      countersReopen.locator('[aria-label="Lore counter"]'),
    ).toHaveCount(0);
    // exactly 4 default counters all at 0
    const rows = countersReopen.locator("div.grid > div");
    await expect(rows).toHaveCount(4);
    for (const name of ["poison", "energy", "experience", "time"]) {
      await expect(counterValue(countersReopen, name)).toHaveText("0");
    }
  });
});
