// spec: specs/qa-pipeline.plan.md §8 — RSC / Architecture / PWA Smoke
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

/** Physical horizontal swipe (fast, <300ms). */
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

/**
 * Returns errors collected so far for the given page.
 * Skips the Vercel script 404 pair: off-Vercel, `/_vercel/{speed-insights,insights}/script.js`
 * 404s (generic resource error + strict-MIME refusal) — benign, PR #122
 * artifact; Web Analytics added by feature/vercel-analytics, same self-host 404.
 */
function consoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.text().includes("_vercel/")) return;
    if (msg.text() === "Failed to load resource: the server responded with a status of 404 (Not Found)")
      return;
    errors.push(msg.text());
  });
  return errors;
}

/* ───────────────────────────────────────────────
 * §8 — RSC / Architecture / PWA Smoke
 * ─────────────────────────────────────────────── */

test.describe("RSC / Architecture / PWA Smoke", () => {
  test("SM-01: App loads — zero console errors, title, 2 zones (GameShell split sanity)", async ({
    page,
  }) => {
    // 1. goto /; collect console messages of level error
    const errors = consoleErrors(page);
    await page.goto("/");

    // expect: 0 error-level console messages (orientation-lock warning is acceptable)
    // expect: document.title == 'MTG Life Counter'
    await expect(page).toHaveTitle("MTG Life Counter");
    // expect: 2 player zones at 40 life
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");

    // 2. reload page and re-check console
    await page.reload();
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);
    // expect: 0 errors after hydration (no RSC/client mismatch)
    expect(errors).toEqual([]);

    // 3. exercise GameShell donut-hole: open belt → Players modal, interact, close
    // expect: belt + modals render/behave while player grid renders around them (RSC children pass-through)
    await openBelt(page);
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await page.getByRole("button", { name: "Players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).toBeVisible();
    await page.getByRole("button", { name: "3 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(3);
    await expect(lifeTotal(zone(page, 3))).toHaveText("40");
    await closeBelt(page);
    // player grid still renders around the closed belt
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test("SM-02: PWA manifest served and linked", async ({ page, request }) => {
    // 1. request /manifest.json
    const res = await request.get("/manifest.json");
    // expect: HTTP 200
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    // expect: name 'MTG Life Counter', short_name 'Life Counter'
    expect(manifest.name).toBe("MTG Life Counter");
    expect(manifest.short_name).toBe("Life Counter");
    // expect: orientation 'portrait'
    expect(manifest.orientation).toBe("portrait");
    // expect: display 'standalone'
    expect(manifest.display).toBe("standalone");
    // expect: icons 192 + 512 maskable (purpose may be "any maskable" — check token, per pwa.plan.md)
    const sizes = (manifest.icons ?? []).map(
      (icon: { sizes?: string; purpose?: string }) => ({
        sizes: icon.sizes,
        purposes: (icon.purpose ?? "").split(/\s+/),
      }),
    );
    expect(sizes).toContainEqual(
      expect.objectContaining({
        sizes: "192x192",
        purposes: expect.arrayContaining(["maskable"]),
      }),
    );
    expect(sizes).toContainEqual(
      expect.objectContaining({
        sizes: "512x512",
        purposes: expect.arrayContaining(["maskable"]),
      }),
    );

    // 2. read <link rel=manifest> on /
    await page.goto("/");
    // expect: manifest link present pointing to /manifest.json
    await expect(
      page.locator('link[rel="manifest"][href="/manifest.json"]'),
    ).toBeAttached();
  });

  test("SM-03: Full interaction sweep on 6p — no errors during layout/grid/swipe/color flows", async ({
    page,
  }) => {
    // 1. collect console errors; select 6 players
    const errors = consoleErrors(page);
    await page.goto("/");
    await selectPlayers(page, 6);
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(6);

    // open/close commander on P1 (180° slot → physical right)
    await swipeOn(zone(page, 1), "right");
    await expect(page.locator('dialog[id="commander-dmg-0"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[id="commander-dmg-0"]')).not.toBeVisible();

    // open/close commander on P6 (0° slot → physical left)
    await swipeOn(zone(page, 6), "left");
    await expect(page.locator('dialog[id="commander-dmg-5"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[id="commander-dmg-5"]')).not.toBeVisible();

    // open/close counters on P3 (−90° slot → player-right is physical UP)
    await swipeY(zone(page, 3), "up");
    await expect(page.locator('dialog[id="counters-2"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[id="counters-2"]')).not.toBeVisible();

    // change P2 color to Blue (adds to default ["r"] → ["r","u"], §8.5.1)
    await zone(page, 2).getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-1"]');
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Blue mana" }).click();
    await picker.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker).not.toBeVisible();
    // expect: P2 red+blue gradient (Blue ADDS to default ["r"], §8.5.1)
    await expect(zone(page, 2)).toHaveCSS(
      "background-image",
      /^linear-gradient\(to (bottom right|right bottom), rgb\(228, 153, 119\)/,
    );
    await expect(zone(page, 2)).toHaveCSS(
      "background-image",
      /rgb\(193, 215, 233\)/,
    );

    // Restart Life
    await openBelt(page);
    await page.getByRole("button", { name: "Restart Life" }).click();
    await closeBelt(page);

    // expect: 0 error-level console messages across the whole sweep
    expect(errors).toEqual([]);
    // expect: all dialogs open and close cleanly — no dialog remains open
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    // and zones still alive at 40
    for (let n = 1; n <= 6; n++) {
      await expect(lifeTotal(zone(page, n))).toHaveText("40");
    }
  });
});
