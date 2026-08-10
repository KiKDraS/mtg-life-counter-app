// spec: specs/qa-pipeline.plan.md §2 — Commander Damage 5/6-Player Grids
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers (aligned with commander-damage.spec.ts / player-zone.spec.ts patterns) ── */

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
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).not.toBeChecked();
  // Belt container animates h-18 → h-0 over 300ms (CSS checkbox hack); wait
  // for the wrapper to reach 0px height so row geometry is settled before
  // swipe/click actions on zones.
  await expect(page.locator("div.relative.z-50").first()).toHaveCSS(
    "height",
    "0px",
  );
}

/** Open the Players modal, tap a player count, close the belt (belt stays open after the modal). */
async function selectPlayers(page: Page, count: number): Promise<void> {
  await openBelt(page);
  await page.getByRole("button", { name: "Players" }).click();
  await page.getByRole("button", { name: `${count} players` }).click();
  await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
  await closeBelt(page);
}

/** Horizontal swipe (fast, <300ms). */
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

/** Vertical swipe (fast, <300ms) — used on ±90° slots where the player's horizontal axis is vertical on screen. */
async function swipeVertically(
  locator: Locator,
  direction: "up" | "down",
  distance = 80,
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element not visible for swipe");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const targetY = direction === "up" ? cy - distance : cy + distance;
  const page = locator.page();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, targetY);
  await page.mouse.up();
}

function commanderDlg(page: Page, playerId: number): Locator {
  return page.locator(`dialog[id="commander-dmg-${playerId}"]`);
}

function commanderPills(dlg: Locator): Locator {
  return dlg.locator("span.rounded-full");
}

function damageCounters(dlg: Locator): Locator {
  return dlg.locator('[aria-live="polite"]');
}

function plusButtons(dlg: Locator): Locator {
  return dlg.getByRole("button", { name: "+1 commander damage" });
}

async function expectAllDamageZero(dlg: Locator, count: number): Promise<void> {
  await expect(damageCounters(dlg)).toHaveCount(count);
  for (let i = 0; i < count; i++) {
    await expect(damageCounters(dlg).nth(i)).toHaveText("0");
  }
}

/* ───────────────────────────────────────────────
 * §2 — Commander Damage 5/6-Player Grids (SPEC §5–6, DESIGN §7.3)
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage — 5/6-Player Grids", () => {
  test("CD-01: 5p — P1 grid shows exactly 5 commander columns (player 0 slot fix)", async ({
    page,
  }) => {
    // 1. select 5 players; close belt; swipe physically RIGHT on P1 zone (180° slot → player-left)
    await page.goto("/");
    await selectPlayers(page, 5);
    await swipeOn(zone(page, 1), "right");

    // expect: dialog Commander Damage opens (id commander-dmg-0)
    const dlg = commanderDlg(page, 0);
    await expect(dlg).toBeVisible();

    // expect: exactly 5 pills (span.rounded-full) in the grid
    await expect(commanderPills(dlg)).toHaveCount(5);

    // expect: 5 +1 commander damage buttons
    await expect(plusButtons(dlg)).toHaveCount(5);

    // expect: grid has grid-cols-3 class for P1 on 5p
    await expect(dlg.locator(".grid").first()).toHaveClass(/grid-cols-3/);

    // expect: all damage counters read 0
    await expectAllDamageZero(dlg, 5);

    // 2. press Escape
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
  });

  test("CD-02: 5p — every non-P1 player grid also has 5 columns", async ({
    page,
  }) => {
    // 1. select 5 players; for each player P2..P5 open commander overlay via the
    //    correct physical swipe for its slot (P2/P4 90°: physical UP; P3/P5 −90°: physical DOWN)
    await page.goto("/");
    await selectPlayers(page, 5);

    const swipes: Array<{ n: number; pid: number; dir: "up" | "down" }> = [
      { n: 2, pid: 1, dir: "up" },
      { n: 3, pid: 2, dir: "down" },
      { n: 4, pid: 3, dir: "up" },
      { n: 5, pid: 4, dir: "down" },
    ];

    for (const { n, pid, dir } of swipes) {
      await swipeVertically(zone(page, n), dir);

      // expect: each dialog id commander-dmg-{pid} opens
      const dlg = commanderDlg(page, pid);
      await expect(dlg).toBeVisible();

      // expect: each grid contains exactly 5 pills (array length = player count invariant, never empty)
      await expect(commanderPills(dlg)).toHaveCount(5);
      // expect: 5 +1 buttons per dialog
      await expect(plusButtons(dlg)).toHaveCount(5);
      await expectAllDamageZero(dlg, 5);

      // 2. Escape between each
      await page.keyboard.press("Escape");
      await expect(dlg).not.toBeVisible();
    }
  });

  test("CD-03: 6p — P6 (playerId 5) grid shows 6 columns incl. own column (player 5 slot fix)", async ({
    page,
  }) => {
    // 1. select 6 players; close belt; swipe physically LEFT on P6 zone (0° slot → player-left)
    await page.goto("/");
    await selectPlayers(page, 6);
    await swipeOn(zone(page, 6), "left");

    // expect: dialog id commander-dmg-5 opens
    const dlg = commanderDlg(page, 5);
    await expect(dlg).toBeVisible();

    // expect: exactly 6 pills (incl. P6's own commander column, playerId 5)
    await expect(commanderPills(dlg)).toHaveCount(6);
    // expect: 6 +1 commander damage buttons
    await expect(plusButtons(dlg)).toHaveCount(6);
    // expect: grid-cols-3 for P6 on 6p
    await expect(dlg.locator(".grid").first()).toHaveClass(/grid-cols-3/);

    // 2. tap the LAST column + button twice (P6's own commander)
    const lastPlus = plusButtons(dlg).last();
    await lastPlus.click();
    await lastPlus.click();

    // expect: last column counter reads 2
    await expect(damageCounters(dlg).last()).toHaveText("2");
    // expect: P6 zone life reads 38 (40 − 2 coupling)
    await expect(lifeTotal(zone(page, 6))).toHaveText("38");
    // expect: other columns still 0
    for (let i = 0; i < 5; i++) {
      await expect(damageCounters(dlg).nth(i)).toHaveText("0");
    }

    // 3. press Escape
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
  });

  test("CD-04: 6p — per-column damage + life coupling independent across columns", async ({
    page,
  }) => {
    // 1. select 6 players; open P1 commander grid (swipe physical RIGHT on P1)
    await page.goto("/");
    await selectPlayers(page, 6);
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page, 0);
    await expect(dlg).toBeVisible();

    // expect: 6 columns, all 0
    await expectAllDamageZero(dlg, 6);

    // 2. tap +3 on column 2 (P2's commander), +4 on column 6 (P6's commander)
    const col2 = plusButtons(dlg).nth(1);
    const col6 = plusButtons(dlg).nth(5);
    for (let i = 0; i < 3; i++) await col2.click();
    for (let i = 0; i < 4; i++) await col6.click();

    // expect: col2 = 3, col6 = 4, others 0
    await expect(damageCounters(dlg).nth(1)).toHaveText("3");
    await expect(damageCounters(dlg).nth(5)).toHaveText("4");
    for (const i of [0, 2, 3, 4]) {
      await expect(damageCounters(dlg).nth(i)).toHaveText("0");
    }

    // expect: P1 life = 40 − 7 = 33
    await expect(lifeTotal(zone(page, 1))).toHaveText("33");
    // expect: P2..P6 zone life unchanged at 40
    for (let n = 2; n <= 6; n++) {
      await expect(lifeTotal(zone(page, n))).toHaveText("40");
    }

    // 3. close via Escape, reopen P1 grid
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
    await swipeOn(zone(page, 1), "right");
    const dlgReopen = commanderDlg(page, 0);
    await expect(dlgReopen).toBeVisible();

    // expect: values persist (3 and 4)
    await expect(damageCounters(dlgReopen).nth(1)).toHaveText("3");
    await expect(damageCounters(dlgReopen).nth(5)).toHaveText("4");
    // expect: P1 life still 33
    await expect(lifeTotal(zone(page, 1))).toHaveText("33");
  });

  test("CD-05: Lethal on 5p grid — ≥21 on any column turns damage + life danger red with badge", async ({
    page,
  }) => {
    // 1. select 5 players; open P1 commander grid
    await page.goto("/");
    await selectPlayers(page, 5);
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page, 0);
    await expect(dlg).toBeVisible();

    // expect: 5 columns at 0
    await expectAllDamageZero(dlg, 5);

    // 2. tap the 5th column (P5's commander) +21 times
    const col5 = plusButtons(dlg).nth(4);
    for (let i = 0; i < 21; i++) {
      await col5.click();
    }

    // expect: 5th column counter reads 21 and color = rgb(213,0,0) (#D50000)
    await expect(damageCounters(dlg).nth(4)).toHaveText("21");
    await expect(damageCounters(dlg).nth(4)).toHaveCSS(
      "color",
      "rgb(213, 0, 0)",
    );

    // expect: P1 life = 19 and color = rgb(213,0,0)
    await expect(lifeTotal(zone(page, 1))).toHaveText("19");
    await expect(lifeTotal(zone(page, 1))).toHaveCSS(
      "color",
      "rgb(213, 0, 0)",
    );

    // expect: badge text 'Commander Damage Lethal' visible under P1 life (life > 0)
    await expect(zone(page, 1).getByText("Commander Damage Lethal")).toBeVisible();

    // expect: no [-] button exists in any column (no UI to reduce damage)
    await expect(dlg.getByRole("button", { name: /-/ })).toHaveCount(0);
  });

  test("CD-06: Commander pill color follows owner's color picker selection (color sync regression)", async ({
    page,
  }) => {
    // 1. set P2 color to Blue via gear → Blue mana → CheckCircle
    await page.goto("/");
    await zone(page, 2).getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-1"]');
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Blue mana" }).click();
    await picker.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker).not.toBeVisible();

    // expect: P2 zone background solid rgb(193,215,233)
    await expect(zone(page, 2)).toHaveCSS(
      "background-color",
      "rgb(193, 215, 233)",
    );

    // 2. open P1 commander grid (2p) and read pill background colors
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page, 0);
    await expect(dlg).toBeVisible();
    await expect(commanderPills(dlg)).toHaveCount(2);

    // expect: column for playerId 1 (P2's commander) pill bg = rgb(193,215,233) (blue)
    await expect(commanderPills(dlg).nth(1)).toHaveCSS(
      "background-color",
      "rgb(193, 215, 233)",
    );
    // expect: P1's own column pill = rgb(228,153,119) (red default)
    await expect(commanderPills(dlg).nth(0)).toHaveCSS(
      "background-color",
      "rgb(228, 153, 119)",
    );
  });

  test("CD-07: Reset rebuilds commanderDamage array for new player count (count change)", async ({
    page,
  }) => {
    // 1. select 5 players; open P1 grid; tap +5 on any column; close
    await page.goto("/");
    await selectPlayers(page, 5);
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page, 0);
    await expect(dlg).toBeVisible();
    const col = plusButtons(dlg).first();
    for (let i = 0; i < 5; i++) {
      await col.click();
    }
    await expect(damageCounters(dlg).first()).toHaveText("5");
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();

    // 2. select 3 players via Players modal
    await selectPlayers(page, 3);
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      3,
    );

    // expect: P1 grid reopened shows exactly 3 columns, all 0 (array rebuilt Array.from({length: playerCount}))
    await swipeOn(zone(page, 1), "right");
    const dlg3 = commanderDlg(page, 0);
    await expect(dlg3).toBeVisible();
    await expect(commanderPills(dlg3)).toHaveCount(3);
    await expect(plusButtons(dlg3)).toHaveCount(3);
    await expectAllDamageZero(dlg3, 3);

    // expect: P1 life reset to 40 (common reset §8.1)
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
  });
});
