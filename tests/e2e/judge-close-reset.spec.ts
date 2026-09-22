// spec: specs/ios-safari-fixes.plan.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Judge Close Reset + Keyboard Threshold — Chromium (default project) ─
   vk shadow REQUIRED (TC-AJ-36 pattern): Playwright Chromium on localhost
   (secure context) HAS a prototype navigator.virtualKeyboard getter → without
   shadowing it the effect mounts the vk branch and vv resize is a NO-OP. The
   shadow must be registered BEFORE goto (addInitScript runs pre-app-scripts).

   DESIGN §6.4: the 48px KEYBOARD_TOOLBAR_MARGIN applies ONLY while the
   keyboard is up (keyboardUp = vv.height + vv.offsetTop < clientHeight − 60);
   the lift is self-calibrating (overflow = form bottom − visibleBottom) and
   re-applied by a 500ms poll. handleClose contract: clears paddingBottom,
   blurs, window.scrollTo(0, 0). */

const modal = (page: Page): Locator => page.locator("#ai-judge-modal");

/** Open modal prelude: goto /, open belt, click "AI Judge". */
async function openJudgeModal(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(page.locator("#spellbook-toggle")).toBeChecked();
  await page.getByRole("button", { name: "AI Judge", exact: true }).click();
  await expect(modal(page)).toBeVisible();
}

/** Force the visualViewport fallback branch (TC-AJ-36 shadow) — must run
    BEFORE goto. */
async function shadowVirtualKeyboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "virtualKeyboard", {
      value: undefined,
      configurable: true,
    });
  });
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
 * Judge Close Reset + Keyboard Threshold (DESIGN §6.4)
 * ─────────────────────────────────────────────── */

test.describe("Judge Close Reset + Keyboard Threshold", () => {
  test("JC-01: Close event clears lift, blurs input, resets scroll", async ({
    page,
  }) => {
    // 1. vk shadow BEFORE goto; open judge modal
    await shadowVirtualKeyboard(page);
    await openJudgeModal(page);

    // 2. Force scrollability (page is NOT scrollable at 1280×720 —
    //    scrollHeight === clientHeight === 720) then scroll to 300
    await page.evaluate(() => {
      document.body.style.minHeight = "2000px";
      window.scrollTo(0, 300);
    });

    // expect: scroll landed
    expect(await page.evaluate(() => window.scrollY)).toBe(300);

    // 3. Keyboard up: vv.height 300 → known-good lifted state (TC-AJ-36 value)
    await shrinkViewport(page, 300);
    expect(await modal(page).evaluate((el) => el.style.paddingBottom)).toBe(
      "468px",
    );

    // 4. Escape — the textarea is focused on open (focus with preventScroll,
    //    DESIGN §6.4) → keydown bubbles through the dialog → close
    await page.keyboard.press("Escape");

    // expect: modal not visible
    await expect(modal(page)).not.toBeVisible();
    // Harness note (verified live 2026-09-22): toBeVisible/state-hidden resolve
    // on the `open`-attribute removal, but Chromium dispatches the dialog
    // `close` event a few ms LATER — handleClose (padding clear, blur,
    // scrollTo(0,0)) runs in that dispatch. Reading state right after hidden
    // races the close event. Wait for the handleClose completion signal — the
    // paddingBottom clear — then assert the contract exactly.
    await expect
      .poll(() => modal(page).evaluate((el) => el.style.paddingBottom))
      .toBe("");
    // expect: handleClose contract — scroll reset to 0, focus dropped from the
    //     judge textarea (page never left shifted)
    const after = await page.evaluate(() => {
      const dialog = document.getElementById(
        "ai-judge-modal",
      ) as HTMLDialogElement;
      return {
        scrollY: window.scrollY,
        paddingBottom: dialog.style.paddingBottom,
        activeIsTextarea: document.activeElement === dialog.querySelector("textarea"),
      };
    });
    expect(after.scrollY).toBe(0);
    expect(after.paddingBottom).toBe("");
    expect(after.activeIsTextarea).toBe(false);
  });

  test("JC-02: ~13px viewport shrink (URL-bar jitter) → NO 48px margin", async ({
    page,
  }) => {
    // 1. Setup per JC-01; judge modal open
    await shadowVirtualKeyboard(page);
    await openJudgeModal(page);

    // 2. Jitter: vv.height 707 (13 below 720; ABOVE threshold 660) →
    //    keyboardUp false
    await shrinkViewport(page, 707);

    // expect: raw overflow lift, no margin — 720 − 707 = "13px"
    //     (pin: 13 ≠ 61 — the margin would add 48 if it wrongly applied while
    //     the keyboard is "down")
    expect(await modal(page).evaluate((el) => el.style.paddingBottom)).toBe(
      "13px",
    );

    // 3. Wait ≥ 600ms (past the 500ms poll), re-read → still "13px"
    //    (self-calibrating no-op at overflow 0 — no drift, no margin spike)
    await page.waitForTimeout(600);
    expect(await modal(page).evaluate((el) => el.style.paddingBottom)).toBe(
      "13px",
    );
  });

  test("JC-03: Shrink below clientHeight − 60 → 48px margin applies", async ({
    page,
  }) => {
    // 1. Setup per JC-01; judge modal open
    await shadowVirtualKeyboard(page);
    await openJudgeModal(page);

    // 2. vv.height 600 → keyboardUp true (600 < 660)
    await shrinkViewport(page, 600);

    // expect: 720 − (600 − 48) = "168px". Pin: never 120 (the no-margin value)
    //     — the margin applies exactly while keyboardUp (DESIGN §6.4 formula;
    //     contrast 468px at 300 per TC-AJ-36)
    expect(await modal(page).evaluate((el) => el.style.paddingBottom)).toBe(
      "168px",
    );
  });
});