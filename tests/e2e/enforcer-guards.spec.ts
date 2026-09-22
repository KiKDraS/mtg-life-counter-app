// spec: specs/ios-safari-fixes.plan.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Enforcer Guards (iOS absence / rejection) — Chromium (default project)
   No changes to screen-wake-lock.spec.ts (layout coverage stays there).
   FullscreenEnforcer: early return when requestFullscreen is not a function
   (iPhone Safari has no Fullscreen API) — a guard regression would surface as
   per-pointerdown console noise. WakeLockEnforcer: failed request → silent
   catch + failedRef stops retry spam until visibilitychange → visible. */

const zone = (page: Page, n: number): Locator =>
  page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
const lifeTotal = (zoneLocator: Locator): Locator =>
  zoneLocator.locator('[aria-live="polite"]');

/** Collects error + warning console messages, filtering the benign _vercel
    script 404 pair (off-Vercel self-host artifact — Chromium message variants:
    `_vercel/` in text, or the generic 404 "Failed to load resource"). */
function consoleNoise(page: Page): string[] {
  const noise: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    if (msg.text().includes("_vercel/")) return;
    if (msg.text().includes("Failed to load resource")) return;
    noise.push(msg.text());
  });
  return noise;
}

/* ───────────────────────────────────────────────
 * Enforcer Guards (iOS absence / rejection)
 * ─────────────────────────────────────────────── */

test.describe("Enforcer Guards (iOS absence / rejection)", () => {
  test("EG-01: requestFullscreen absent (iPhone Safari) → guard silent, app functional", async ({
    page,
  }) => {
    // 1. Remove the Fullscreen API — Element.prototype defineProperty (the
    //    guard's typeof check reads the prototype chain; own-prop stubbing on
    //    documentElement alone would not exercise the guard)
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, "requestFullscreen", {
        value: undefined,
        configurable: true,
      });
    });

    // 2. Console collector (errors + warnings) BEFORE goto; _vercel filtered
    const noise = consoleNoise(page);

    // 3. goto; hydration wait
    await page.goto("/");
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);

    // expect: the guard branch is armed — requestFullscreen not a function
    expect(
      await page.evaluate(
        () => typeof document.documentElement.requestFullscreen,
      ),
    ).toBe("undefined");

    // 4. Tap P1 +1 life → 41 (pointerdown hits the window listener — if the
    //    guard regressed, this tap would attempt fullscreen/orientation)
    await zone(page, 1).getByRole("button", { name: "+1 life" }).click();
    await expect(lifeTotal(zone(page, 1))).toHaveText("41");

    // 5. Tap P2 −1 life → 39 (repeat)
    await zone(page, 2).getByRole("button", { name: "-1 life" }).click();
    await expect(lifeTotal(zone(page, 2))).toHaveText("39");

    // 6. expect: collector empty — no "Fullscreen mode failed" AND no
    //    "Orientation lock failed" (the pre-existing per-pointerdown warning
    //    is ABSENT here — that absence IS the guard proof; contrast
    //    screen-wake-lock.spec.ts where it repeats). Gameplay unaffected.
    await page.waitForTimeout(300); // console settle window
    expect(noise).toEqual([]);
  });

  test("EG-02: WakeLock request rejects (NotAllowedError) → silent, failedRef stops retry spam", async ({
    page,
  }) => {
    // 1. Counting wakeLock stub — every request() increments window.__wlRequests
    //    and rejects (proves the failedRef retry guard)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "wakeLock", {
        value: {
          request: async () => {
            const w = window as unknown as { __wlRequests?: number };
            w.__wlRequests = (w.__wlRequests ?? 0) + 1;
            throw new DOMException(
              "Wake Lock API request failed",
              "NotAllowedError",
            );
          },
        },
        configurable: true,
      });
    });

    // 2. Collector — _vercel pair AND the known pre-existing "Orientation lock
    //    failed" warning filtered (SM-01 convention: never assert zero
    //    warnings; the filter keeps the assertion about wake-lock output only)
    const noise: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error" && msg.type() !== "warning") return;
      if (msg.text().includes("_vercel/")) return;
      if (msg.text().includes("Failed to load resource")) return;
      if (msg.text().includes("Orientation lock failed")) return;
      noise.push(msg.text());
    });

    // 3. goto; hydration wait
    await page.goto("/");
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);

    // 4. 3 pointerdowns — each triggers requestLock. Pinned totals per plan
    //    (41 / 39) hold after the first two taps; the third tap (P1 +1) lands
    //    P1 at 42 — the plan's tap sequence is (P1 +1, P2 −1, P1 +1).
    await zone(page, 1).getByRole("button", { name: "+1 life" }).click();
    await expect(lifeTotal(zone(page, 1))).toHaveText("41");
    await zone(page, 2).getByRole("button", { name: "-1 life" }).click();
    await expect(lifeTotal(zone(page, 2))).toHaveText("39");
    await zone(page, 1).getByRole("button", { name: "+1 life" }).click();
    await expect(lifeTotal(zone(page, 1))).toHaveText("42");

    // 5. expect: exactly ONE request attempt for 3 taps (failedRef stops
    //    re-requests; re-allowed only on visibilitychange → visible)
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __wlRequests?: number }).__wlRequests ?? 0,
        ),
      )
      .toBe(1);

    // 6. expect: no collected console error/warning mentioning wake/wakeLock
    //    (the catch is silent by design — rejected wake lock never blocks
    //    gameplay, and never spams the console)
    await page.waitForTimeout(300); // console settle window
    expect(noise.filter((text) => /wake/i.test(text))).toEqual([]);
  });
});