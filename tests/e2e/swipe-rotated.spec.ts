// spec: specs/qa-pipeline.plan.md §3 — Swipe Player-Relative Direction
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

const belt = (page: Page) => page.locator("#spellbook-toggle");

async function openBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).toBeChecked();
}

async function closeBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).not.toBeChecked();
  // Belt container animates h-18 → h-0 over 300ms (CSS checkbox hack); wait
  // for the wrapper to reach 0px height so row geometry is settled before
  // swipe actions on zones.
  await expect(page.locator("div.relative.z-50").first()).toHaveCSS(
    "height",
    "0px",
  );
}

async function selectPlayers(page: Page, count: number): Promise<void> {
  await openBelt(page);
  await page.getByRole("button", { name: "Players" }).click();
  await page.getByRole("button", { name: `${count} players` }).click();
  await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
  await closeBelt(page);
}

/** Physical horizontal swipe. delay: hold duration before move (0 = immediate, >300ms = too slow). */
async function swipeX(
  locator: Locator,
  direction: "left" | "right",
  distance = 50,
  holdMs = 0,
): Promise<void> {
  const box = await visibleBox(locator);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const targetX = direction === "left" ? cx - distance : cx + distance;
  const page = locator.page();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  await page.mouse.move(targetX, cy);
  await page.mouse.up();
}

/** Physical vertical swipe (used on ±90° slots). */
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

async function expectNoDialog(page: Page): Promise<void> {
  await expect(
    page.locator("dialog[open]"),
  ).toHaveCount(0);
}

/* ───────────────────────────────────────────────
 * §3 — Swipe Player-Relative Direction (DESIGN §4.2/§7.2)
 * ─────────────────────────────────────────────── */

test.describe("Swipe Player-Relative Direction", () => {
  test("SW-01: 0° slot (P2 in 2p) — physical left = Commander, physical right = Counters", async ({
    page,
  }) => {
    // 1. goto / (2p); swipe physically LEFT on P2 zone
    await page.goto("/");
    await swipeX(zone(page, 2), "left");
    // expect: Commander Damage dialog opens (id commander-dmg-1)
    await expect(page.locator('dialog[id="commander-dmg-1"]')).toBeVisible();

    // 2. Escape; swipe physically RIGHT on P2 zone
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[id="commander-dmg-1"]')).not.toBeVisible();
    await swipeX(zone(page, 2), "right");
    // expect: Counters dialog opens (id counters-1)
    await expect(page.locator('dialog[id="counters-1"]')).toBeVisible();
  });

  test("SW-02: 180° slot (P1) — physical direction INVERTED: right = Commander, left = Counters", async ({
    page,
  }) => {
    // 1. goto /; swipe physically RIGHT on P1 zone
    await page.goto("/");
    await swipeX(zone(page, 1), "right");
    // expect: Commander Damage opens (id commander-dmg-0)
    await expect(page.locator('dialog[id="commander-dmg-0"]')).toBeVisible();

    // 2. Escape; swipe physically LEFT on P1 zone
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[id="commander-dmg-0"]')).not.toBeVisible();
    await swipeX(zone(page, 1), "left");
    // expect: Counters opens (id counters-0)
    await expect(page.locator('dialog[id="counters-0"]')).toBeVisible();

    // 3. close via Escape
    await page.keyboard.press("Escape");
    // expect: no dialogs open
    await expectNoDialog(page);
  });

  test("SW-03: 90° slot (P2 in 5p) — physical UP = Commander, physical DOWN = Counters", async ({
    page,
  }) => {
    // 1. select 5 players; close belt; on P2 zone swipe physically UP (80px)
    await page.goto("/");
    await selectPlayers(page, 5);
    await swipeY(zone(page, 2), "up");
    // expect: Commander Damage opens (id commander-dmg-1)
    await expect(page.locator('dialog[id="commander-dmg-1"]')).toBeVisible();

    // 2. Escape; on P2 zone swipe physically DOWN
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[id="commander-dmg-1"]')).not.toBeVisible();
    await swipeY(zone(page, 2), "down");
    // expect: Counters opens (id counters-1)
    await expect(page.locator('dialog[id="counters-1"]')).toBeVisible();

    // 3. close via Escape
    await page.keyboard.press("Escape");
    // expect: no dialogs open
    await expectNoDialog(page);
  });

  test("SW-04: −90° slot (P3 in 5p) — physical DOWN = Commander, physical UP = Counters", async ({
    page,
  }) => {
    // 1. select 5 players; on P3 zone swipe physically DOWN
    await page.goto("/");
    await selectPlayers(page, 5);
    await swipeY(zone(page, 3), "down");
    // expect: Commander Damage opens (id commander-dmg-2)
    await expect(page.locator('dialog[id="commander-dmg-2"]')).toBeVisible();

    // 2. Escape; on P3 zone swipe physically UP
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[id="commander-dmg-2"]')).not.toBeVisible();
    await swipeY(zone(page, 3), "up");
    // expect: Counters opens (id counters-2)
    await expect(page.locator('dialog[id="counters-2"]')).toBeVisible();

    // 3. close via Escape
    await page.keyboard.press("Escape");
    // expect: no dialogs open
    await expectNoDialog(page);
  });

  test("SW-05: Sideways slots ignore physical horizontal swipes (player-vertical)", async ({
    page,
  }) => {
    // 1. select 5 players; on P2 (90°) swipe physically LEFT 50px, release
    await page.goto("/");
    await selectPlayers(page, 5);
    await swipeX(zone(page, 2), "left");
    // expect: no dialog opens
    await expectNoDialog(page);
    // expect: P2 life unchanged 40
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");

    // 2. on P3 (−90°) swipe physically RIGHT 50px
    await swipeX(zone(page, 3), "right");
    // expect: no dialog opens
    await expectNoDialog(page);
    // expect: P3 life unchanged 40
    await expect(lifeTotal(zone(page, 3))).toHaveText("40");

    // 3. on P3 swipe physically RIGHT with distance 8px (below 10px threshold)
    await swipeX(zone(page, 3), "right", 8);
    // expect: no dialog opens
    await expectNoDialog(page);
  });

  test("SW-06: Threshold + timeout + overlay close on rotated slots", async ({
    page,
  }) => {
    // 1. select 5 players; on P1 (180°) hold pointer down 400ms then drag 60px right and release (exceeds 300ms)
    await page.goto("/");
    await selectPlayers(page, 5);
    await swipeX(zone(page, 1), "right", 60, 400);
    // expect: no dialog opens (too slow)
    await expectNoDialog(page);

    // 2. on P1 swipe physically RIGHT to open Commander, then swipe physically RIGHT again on the open overlay
    await swipeX(zone(page, 1), "right");
    await expect(page.locator('dialog[id="commander-dmg-0"]')).toBeVisible();
    await swipeX(page.locator('dialog[id="commander-dmg-0"]'), "right");
    // expect: dialog closes (any X-swipe on overlay closes, either direction)
    await expect(page.locator('dialog[id="commander-dmg-0"]')).not.toBeVisible();
    // expect: Counters NOT opened by the close swipe
    await expect(page.locator('dialog[id="counters-0"]')).not.toBeVisible();
    await expectNoDialog(page);
  });
});
