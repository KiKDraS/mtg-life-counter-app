// spec: specs/qa-modals.md Suite 6 (behavior per SPEC.md §8.5.1 — spec trumps plan)
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Helpers ── */

function zone(page: Page, n: number): Locator {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function colorPickerDialog(page: Page, playerId: number): Locator {
  return page.locator(`dialog[id="color-picker-${playerId}"]`);
}

/** Read a player zone's effective background (handles gradient or solid). */
async function zoneBackground(page: Page, n: number): Promise<string> {
  // The <section role="region"> carries the zone's `background` style directly.
  return zone(page, n).evaluate((el) => {
    const style = getComputedStyle(el);
    return `${style.backgroundImage} | ${style.backgroundColor}`;
  });
}

/** Read the zone's INLINE background as set by React (`el.style.background`). */
async function inlineBackground(page: Page, n: number): Promise<string> {
  return zone(page, n).evaluate((el) => (el as HTMLElement).style.background);
}

/**
 * Normalize a gradient string: collapse whitespace, round percentages to 2dp,
 * convert hex colors to rgb, and canonicalize the corner direction. The
 * browser re-serializes `to bottom right` as `to right bottom` (same corner)
 * and hex as rgb when reading back `el.style.background`, so both sides must
 * be normalized the same way. Mirrors buildGradient's `100 / n` float math
 * (33.333333333333336%) so exact hard-stop equality is asserted despite
 * float artifacts.
 */
function hexToRgb(hex: string): string {
  const n = Number.parseInt(hex.replace(/^#/, ""), 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}

function normalizeGradient(s: string): string {
  return s
    .replace(/#([0-9a-f]{6})/gi, (_, hex: string) => hexToRgb(hex.toLowerCase()))
    .replace(/(\d+\.\d+)/g, (m) => String(Math.round(Number(m) * 100) / 100))
    .replace(/\s+/g, "")
    .replace(/tobottomright|torightbottom/g, "DIR");
}

/** Expected equal-band gradient string for the given hexes (same math as buildGradient). */
function expectedGradient(hexes: string[]): string {
  const step = 100 / hexes.length;
  const stops = hexes
    .map((hex, i) => {
      const start = i * step;
      const end = (i + 1) * step;
      return `${hex} ${start}%, ${hex} ${end}%`;
    })
    .join(", ");
  return `linear-gradient(to bottom right, ${stops})`;
}

/* ───────────────────────────────────────────────
 * §6 — Color Picker (per SPEC.md §8.5.1)
 * ───────────────────────────────────────────────
 */

test.describe("Color Picker", () => {
  test("TC-6.1: Gear icon opens color picker dialog", async ({ page }) => {
    await page.goto("/");

    await zone(page, 1).getByRole("button", { name: "Change color" }).click();

    const dialog = colorPickerDialog(page, 0);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAttribute(
      "aria-labelledby",
      "color-picker-title",
    );
  });

  test("TC-6.2: Circular wheel renders 6 mana symbols + CheckCircle, default Red pressed", async ({
    page,
  }) => {
    await page.goto("/");
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog = colorPickerDialog(page, 0);

    // 6 mana symbol buttons visible clockwise from top: C, W, U, B, R, G
    await expect(
      dialog.getByRole("button", { name: "Colorless mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Blue mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Black mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Green mana" }),
    ).toBeVisible();

    // CheckCircle ✓ centered (§6.5)
    await expect(
      dialog.getByRole("button", { name: "Confirm color" }),
    ).toBeVisible();

    // No WUBRG filter-strip action button (old 80/20 layout gone)
    await expect(
      dialog.getByRole("button", { name: "WUBRG colors" }),
    ).toHaveCount(0);

    // Default ["r"] — Red aria-pressed=true; WUBRG siblings false
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Blue mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Black mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Green mana" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("TC-6.3: Multi-select — add from default, remove, no-op on last", async ({
    page,
  }) => {
    await page.goto("/");

    // Sanity: default Player 1 zone is red (#E49977)
    await expect
      .poll(() => zoneBackground(page, 1))
      .toMatch(/^none \| rgb\(228, 153, 119\)$/);

    // Open Color Picker for Player 1
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog = colorPickerDialog(page, 0);

    const tap = (name: string) =>
      page.getByRole("button", { name: name }).first().click();

    // 1. Tap White: unselected + default (["r"]) → ADD → ["r","w"] (default persists, §8.5.1)
    await tap("White mana");
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "true"); // Red STAYS highlighted
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(dialog).toBeVisible(); // dialog stays open
    // red+white gradient (#E49977 + #F8F6D8), NOT solid white
    await expect
      .poll(() => zoneBackground(page, 1))
      .toMatch(/gradient.*rgb\(228, 153, 119\).*rgb\(248, 246, 216\)/);

    // 2. Tap Blue: unselected + multi (["r","w"]) → ADD → ["r","w","u"]
    await tap("Blue mana");
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "Blue mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => zoneBackground(page, 1)).toContain("gradient"); // 3 equal bands

    // 3. Tap Blue again: selected + multi → REMOVE → ["r","w"]
    await tap("Blue mana");
    await expect(
      dialog.getByRole("button", { name: "Blue mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => zoneBackground(page, 1))
      .toMatch(/gradient.*rgb\(228, 153, 119\).*rgb\(248, 246, 216\)/); // back to red+white gradient

    // 4. Tap White: selected + multi → REMOVE → ["r"]
    await tap("White mana");
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => zoneBackground(page, 1))
      .toMatch(/^none \| rgb\(228, 153, 119\)$/); // back to solid red (#E49977)

    // 5. Tap Red: selected + length 1 → NO-OP (cannot remove last, §8.5.1)
    await tap("Red mana");
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => zoneBackground(page, 1))
      .toMatch(/^none \| rgb\(228, 153, 119\)$/); // unchanged — solid red

    // 6. Tap Green: unselected + single (["r"]) → ADD → ["r","g"]
    await tap("Green mana");
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "Green mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => zoneBackground(page, 1))
      .toMatch(/gradient.*rgb\(228, 153, 119\).*rgb\(163, 192, 149\)/); // red+green gradient

    // 7. Tap Green again: selected + multi → REMOVE → ["r"]
    await tap("Green mana");
    await expect(
      dialog.getByRole("button", { name: "Green mana" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      dialog.getByRole("button", { name: "Red mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => zoneBackground(page, 1))
      .toMatch(/^none \| rgb\(228, 153, 119\)$/); // solid red again
  });

  test("TC-6.4: Colorless closes immediately, reopens selected; CheckCircle closes without dispatch", async ({
    page,
  }) => {
    await page.goto("/");

    // 1-3. Player 1 (default ["r"]): White adds → ["r","w"]; Blue adds →
    //      ["r","w","u"] — dialog stays open on every toggle
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog0 = colorPickerDialog(page, 0);
    await dialog0.getByRole("button", { name: "White mana" }).click();
    await dialog0.getByRole("button", { name: "Blue mana" }).click();
    await expect(dialog0).toBeVisible();
    await expect.poll(() => zoneBackground(page, 1)).toContain("gradient");

    // 4. Tap Colorless (C) mana symbol
    await dialog0.getByRole("button", { name: "Colorless mana" }).click();
    // expect: Dialog closes immediately
    await expect(dialog0).not.toBeVisible();
    // expect: Player 1 zone solid colorless (#CAC5C0)
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(202, 197, 192)");

    // 5. Reopen the Color Picker for Player 1 (["c"])
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    await expect(dialog0).toBeVisible();
    // expect: Colorless button aria-pressed="true" + selected treatment (full
    // opacity, solid --color-ui-textLight ring, slight scale-up) — §6.5/§8.5.1
    // mirror the Colorless state
    const colorless = dialog0.getByRole("button", { name: "Colorless mana" });
    await expect(colorless).toHaveAttribute("aria-pressed", "true");
    await expect(colorless).toHaveCSS("opacity", "1");
    await expect(colorless).toHaveCSS(
      "box-shadow",
      /rgb\(250, 248, 245\) 0px 0px 0px 4px/,
    );
    // expect: All WUBRG buttons aria-pressed="false", 40% opacity
    for (const name of [
      "White mana",
      "Blue mana",
      "Black mana",
      "Red mana",
      "Green mana",
    ]) {
      const btn = dialog0.getByRole("button", { name });
      await expect(btn).toHaveAttribute("aria-pressed", "false");
      await expect(btn).toHaveCSS("opacity", "0.4");
    }

    // 6. Tap White → selected-colorless REPLACE per SPEC §8.5.1
    await dialog0.getByRole("button", { name: "White mana" }).click();
    // expect: White gains the selected treatment; Colorless drops to 40% /
    // aria-pressed="false"
    await expect(
      dialog0.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(colorless).toHaveAttribute("aria-pressed", "false");
    await expect(colorless).toHaveCSS("opacity", "0.4");
    // expect: Zone preview shows white mana (#F8F6D8)
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(248, 246, 216)");

    // 7-9. Player 2 — White (toggle, dialog stays open) then ✓ close (no dispatch)
    await zone(page, 2).getByRole("button", { name: "Change color" }).click();
    const dialog1 = colorPickerDialog(page, 1);
    await expect(dialog1).toBeVisible();

    await dialog1.getByRole("button", { name: "White mana" }).click();
    await expect(dialog1).toBeVisible(); // toggle does NOT close
    // White ADDS to default ["r"] → red+white gradient applied live (§8.5.1)
    await expect
      .poll(() => zoneBackground(page, 2))
      .toMatch(/gradient.*rgb\(228, 153, 119\).*rgb\(248, 246, 216\)/);

    await dialog1.getByRole("button", { name: "Confirm color" }).click();
    await expect(dialog1).not.toBeVisible();
    // Color stays red+white gradient — Confirm closes only, no dispatch per §8.5.1
    await expect
      .poll(() => zoneBackground(page, 2))
      .toMatch(/gradient.*rgb\(228, 153, 119\).*rgb\(248, 246, 216\)/);
  });

  test("TC-6.6: Wheel selection states — ring + full opacity + scale vs 40% opacity", async ({
    page,
  }) => {
    await page.goto("/");

    // 1. Open Color Picker for Player 1 (default ["r"])
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog = colorPickerDialog(page, 0);
    await expect(dialog).toBeVisible();

    const button = (name: string) => dialog.getByRole("button", { name });

    // Selection treatment (§6.5): full opacity + solid --color-ui-textLight ring
    // (ring-4 ring-ui-textLight → 4px rgb(250,248,245) box-shadow) + slight
    // scale-up. Tailwind v4 `scale-110` lands in the standalone CSS `scale`
    // property (the inline wheel transform is a translate) and transitions —
    // toHaveCSS retries until the transition settles.
    const expectSelected = async (name: string) => {
      const btn = button(name);
      await expect(btn).toHaveAttribute("aria-pressed", "true");
      await expect(btn).toHaveCSS("opacity", "1");
      await expect(btn).toHaveCSS("scale", "1.1");
      await expect(btn).toHaveCSS(
        "box-shadow",
        /rgb\(250, 248, 245\) 0px 0px 0px 4px/,
      );
    };
    const expectUnselected = async (name: string) => {
      const btn = button(name);
      await expect(btn).toHaveAttribute("aria-pressed", "false");
      await expect(btn).toHaveCSS("opacity", "0.4");
      await expect(btn).toHaveCSS("scale", "none");
      await expect(btn).toHaveCSS("box-shadow", "none");
    };

    // expect: Red selected — full opacity, ring, scale-up, stacked (z-10)
    await expectSelected("Red mana");
    await expect(button("Red mana")).toHaveCSS("z-index", "10");

    // expect: W / U / B / G buttons AND Colorless — 40% opacity, no ring, no scale
    for (const name of [
      "White mana",
      "Blue mana",
      "Black mana",
      "Green mana",
      "Colorless mana",
    ]) {
      await expectUnselected(name);
    }

    // 2. Tap White (multi-select → ["r","w"])
    await button("White mana").click();
    // expect: Red AND White both full opacity + ring + scale; Blue/Black/Green at 0.4
    await expectSelected("White mana");
    await expect(button("Red mana")).toHaveAttribute("aria-pressed", "true");
    for (const name of ["Blue mana", "Black mana", "Green mana"]) {
      await expect(button(name)).toHaveCSS("opacity", "0.4");
    }

    // 3. Tap White again (remove → ["r"])
    await button("White mana").click();
    // expect: White back to aria-pressed="false" + 40% opacity, no scale
    await expectUnselected("White mana");
    // expect: Red keeps the selected treatment
    await expect(button("Red mana")).toHaveAttribute("aria-pressed", "true");

    // 4. Tap Colorless (C) → single-tap apply, dialog closes; reopen the picker
    await button("Colorless mana").click();
    await expect(dialog).not.toBeVisible();
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    await expect(dialog).toBeVisible();
    // expect: Colorless aria-pressed="true" + selected treatment (opacity 1,
    // ring, scale-up); all WUBRG buttons aria-pressed="false" + 40% opacity
    await expectSelected("Colorless mana");
    for (const name of [
      "White mana",
      "Blue mana",
      "Black mana",
      "Red mana",
      "Green mana",
    ]) {
      await expectUnselected(name);
    }
  });

  test("TC-6.5: Backdrop/Escape closes — colors already applied (no revert)", async ({
    page,
  }) => {
    await page.goto("/");

    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog = colorPickerDialog(page, 0);

    // Tap Blue: ADD from ["r"] → ["r","u"], goes live, dialog stays open
    await page.getByRole("button", { name: "Blue mana" }).first().click();
    await expect(dialog).toBeVisible();
    // red+blue gradient (#E49977 + #C1D7E9), NOT solid blue
    await expect
      .poll(() => zoneBackground(page, 1))
      .toMatch(/gradient.*rgb\(228, 153, 119\).*rgb\(193, 215, 233\)/);

    // Escape closes; color persists (WYSIWYG — no revert)
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect
      .poll(() => zoneBackground(page, 1))
      .toMatch(/gradient.*rgb\(228, 153, 119\).*rgb\(193, 215, 233\)/);
  });

  test("CP-02: Colorless replaces multi-selection and closes immediately", async ({
    page,
  }) => {
    await page.goto("/");

    // 1. set P1 to White + Blue (gradient) via toggles (dialog stays open)
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialog = colorPickerDialog(page, 0);
    const tap = (name: string) =>
      page.getByRole("button", { name: name }).first().click();
    await tap("White mana"); // ["r"] → ["r","w"] (adds to default, §8.5.1)
    await tap("Blue mana"); // ["r","w"] → ["r","w","u"]
    await expect(
      dialog.getByRole("button", { name: "White mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", { name: "Blue mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    // expect: [r,w,u] selected, zone bg gradient
    await expect.poll(() => zoneBackground(page, 1)).toContain("gradient");

    // 2. tap Colorless
    await tap("Colorless mana");
    // expect: dialog closes immediately
    await expect(dialog).not.toBeVisible();
    // expect: zone bg solid rgb(202,197,192) (#CAC5C0)
    await expect
      .poll(() => zoneBackground(page, 1))
      .toContain("rgb(202, 197, 192)");

    // expect: reopen picker: Colorless mirrors its state (§6.5) — the Colorless
    // button is aria-pressed="true" while current = ["c"]; White/Blue/Red (the
    // replaced selection) are all false
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const dialogReopen = colorPickerDialog(page, 0);
    await expect(dialogReopen).toBeVisible();
    await expect(
      dialogReopen.getByRole("button", { name: "Colorless mana" }),
    ).toHaveAttribute("aria-pressed", "true");
    for (const name of ["White mana", "Blue mana", "Red mana"]) {
      await expect(
        dialogReopen.getByRole("button", { name: name }),
      ).toHaveAttribute("aria-pressed", "false");
    }
  });

  test("CP-04: Gradient hard stops — exact equal bands per color count", async ({
    page,
  }) => {
    await page.goto("/");
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const tap = (name: string) =>
      page.getByRole("button", { name: name }).first().click();

    // 1. set P1 to White + Blue — Colorless-clear first (["c"], dialog closes),
    //    then White replaces ["c"] → ["w"], Blue adds → ["w","u"] (§8.5.1)
    await tap("Colorless mana");
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    await tap("White mana"); // ["c"] → ["w"] (colorless-clear, §8.5.1)
    await tap("Blue mana"); // ["w"] → ["w","u"]
    // expect: 2 equal bands — linear-gradient(to bottom right, #F8F6D8 0%, #F8F6D8 50%, #C1D7E9 50%, #C1D7E9 100%)
    await expect
      .poll(async () => normalizeGradient(await inlineBackground(page, 1)))
      .toBe(normalizeGradient(expectedGradient(["#F8F6D8", "#C1D7E9"])));

    // 2. add Black → [w,u,b]
    await tap("Black mana");
    // expect: 3 equal bands at 0/33.33/66.67/100
    await expect
      .poll(async () => normalizeGradient(await inlineBackground(page, 1)))
      .toBe(
        normalizeGradient(expectedGradient(["#F8F6D8", "#C1D7E9", "#666565"])),
      );

    // 3. add Red + Green → [w,u,b,r,g]
    await tap("Red mana");
    await tap("Green mana");
    // expect: 5 equal bands at 0/20/40/60/80/100%
    await expect
      .poll(async () => normalizeGradient(await inlineBackground(page, 1)))
      .toBe(
        normalizeGradient(
          expectedGradient([
            "#F8F6D8",
            "#C1D7E9",
            "#666565",
            "#E49977",
            "#A3C095",
          ]),
        ),
      );
  });
});