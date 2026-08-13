// spec: specs/commander-overflow-swipe.spec.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers (local copies — no cross-file imports, per repo convention) ── */

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
  // Idempotent: action taps now auto-collapse the belt (DESIGN §5.2), so only
  // toggle the M logo when the belt is actually open — clicking it when the
  // belt already closed would RE-OPEN it.
  if (await belt(page).isChecked()) {
    await page.getByLabel("Open Spellbook Menu").click();
  }
  await expect(belt(page)).not.toBeChecked();
  // Belt container animates h-18 → h-0 over 300ms (CSS checkbox hack); wait
  // for the wrapper to reach 0px height so row geometry is settled before
  // swipe/click actions on zones.
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

/** Horizontal mouse swipe (fast, <300ms) — fine for OPENING overlays (pointerup path never gets claimed). */
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

/** Vertical mouse swipe — used on ±90° slots where the player's horizontal axis is vertical on screen. */
async function swipeVertically(
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

function commanderDlg(page: Page, playerId: number): Locator {
  return page.locator(`dialog[id="commander-dmg-${playerId}"]`);
}

function commanderPills(dlg: Locator): Locator {
  return dlg.locator("span.rounded-full");
}

function plusButtons(dlg: Locator): Locator {
  return dlg.getByRole("button", { name: "+1 commander damage" });
}

/**
 * CDP TOUCH swipe — the ONLY way to reproduce the overflow close-swipe bug:
 * Chromium only claims drags as native scroll/pan for TOUCH pointers, so a
 * mouse swipe never triggers the (0,0) pointercancel path the fix addresses.
 * With the pre-fix state (inner grid overflow:auto, touch-action auto) this
 * same gesture leaves the dialog OPEN.
 *
 * Emulation.setTouchEmulationEnabled + Input.dispatchTouchEvent:
 * touchStart at the given point, 5 touchMove steps of +distance/5 along the
 * close direction, touchEnd. Touch emulation is disabled afterwards.
 */
async function touchSwipe(
  page: Page,
  point: { x: number; y: number },
  direction: "left" | "right" | "up" | "down",
  distance = 50,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  const dx =
    direction === "left" ? -distance : direction === "right" ? distance : 0;
  const dy =
    direction === "up" ? -distance : direction === "down" ? distance : 0;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.x, y: point.y }],
  });
  for (let i = 1; i <= 5; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + (dx * i) / 5, y: point.y + (dy * i) / 5 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
}

/**
 * OVF regression core (dialog must be open):
 * 1. Overflow precondition — content taller than the zone-sized dialog.
 * 2. Fix surface — dialog itself scrolls (overflow-y auto) with
 *    rotation-matched touch-action (pan-y non-sideways / pan-x sideways).
 * 3. Wheel scroll reaches the hidden content (scrollTop > 0).
 * 4. CDP TOUCH close-swipe still closes the dialog with overflow active.
 */
async function expectOverflowSwipeClose(
  page: Page,
  dlg: Locator,
  expectedTouchAction: "pan-y" | "pan-x",
  closeDir: "left" | "right" | "up" | "down",
  playerN: number,
): Promise<void> {
  // expect: scrollHeight > clientHeight (dialog content overflows the zone-sized dialog)
  const clientHeight = await dlg.evaluate((el) => el.clientHeight);
  await expect
    .poll(async () => dlg.evaluate((el) => el.scrollHeight))
    .toBeGreaterThan(clientHeight);
  // expect: the DIALOG is the scroll surface (overflow-y auto, not the inner grid)
  await expect(dlg).toHaveCSS("overflow-y", "auto");
  // expect: rotation-matched touch-action keeps the close-swipe axis unclaimed
  await expect(dlg).toHaveCSS("touch-action", expectedTouchAction);
  // expect: wheel over the dialog scrolls it (content reachable)
  const box = await visibleBox(dlg);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, 60);
  await expect
    .poll(async () => dlg.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  // expect: CDP TOUCH close-swipe closes the dialog with overflow active
  await touchSwipe(page, { x: cx, y: cy }, closeDir, 50);
  await expect(dlg).not.toBeVisible();
  await expect(page.getByRole("dialog", { name: "Counters" })).toHaveCount(0);
  await expect(lifeTotal(zone(page, playerN))).toHaveText("40");
}

/* ───────────────────────────────────────────────
 * §1 — Commander Damage Overflow Scroll + Swipe Close (regression)
 * ─────────────────────────────────────────────── */

test.describe("Commander Damage — Overflow Scroll + Swipe Close (regression)", () => {
  test("OVF-01: Compact viewport (320x568) 5 and 6 players — P1 commander dialog scrolls AND swipe-close works", async ({
    page,
  }) => {
    for (const playerCount of [5, 6]) {
      // 1. fresh state: 320x568 viewport, goto / (goto is the fresh load)
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/");
      // expect: page loads; Player 1 zone visible
      await expect(zone(page, 1)).toBeVisible();

      // 2. set the player count via the spellbook belt
      await selectPlayers(page, playerCount);
      // expect: player-selector-modal closed; exactly playerCount zones
      await expect(
        page.getByRole("region", { name: /^Player \d:/ }),
      ).toHaveCount(playerCount);

      // 3. open P1's commander dialog with the mouse helper — physical RIGHT on
      //    the 180° slot opens Commander Damage (opening uses the pointerup
      //    path that never gets claimed; touch only needed for closing)
      await swipeOn(zone(page, 1), "right");
      const dlg = commanderDlg(page, 0);
      // expect: dialog visible with exactly playerCount commander pills
      await expect(dlg).toBeVisible();
      await expect(commanderPills(dlg)).toHaveCount(playerCount);

      // 4-7. overflow precondition + fix surface (pan-y, P1 is 180°) + wheel
      //      scroll + CDP touch close-swipe (physical RIGHT)
      await expectOverflowSwipeClose(page, dlg, "pan-y", "right", 1);
    }
  });

  test("OVF-02: Compact viewport 6 players — P6 commander dialog (playerId 5, own column) scrolls AND swipe-close works", async ({
    page,
  }) => {
    // 1. fresh state: viewport 320x568, goto /
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");

    // 2. select 6 players via the belt
    await selectPlayers(page, 6);
    // expect: 6 zone regions visible
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      6,
    );

    // 3. open P6's commander dialog — physical LEFT on the 0° bottom slot
    //    (LAYOUT_MAP[6] index 5 = 0, mirrors CD-03)
    await swipeOn(zone(page, 6), "left");
    const dlg = commanderDlg(page, 5);
    // expect: dialog visible with 6 commander pills (incl. P6's own column)
    await expect(dlg).toBeVisible();
    await expect(commanderPills(dlg)).toHaveCount(6);
    // expect: 6 '+1 commander damage' buttons
    await expect(plusButtons(dlg)).toHaveCount(6);

    // 4-7. overflow precondition + fix surface (pan-y, P6 is 0° non-sideways)
    //      + wheel scroll + CDP touch close-swipe (physical LEFT)
    await expectOverflowSwipeClose(page, dlg, "pan-y", "left", 6);
  });

  test("OVF-04 (addition): Compact viewport 6 players — sideways slot dialog (P2, 90°, pan-x) scrolls AND vertical swipe-close works", async ({
    page,
  }) => {
    // 1. fresh state: viewport 320x568, goto /, select 6 players
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    await selectPlayers(page, 6);
    // expect: 6 zone regions visible
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      6,
    );

    // 2. open P2's commander dialog — physical UP on the 90° sideways slot
    //    (player-left = physical UP, mirrors SW-03)
    await swipeVertically(zone(page, 2), "up");
    const dlg = commanderDlg(page, 1);
    // expect: dialog visible with 6 commander pills
    await expect(dlg).toBeVisible();
    await expect(commanderPills(dlg)).toHaveCount(6);

    // 3-6. overflow precondition (P2 zone 160x170 → heavy overflow) + fix
    //      surface (pan-x: the vertical close axis is NOT claimable as native
    //      pan) + wheel scroll + CDP touch close-swipe (physical UP)
    await expectOverflowSwipeClose(page, dlg, "pan-x", "up", 2);
  });

  test("OVF-03: Default viewport (1280x720) — no overflow; existing suites are the regression scope", async ({
    page,
  }) => {
    // 1. restore the default viewport (compact-viewport tests override it),
    //    then 6 players via the belt
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await selectPlayers(page, 6);
    await swipeOn(zone(page, 1), "right");
    const dlg = commanderDlg(page, 0);
    // expect: dialog opens
    await expect(dlg).toBeVisible();

    // 2. NO overflow at default viewport: scrollHeight === clientHeight
    //    (144 === 144 — no scrollable overflow at normal size)
    const metrics = await dlg.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollHeight).toBe(metrics.clientHeight);

    // 3. mouse swipe close still closes the dialog (non-overflow path
    //    unchanged — the existing suites cover this path as regression scope)
    await swipeOn(dlg, "right");
    // expect: dialog closed, Counters not opened
    await expect(dlg).not.toBeVisible();
    await expect(page.getByRole("dialog", { name: "Counters" })).toHaveCount(0);
  });
});
