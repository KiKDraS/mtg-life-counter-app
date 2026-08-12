// spec: specs/qa-pipeline.plan.md §1 — Game Board Layouts
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers (aligned with player-zone.spec.ts patterns) ── */

function zone(page: Page, n: number): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function lifeTotal(zoneLocator: Locator): Locator {
  return zoneLocator.locator('[aria-live="polite"]');
}

const belt = (page: Page) => page.locator("#spellbook-toggle");

async function openBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).toBeChecked();
}

async function closeBelt(page: Page): Promise<void> {
  // Idempotent: action taps now auto-collapse the belt (DESIGN §5.2), so only
  // toggle the M logo when the belt is actually open — clicking it when the
  // belt already closed would RE-OPEN it.
  if (await belt(page).isChecked()) {
    await page.getByLabel("Open Spellbook Menu").click();
  }
  await expect(belt(page)).not.toBeChecked();
  // Belt container animates h-18 → h-0 over 300ms (CSS checkbox hack); wait
  // for the wrapper to reach 0px height so row geometry is settled before
  // bounding-box assertions.
  await expect(page.locator("div.relative.z-50").first()).toHaveCSS(
    "height",
    "0px",
  );
}

/** Open the Players modal, tap a player count (the tap auto-collapses the belt), then wait for the collapse to settle. */
async function selectPlayers(page: Page, count: number): Promise<void> {
  await openBelt(page);
  await page.getByRole("button", { name: "Players" }).click();
  await page.getByRole("button", { name: `${count} players` }).click();
  await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
  await closeBelt(page);
}

/** Read the inline transform of the region's wrapper (rotation div, §4.3). */
async function rotationOf(zoneLocator: Locator): Promise<string> {
  return zoneLocator.evaluate((el) => el.parentElement?.style.transform ?? "");
}

async function boxOf(zoneLocator: Locator): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const deadline = Date.now() + 10_000;
  let box = await zoneLocator.boundingBox();
  // Zone layout settles late (cqw/cqh container sizing + hydration remount);
  // single-shot boundingBox can be null right after load. Poll until real box.
  while (!box) {
    if (Date.now() > deadline) throw new Error("zone not visible for bounding box");
    await zoneLocator.page().waitForTimeout(100);
    box = await zoneLocator.boundingBox();
  }
  return box;
}

async function expectRotation(
  zoneLocator: Locator,
  expected: string,
): Promise<void> {
  const t = await rotationOf(zoneLocator);
  if (expected === "180") {
    expect(["rotate(180deg)", "matrix(-1, 0, 0, -1, 0, 0)"]).toContain(t);
  } else if (expected === "0") {
    expect(["rotate(0deg)", "none", ""]).toContain(t);
  } else {
    expect(t).toBe(`rotate(${expected}deg)`);
  }
}

/* ───────────────────────────────────────────────
 * §1 — Game Board Layouts (DESIGN §4.1/§4.3)
 * ─────────────────────────────────────────────── */

test.describe("Game Board Layouts", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("GB-01: 2p layout — P1 180°, P2 0°, equal vertical split (regression)", async ({
    page,
  }) => {
    // 1. goto / with viewport 390x844 (portrait)
    await page.goto("/");

    // expect: exactly 2 regions matching ^Player \d: life$
    const regions = page.getByRole("region", { name: /^Player \d:/ });
    await expect(regions).toHaveCount(2);

    // expect: P1 region y ≈ 0, height ≈ 422 (top half)
    const p1Box = await boxOf(zone(page, 1));
    expect(p1Box.y).toBeGreaterThanOrEqual(-2);
    expect(p1Box.y).toBeLessThanOrEqual(2);
    expect(Math.abs(p1Box.height - 844 / 2)).toBeLessThanOrEqual(2);

    // expect: P2 region y ≈ 422 (bottom half)
    const p2Box = await boxOf(zone(page, 2));
    expect(Math.abs(p2Box.y - 844 / 2)).toBeLessThanOrEqual(2);

    // expect: both heights equal ±2px
    expect(Math.abs(p1Box.height - p2Box.height)).toBeLessThanOrEqual(2);

    // 2. read P1 wrapper transform via region parentElement.style.transform
    // expect: P1 transform is rotate(180deg) (or matrix(-1,0,0,-1,0,0))
    await expectRotation(zone(page, 1), "180");

    // 3. read P2 wrapper transform
    // expect: P2 transform is none/rotate(0deg)
    await expectRotation(zone(page, 2), "0");
  });

  test("GB-02: 3p layout — P1 180° top, P2 90°, P3 −90°", async ({ page }) => {
    // 1. open belt → Players → tap 3 players
    await page.goto("/");
    await selectPlayers(page, 3);

    // expect: exactly 3 player regions
    const regions = page.getByRole("region", { name: /^Player \d:/ });
    await expect(regions).toHaveCount(3);

    // 2. read each region parent transform + bounding boxes
    // expect: P1: rotate(180deg), full-width top
    await expectRotation(zone(page, 1), "180");
    const p1Box = await boxOf(zone(page, 1));
    expect(p1Box.y).toBeGreaterThanOrEqual(-2);
    expect(p1Box.y).toBeLessThanOrEqual(2);
    expect(Math.abs(p1Box.width - 390)).toBeLessThanOrEqual(2);

    // expect: P2: rotate(90deg), left of bottom row
    await expectRotation(zone(page, 2), "90");
    const p2Box = await boxOf(zone(page, 2));

    // expect: P3: rotate(-90deg), right of bottom row
    await expectRotation(zone(page, 3), "-90");
    const p3Box = await boxOf(zone(page, 3));

    // expect: P2/P3 same height; P1 not shorter than either
    expect(Math.abs(p2Box.height - p3Box.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(p2Box.width - p3Box.width)).toBeLessThanOrEqual(2);
    expect(p1Box.height).toBeGreaterThanOrEqual(p2Box.height - 2);
    expect(p2Box.x).toBeLessThan(p3Box.x);
    expect(p2Box.y).toBeGreaterThanOrEqual(p1Box.y + p1Box.height - 2);
  });

  test("GB-03: 4p layout — all ±90° in 2×2 (regression)", async ({ page }) => {
    // 1. open belt → Players → tap 4 players
    await page.goto("/");
    await selectPlayers(page, 4);

    // expect: exactly 4 player regions
    const regions = page.getByRole("region", { name: /^Player \d:/ });
    await expect(regions).toHaveCount(4);

    // 2. read each region parent transform + bounding boxes
    // expect: P1: rotate(90deg), P2: rotate(-90deg) (top row)
    await expectRotation(zone(page, 1), "90");
    await expectRotation(zone(page, 2), "-90");
    // expect: P3: rotate(90deg), P4: rotate(-90deg) (bottom row)
    await expectRotation(zone(page, 3), "90");
    await expectRotation(zone(page, 4), "-90");

    // expect: 2×2 grid, equal quadrants
    const p1Box = await boxOf(zone(page, 1));
    const p2Box = await boxOf(zone(page, 2));
    const p3Box = await boxOf(zone(page, 3));
    const p4Box = await boxOf(zone(page, 4));
    // Sideways slots (w-[100cqh] h-[100cqw]) round container-query units to
    // subpixel — tolerance 4px instead of 2px (still catches misplacements).
    const TOL = 4;

    // top row: P1 left, P2 right, same y and equal heights
    expect(Math.abs(p1Box.y - p2Box.y)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(p1Box.height - p2Box.height)).toBeLessThanOrEqual(TOL);
    // bottom row: P3 left, P4 right
    expect(Math.abs(p3Box.y - p4Box.y)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(p3Box.height - p4Box.height)).toBeLessThanOrEqual(TOL);
    // rows split the viewport in half
    expect(Math.abs(p1Box.height - p3Box.height)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(p3Box.y - p1Box.y - p1Box.height)).toBeLessThanOrEqual(TOL);
    // equal widths (2 columns)
    expect(Math.abs(p1Box.width - p2Box.width)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(p1Box.width - 390 / 2)).toBeLessThanOrEqual(TOL);
  });

  test("GB-04: 5p layout — P1 180° big top, P2/P3 ±90°, P4/P5 ±90° bottom", async ({
    page,
  }) => {
    // 1. open belt → Players → tap 5 players
    await page.goto("/");
    await selectPlayers(page, 5);

    // expect: exactly 5 player regions
    const regions = page.getByRole("region", { name: /^Player \d:/ });
    await expect(regions).toHaveCount(5);

    // 2. read each region parent transform + bounding boxes
    // expect: P1: rotate(180deg), full-width, single row on top
    await expectRotation(zone(page, 1), "180");
    const p1Box = await boxOf(zone(page, 1));
    expect(p1Box.y).toBeGreaterThanOrEqual(-2);
    expect(Math.abs(p1Box.width - 390)).toBeLessThanOrEqual(2);

    // expect: P2: rotate(90deg), P3: rotate(-90deg) — same row below P1
    await expectRotation(zone(page, 2), "90");
    await expectRotation(zone(page, 3), "-90");
    const TOL = 4; // container-query subpixel rounding on sideways slots
    // Retry until the container-query reflow settles (belt close + sideways
    // slots can lag a frame under dev-server load — seen as a one-off flake).
    let p2Box: { x: number; y: number; width: number; height: number };
    await expect(async () => {
      p2Box = await boxOf(zone(page, 2));
      const p3Box = await boxOf(zone(page, 3));
      expect(Math.abs(p2Box.y - p3Box.y)).toBeLessThanOrEqual(TOL);
      expect(p2Box.y).toBeGreaterThanOrEqual(p1Box.y + p1Box.height - TOL);
      expect(p3Box.x).toBeGreaterThanOrEqual(p2Box.x + p2Box.width - TOL);
    }).toPass({ timeout: 5000 });

    // expect: P4: rotate(90deg), P5: rotate(-90deg) — bottom row (both still visible, no overlap)
    await expectRotation(zone(page, 4), "90");
    await expectRotation(zone(page, 5), "-90");
    await expect(async () => {
      const p4Box = await boxOf(zone(page, 4));
      const p5Box = await boxOf(zone(page, 5));
      expect(Math.abs(p4Box.y - p5Box.y)).toBeLessThanOrEqual(TOL);
      expect(p4Box.y).toBeGreaterThanOrEqual(p2Box.y + p2Box.height - TOL);
      expect(p4Box.y + p4Box.height).toBeLessThanOrEqual(844 + TOL);
      expect(p5Box.x).toBeGreaterThanOrEqual(p4Box.x + p4Box.width - TOL);
    }).toPass({ timeout: 5000 });

    // expect: player count 5 = top 3 + bottom 2 rows per §4.1
    await expect(regions).toHaveCount(5);
  });

  test("GB-05: 6p layout — P1 180°, P2–P5 ±90°, P6 0° bottom (new P6 slot)", async ({
    page,
  }) => {
    // 1. open belt → Players → tap 6 players
    await page.goto("/");
    await selectPlayers(page, 6);

    // expect: exactly 6 player regions
    const regions = page.getByRole("region", { name: /^Player \d:/ });
    await expect(regions).toHaveCount(6);

    // 2. read each region parent transform + bounding boxes
    // expect: P1: rotate(180deg), full-width top
    await expectRotation(zone(page, 1), "180");
    const p1Box = await boxOf(zone(page, 1));
    expect(p1Box.y).toBeGreaterThanOrEqual(-2);
    expect(Math.abs(p1Box.width - 390)).toBeLessThanOrEqual(2);

    // expect: P2: rotate(90deg), P3: rotate(-90deg) (row 2)
    await expectRotation(zone(page, 2), "90");
    await expectRotation(zone(page, 3), "-90");
    const p2Box = await boxOf(zone(page, 2));
    const p3Box = await boxOf(zone(page, 3));
    const TOL = 4; // container-query subpixel rounding on sideways slots
    expect(Math.abs(p2Box.y - p3Box.y)).toBeLessThanOrEqual(TOL);
    expect(p2Box.y).toBeGreaterThanOrEqual(p1Box.y + p1Box.height - TOL);

    // expect: P4: rotate(90deg), P5: rotate(-90deg) (row 3)
    await expectRotation(zone(page, 4), "90");
    await expectRotation(zone(page, 5), "-90");
    const p4Box = await boxOf(zone(page, 4));
    const p5Box = await boxOf(zone(page, 5));
    expect(Math.abs(p4Box.y - p5Box.y)).toBeLessThanOrEqual(TOL);
    expect(p4Box.y).toBeGreaterThanOrEqual(p2Box.y + p2Box.height - TOL);

    // expect: P6: rotate(0deg), full-width bottom row (playerId 5 slot renders, no blank gap)
    await expectRotation(zone(page, 6), "0");
    const p6Box = await boxOf(zone(page, 6));
    expect(Math.abs(p6Box.width - 390)).toBeLessThanOrEqual(TOL);
    expect(p6Box.y).toBeGreaterThanOrEqual(p4Box.y + p4Box.height - TOL);
    expect(p6Box.y + p6Box.height).toBeGreaterThanOrEqual(844 - TOL);

    // expect: each player life reads 40
    for (let n = 1; n <= 6; n++) {
      await expect(lifeTotal(zone(page, n))).toHaveText("40");
    }
  });

  test("GB-06: All layouts — every zone life 40, +1/-1 and gear work per zone", async ({
    page,
  }) => {
    // 1. for each of 3p, 5p, 6p layouts (select via Players modal), tap +1 life on the LAST player zone (P3/P5/P6)
    for (const count of [3, 5, 6]) {
      await page.goto("/");
      await selectPlayers(page, count);
      await expect(
        page.getByRole("region", { name: /^Player \d:/ }),
      ).toHaveCount(count);

      await zone(page, count).getByRole("button", { name: "+1 life" }).click();

      // expect: zone life reads 41
      await expect(lifeTotal(zone(page, count))).toHaveText("41");
      // expect: other zones still 40
      for (let n = 1; n < count; n++) {
        await expect(lifeTotal(zone(page, n))).toHaveText("40");
      }
      // expect: gear (Change color) button present in every zone
      for (let n = 1; n <= count; n++) {
        await expect(
          zone(page, n).getByRole("button", { name: "Change color" }),
        ).toBeVisible();
      }
    }
  });
});
