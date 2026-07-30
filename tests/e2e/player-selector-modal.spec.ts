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

async function openPlayersModal(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await page.getByRole("button", { name: "Players" }).click();
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
});
