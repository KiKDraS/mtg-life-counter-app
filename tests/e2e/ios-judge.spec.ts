// spec: specs/ios-safari-fixes.plan.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── iOS Judge Keyboard — WebKit engine ─────────────────────────────────
   Per-file browser override: runs this file on WebKit (verified live
   2026-09-22). WebKit (webkit-2359) has NO navigator.virtualKeyboard → the
   visualViewport fallback branch mounts naturally (no vk shadow needed,
   unlike Chromium). Form bottom measured at 720 in WebKit. DESIGN §6.4:
   iOS Safari vv bottom = keyboard top (no Gboard toolbar row to subtract) →
   the 48px KEYBOARD_TOOLBAR_MARGIN applies only when NOT iOS. */

test.use({ browserName: "webkit" });

const modal = (page: Page): Locator => page.locator("#ai-judge-modal");

/** Open modal prelude: goto /, hydration wait, open belt, click "AI Judge". */
async function openJudgeModal(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(page.locator("#spellbook-toggle")).toBeChecked();
  await page.getByRole("button", { name: "AI Judge", exact: true }).click();
  await expect(modal(page)).toBeVisible();
}

/** Keyboard shrink simulation (TC-AJ-36 shadow-getters pattern): vv
    height/offsetTop are prototype getters — own data properties shadow them,
    then a resize event fires the mounted handler sync. */
async function shrinkViewport(page: Page, height: number): Promise<void> {
  await page.evaluate((h) => {
    const vv = window.visualViewport!;
    Object.defineProperty(vv, "height", { value: h, configurable: true });
    Object.defineProperty(vv, "offsetTop", { value: 0, configurable: true });
    vv.dispatchEvent(new Event("resize"));
  }, height);
}

/* ───────────────────────────────────────────────
 * iOS Judge Keyboard (DESIGN §6.4)
 * ─────────────────────────────────────────────── */

test.describe("iOS Judge Keyboard", () => {
  test("IJ-01: iOS detected → lift margin 0 (vv bottom = keyboard top, no 48px Gboard margin)", async ({
    page,
  }) => {
    // 1. iOS stub (standalone false) BEFORE goto — JudgeModal isIos → true
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", {
        value: false,
        configurable: true,
      });
    });

    // 2. Open judge modal
    await openJudgeModal(page);

    // expect: baseline — mount sync wrote "0px"; clientHeight 720
    const baseline = await page.evaluate(() => {
      const dialog = document.getElementById(
        "ai-judge-modal",
      ) as HTMLDialogElement;
      return {
        paddingBottom: dialog.style.paddingBottom,
        clientHeight: document.documentElement.clientHeight,
      };
    });
    expect(baseline.paddingBottom).toBe("0px");
    expect(baseline.clientHeight).toBe(720);

    // 3. Keyboard simulation: vv.height 300 < 720 − 60 → keyboardUp true
    await shrinkViewport(page, 300);

    // expect: lift = exact overflow, NO 48px margin on iOS — 720 − 300 =
    //     "420px". Pin: 420 ≠ 468 (the non-iOS value — margin suppression is
    //     the iOS branch's job, DESIGN §6.4)
    expect(await modal(page).evaluate((el) => el.style.paddingBottom)).toBe(
      "420px",
    );

    // expect: form bottom lands exactly at the keyboard top (300)
    const formBottom = await modal(page)
      .locator("form")
      .evaluate((el) => el.getBoundingClientRect().bottom);
    expect(formBottom).toBe(300);
  });

  test("IJ-02: Non-iOS WebKit contrast — same shrink applies the 48px margin", async ({
    page,
  }) => {
    // 1. NO standalone stub (desktop WebKit, isIos false; the vv branch
    //    attaches — no navigator.virtualKeyboard in WebKit).
    //    Harness note (verified live 2026-09-22): webkit-2311 exposes
    //    navigator.standalone as a configurable getter on the Navigator
    //    prototype (Safari 26.5 UA) → `"standalone" in navigator` is true and
    //    isIos evaluates TRUE even without a stub. The plan's live facts were
    //    measured on webkit-2359, which does not expose it. Delete the
    //    prototype getter BEFORE goto so the app sees a non-iOS WebKit.
    await page.addInitScript(() => {
      const proto = Object.getPrototypeOf(navigator);
      const desc = Object.getOwnPropertyDescriptor(proto, "standalone");
      if (desc?.configurable) delete (proto as { standalone?: unknown }).standalone;
    });
    await openJudgeModal(page);

    // 2. Same shrink simulation (vv.height 300, offsetTop 0, resize)
    await shrinkViewport(page, 300);

    // expect: margin applies when not iOS — 720 − (300 − 48) = "468px".
    //     Proves IJ-01's 420 is specifically the iOS suppression
    expect(await modal(page).evaluate((el) => el.style.paddingBottom)).toBe(
      "468px",
    );
  });
});