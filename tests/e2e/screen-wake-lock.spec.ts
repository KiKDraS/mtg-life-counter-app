// spec: specs/screen-wake-lock.plan.md — Screen Wake Lock (Invisible Enforcer) Regression
// seed: tests/seed.spec.ts
// Contract under test: DESIGN.md §4–9 (unchanged). Feature: features/lock-portrait/
// WakeLockEnforcer.tsx (invisible, returns null) + LockPortrait.tsx (FullscreenEnforcer
// + WakeLockEnforcer + portrait-required overlay) in the root layout. No visual change.
// Wake lock is NOT testable in headless Chromium — no assertions on navigator.wakeLock.

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

/**
 * Wait for the app to finish booting before the FIRST React-handled
 * interaction. The §4.6 splash overlay is `pointer-events:auto` until the
 * hydration flush, then `pointer-events-none` on the mount-run effect —
 * BEFORE the async IndexedDB HYDRATE lands. A tap in that window is applied
 * and then wiped when `isHydrated` flips and PlayerRow remounts with the
 * hydrated (or default) state. The overlay is removed 310ms after the last
 * effect run, i.e. guaranteed after HYDRATE — so splash removal is the
 * settled-boot signal (same convention as swipeOn/holdButton below).
 */
async function waitForBoot(page: Page): Promise<void> {
  await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
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
 * Hold gesture: press + hold + release. Per DESIGN §7.1, ±10 stages at 1s hold
 * and commits after 400ms more (1400ms). A 1100ms hold lands in the staged
 * cancel window (release before the 1400ms commit → no ±10, no ±1); pass
 * `ms ≥ 1400` to commit exactly one ±10.
 */
async function holdButton(page: Page, button: Locator, ms = 1100): Promise<void> {
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
 * Returns errors collected so far for the given page.
 * Skips the Vercel script 404 pair: off-Vercel, `/_vercel/{speed-insights,insights}/script.js`
 * 404s (generic resource error + strict-MIME refusal) — benign, PR #122
 * artifact; Web Analytics added by feature/vercel-analytics, same self-host 404.
 * Never assert zero WARNINGS — the pre-existing screen.orientation.lock()
 * NotSupportedError warning repeats per pointerdown in headless Chromium and is
 * explicitly acceptable (SM-01 convention). Assert zero errors only.
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
 * Screen Wake Lock (Invisible Enforcer) — Regression
 * ─────────────────────────────────────────────── */

test.describe("Screen Wake Lock Regression", () => {
  test("WL-01: App boots — game table renders (smoke)", async ({ page }) => {
    // 1. goto / with consoleErrors attached
    const errors = consoleErrors(page);
    await page.goto("/");
    await expect(page).toHaveTitle("MTG Life Counter");
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");

    // 2. reload (hydration path — LockPortrait is in the root layout, re-runs both enforcers)
    await page.reload();
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(2);
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
    // expect: no RSC/client mismatch, no enforcer throw
    expect(errors).toEqual([]);

    // 3. belt sanity — root-layout enforcers didn't break layout
    await openBelt(page);
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await closeBelt(page);
    // belt toggles checked/unchecked cleanly; wrapper settles to 0px
    await expect(belt(page)).not.toBeChecked();
    await expect(page.locator("div.relative.z-50").first()).toHaveCSS(
      "height",
      "0px",
    );
    expect(errors).toEqual([]);
  });

  test("WL-02: Life counter core intact — tap ±1, hold ±10 (enforcers armed)", async ({
    page,
  }) => {
    // 1. goto /; attach consoleErrors
    const errors = consoleErrors(page);
    await page.goto("/");

    // 2. Wait for boot: first tap arms FullscreenEnforcer + WakeLockEnforcer
    //    mid-test; must not block the tap. Splash removal = HYDRATE landed,
    //    PlayerRow remounted — a tap before that is silently wiped.
    await waitForBoot(page);

    // 3. Tap P1 +1 life
    await zone(page, 1).getByRole("button", { name: "+1 life" }).click();
    await expect(lifeTotal(zone(page, 1))).toHaveText("41");

    // 3. Tap P2 -1 life 3×
    for (let i = 0; i < 3; i++) {
      await zone(page, 2).getByRole("button", { name: "-1 life" }).click();
    }
    await expect(lifeTotal(zone(page, 2))).toHaveText("37");

    // 4. Hold P1 +1 life (1100ms) — staged ±10 at 1s, released at 1100ms
    //    before the 1400ms commit → cancelled (no ±10, no ±1)
    await holdButton(page, zone(page, 1).getByRole("button", { name: "+1 life" }));
    // expect: P1 life still reads 41 (cancel window — no ±10, no ±1)
    await expect(lifeTotal(zone(page, 1))).toHaveText("41");

    // 5. Hold P2 -1 life (1450ms) — commits exactly one −10 (commit at
    //    1400ms; next stage at 1500ms not reached)
    await holdButton(page, zone(page, 2).getByRole("button", { name: "-1 life" }), 1450);
    // expect: P2 life reads 27 (37 − 10; exact — cadence is deterministic)
    await expect(lifeTotal(zone(page, 2))).toHaveText("27");

    // 6. Final state — P1 41, P2 27; wake-lock/fullscreen failures surface as
    //    console.warn only — still zero errors
    await expect(lifeTotal(zone(page, 1))).toHaveText("41");
    await expect(lifeTotal(zone(page, 2))).toHaveText("27");
    expect(errors).toEqual([]);
  });

  test("WL-03: LockPortrait intact — FullscreenEnforcer + WakeLockEnforcer co-exist, overlay hidden", async ({
    page,
  }) => {
    // 1. goto /
    const errors = consoleErrors(page);
    await page.goto("/");

    // 2. portrait overlay markup still renders (structural, §8.2)
    //    getByRole excludes display:none subtrees from the a11y tree, so assert
    //    the mounted heading via text locator; the role locator toBeHidden()
    //    passes for hidden/detached — never toHaveCount(0), the overlay div
    //    must stay mounted
    await expect(
      page.getByText("Portrait Mode Required", { exact: true }),
    ).toBeAttached();
    await expect(
      page.getByRole("heading", { name: "Portrait Mode Required" }),
    ).toBeHidden();

    // 3. overlay never intercepts: belt + zone interactions pass through
    await openBelt(page);
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await closeBelt(page);
    await zone(page, 1).getByRole("button", { name: "-1 life" }).click();
    await expect(lifeTotal(zone(page, 1))).toHaveText("39");

    // 4. no dialog left behind; co-mounted enforcers throw no runtime errors
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("WL-04: Zero console errors across a full interaction sweep", async ({
    page,
  }) => {
    // 1. goto / with consoleErrors attached; wait for boot (the "Players"
    //    modal button below is React-handled — same hydration-window race as
    //    WL-02); select 3 players
    const errors = consoleErrors(page);
    await page.goto("/");
    await waitForBoot(page);
    await selectPlayers(page, 3);
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(3);
    await expect(lifeTotal(zone(page, 3))).toHaveText("40");

    // 2. swipe sweep on rotated slots (DESIGN §7.2): Commander on P1 (180° →
    //    physical right), Counters on P3 (−90° → physical up)
    await swipeOn(zone(page, 1), "right");
    await expect(page.locator('dialog[id="commander-dmg-0"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[id="commander-dmg-0"]')).not.toBeVisible();

    await swipeY(zone(page, 3), "up");
    await expect(page.locator('dialog[id="counters-2"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('dialog[id="counters-2"]')).not.toBeVisible();

    // 3. P1 color picker: Blue adds to default ["r"] → ["r","u"] (§8.5.1)
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-0"]');
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Blue mana" }).click();
    await picker.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker).not.toBeVisible();
    await expect(zone(page, 1)).toHaveCSS(
      "background-image",
      /^linear-gradient\(to (bottom right|right bottom), rgb\(228, 153, 119\)/,
    );
    await expect(zone(page, 1)).toHaveCSS(
      "background-image",
      /rgb\(193, 215, 233\)/,
    );

    // 4. Restart Life → all 3 zones back at 40 (auto-retrying poll on the
    //    aria-live texts)
    await openBelt(page);
    await page.getByRole("button", { name: "Restart Life" }).click();
    await closeBelt(page);
    for (let n = 1; n <= 3; n++) {
      await expect
        .poll(async () => Number(await lifeTotal(zone(page, n)).textContent()))
        .toBe(40);
    }

    // 5. final — the wake-lock path (pointerdown listener active throughout)
    //    logged no error-level messages; any wake-lock failure is by-design
    //    console.warn and does not fail this check
    expect(errors).toEqual([]);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });

  test.skip(
    "WL-05: Wake Lock API behavior — not testable in headless Chromium (manual)",
    async () => {
      // "wakeLock" in navigator is present in some headless Chromium builds,
      // absent in others; request() outcome depends on permission policy,
      // document visibility, and browser flags — none controllable via
      // Playwright config. The contract is "fails silently, gameplay never
      // blocked" (README compatibility section); headless assertions would
      // test the browser, not the app. Do NOT write assertions on
      // navigator.wakeLock, its request(), or sentinel state.
      //
      // Manual checklist (real device, e.g. Android Chrome):
      // 1. Open the app on a phone in Chrome; play (pointerdown) → screen must
      //    not sleep during play.
      // 2. Tab away and back → wake lock reacquired on
      //    visibilitychange → visible (no gameplay interruption).
      // 3. Firefox (no Wake Lock API) → app functions identically, screen may
      //    sleep — no errors, no blocked UI.
    },
  );
});