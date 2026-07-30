// spec: specs/qa-modals.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

function belt(page: Page): Locator {
  return page.locator("#spellbook-toggle");
}

async function openBelt(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).toBeChecked();
}

async function closeViaLogo(page: Page): Promise<void> {
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(belt(page)).not.toBeChecked();
}

/* ───────────────────────────────────────────────
 * §2 — Spellbook Belt
 * ─────────────────────────────────────────────── */

test.describe("Spellbook Belt — Open/Close & ARIA", () => {
  test("TC-2.1: M logo opens belt with 4 icons", async ({ page }) => {
    // 1. Navigate to /
    await page.goto("/");

    // expect: Belt icons not visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Initial Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI Judge" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Players" })).toHaveCount(0);

    // 2. Tap M logo to open belt
    await page.getByLabel("Open Spellbook Menu").click();

    // expect: Checkbox is checked
    await expect(belt(page)).toBeChecked();

    // expect: 4 icon buttons visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });

  test("TC-2.2: M logo collapses belt", async ({ page }) => {
    // 1. Open belt
    await page.goto("/");
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();

    // 2. Tap M logo again
    await page.getByLabel("Open Spellbook Menu").click();

    // expect: Checkbox is unchecked
    await expect(belt(page)).not.toBeChecked();

    // expect: 4 icon buttons no longer visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Initial Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI Judge" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Players" })).toHaveCount(0);
  });

  test("TC-2.3: Click outside belt collapses it", async ({ page }) => {
    // 1. Open belt via M logo
    await page.goto("/");
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();

    // 2. Click the invisible overlay label that covers the screen (Close menu)
    // The overlay is a <label for="spellbook-toggle"> with aria-label="Close menu"
    // It has aria-hidden="true", so use CSS selector directly
    await page.locator('label[for="spellbook-toggle"][aria-label="Close menu"]').click({ force: true });

    // expect: Checkbox is unchecked
    await expect(belt(page)).not.toBeChecked();

    // expect: Belt icons no longer visible
    await expect(page.getByRole("button", { name: "Restart Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Initial Life" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "AI Judge" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Players" })).toHaveCount(0);
  });

  test("TC-2.4: Belt icon ARIA labels correct", async ({ page }) => {
    // 1. Open belt
    await page.goto("/");
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(belt(page)).toBeChecked();

    // 2. Inspect each button's aria-label
    // getByRole with `name` matches the accessible name computed from aria-label
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Initial Life" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Judge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Players" })).toBeVisible();
  });
});
