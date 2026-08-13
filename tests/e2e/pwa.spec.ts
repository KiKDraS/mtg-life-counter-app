// spec: specs/pwa.plan.md — PWA manifest, SW, offline (feature/pwa-offline)
// seed: tests/seed.spec.ts
// Requires prod build (pnpm build && pnpm start) at http://localhost:3000 —
// offline TCs (SM-PWA-05/06/09) fail against pnpm dev (HMR client cannot
// reconnect offline, zones never hydrate).

import { test, expect, type Page } from "@playwright/test";

/* ── Helpers ── */

function zone(page: Page, n: number) {
  return page.getByRole("region", { name: new RegExp(`^Player ${n}:`) });
}

function lifeTotal(zoneLocator: ReturnType<typeof zone>) {
  return zoneLocator.locator('[aria-live="polite"]');
}

/**
 * Install + activate SW, precache "/", wait app interactive (plan §shared
 * helper, verbatim). Every test needs a FRESH context: SW registration +
 * caches persist per context (plan §environment).
 */
async function setupOnline(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(
    async () => {
      const keys = await caches.keys();
      if (!keys.includes("mtg-life-v2")) return false;
      const c = await caches.open("mtg-life-v2");
      return !!(await c.match("/")); // precache finished
    },
    { timeout: 15_000 },
  );
  await page
    .getByRole("region", { name: /^Player \d:/ })
    .first()
    .waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "+1 life" }).first().waitFor();
  if (!(await page.evaluate(() => navigator.serviceWorker.controller))) {
    await page.reload();
  }
}

const ERROR_PAGE_STRINGS = [
  "This site can't be reached",
  "ERR_INTERNET_DISCONNECTED",
  "No internet",
];

/* ───────────────────────────────────────────────
 * PWA — manifest, SW, offline (SM-PWA-01..10)
 * ─────────────────────────────────────────────── */

test.describe("PWA — manifest, SW, offline", () => {
  test("SM-PWA-01: Manifest served — valid JSON, all fields, correct icons", async ({
    page,
  }) => {
    // 1. goto /; request /manifest.json
    await page.goto("/");
    const resp = await page.request.get("/manifest.json");
    // expect: HTTP 200, JSON content-type, parses
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("json");
    const manifest = await resp.json();

    // 2. assert parsed manifest fields
    expect(manifest.name).toBe("MTG Life Counter");
    expect(manifest.short_name).toBe("Life Counter");
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("portrait");
    expect(manifest.theme_color).toBe("#292A2A");
    expect(manifest.background_color).toBe("#292A2A");

    // 3. assert icons array — exactly 2, 192 + 512, png, any+maskable
    expect(manifest.icons).toHaveLength(2);
    const icons = manifest.icons as {
      sizes: string;
      type: string;
      purpose: string;
      src: string;
    }[];
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      const purposes = icon.purpose.split(/\s+/);
      expect(purposes).toContain("any");
      expect(purposes).toContain("maskable");
    }
    expect(icons.map((i) => i.sizes).sort()).toEqual(["192x192", "512x512"]);
    const bySize = Object.fromEntries(icons.map((i) => [i.sizes, i.src]));
    expect(bySize["192x192"]).toBe("/web-app-manifest-192x192.png");
    expect(bySize["512x512"]).toBe("/web-app-manifest-512x512.png");
  });

  test("SM-PWA-02: Manifest linked from the page", async ({ page }) => {
    // 1. goto /
    await page.goto("/");

    // 2. read head link[rel="manifest"]
    const links = page.locator('head link[rel="manifest"]');
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveAttribute("href", "/manifest.json");
  });

  test("SM-PWA-03: Icons fetch — manifest icons + apple-touch-icon", async ({
    page,
  }) => {
    // 1. goto /
    await page.goto("/");

    // 2. fetch both manifest icons
    for (const src of [
      "/web-app-manifest-192x192.png",
      "/web-app-manifest-512x512.png",
    ]) {
      const resp = await page.request.get(src);
      expect(resp.status()).toBe(200);
      expect(resp.headers()["content-type"]).toBe("image/png");
      expect((await resp.body()).length).toBeGreaterThan(0);
    }

    // 3. read apple-touch-icon href (hashed value)
    const appleLink = page.locator('head link[rel="apple-touch-icon"]');
    await expect(appleLink).toHaveCount(1);
    const href = await appleLink.first().getAttribute("href");
    expect(href).toMatch(/\/apple-icon\.png/);

    // 4. fetch that exact href
    const resp = await page.request.get(href as string);
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toBe("image/png");
    expect((await resp.body()).length).toBeGreaterThan(0);
  });

  test("SM-PWA-04: SW registers — ready, controller, scope", async ({
    page,
  }) => {
    // 1. goto /
    await page.goto("/");

    // 2. await serviceWorker.ready (fields extracted inside the page — the raw
    //    ServiceWorkerRegistration doesn't survive evaluate serialization)
    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return {
        activeScriptURL: r.active ? r.active.scriptURL : null,
        scope: r.scope,
      };
    });
    expect(reg.activeScriptURL).toMatch(/\/sw\.js$/);
    expect(reg.scope).toBe("http://localhost:3000/");

    // 3. controller check — reload once if not yet claiming
    let controller = await page.evaluate(
      () => !!navigator.serviceWorker.controller,
    );
    if (!controller) {
      await page.reload();
      controller = await page.evaluate(
        () => !!navigator.serviceWorker.controller,
      );
    }
    expect(controller).toBe(true);

    // 4. belt-and-braces: /sw.js servable
    const sw = await page.request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["content-type"]).toContain("javascript");
  });

  test("SM-PWA-05: Offline reload — app shell renders (CORE)", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // 1. fresh context; install + activate SW, precache "/", app interactive
    await setupOnline(page);

    // 2. go offline
    await page.context().setOffline(true);

    // 3. reload — SW navigation handler serves the cached shell
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("region", { name: /^Player \d:/ }),
    ).toHaveCount(2);
    // expect: no browser error page
    const bodyText = await page.locator("body").innerText();
    for (const s of ERROR_PAGE_STRINGS) expect(bodyText).not.toContain(s);
    // expect: document.title
    await expect(page).toHaveTitle("MTG Life Counter");
    // expect: exactly 2 player regions, life 40 each
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      2,
    );
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
    // expect: per-zone +1/-1 life and Change color buttons
    for (const n of [1, 2]) {
      await expect(zone(page, n).getByRole("button", { name: "+1 life" })).toBeVisible();
      await expect(zone(page, n).getByRole("button", { name: "-1 life" })).toBeVisible();
      await expect(zone(page, n).getByRole("button", { name: "Change color" })).toBeVisible();
    }

    // 4. cleanup
    await page.context().setOffline(false);
  });

  test("SM-PWA-06: Offline interaction — life changes work offline", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // Requires prod build (see header note): against `pnpm dev` the SW
    // runtime-cache misses — HMR recompiles churn the hashed /_next chunk URLs
    // between the online precache pass and the offline reload, so the offline
    // shell loads zero JS/CSS. The page stays an inert SSR snapshot: the splash
    // cover never hides (no hydration → no §4.6 handler) and the +1 click is a
    // no-op, so life never moves off 40. Runs green against pnpm build && pnpm start.
    // Un-fixme'd by QA loop 2026-08-12: loop runs against the prod build.
    // 1. fresh context; install + activate SW, precache "/", app interactive
    await setupOnline(page);

    // 2. go offline, reload, wait for P1 zone
    await page.context().setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(zone(page, 1)).toBeVisible();
    const p1 = lifeTotal(zone(page, 1));
    const p2 = lifeTotal(zone(page, 2));

    // 3. read P1 (40), click +1 life → 41
    await expect(p1).toHaveText("40");
    await zone(page, 1).getByRole("button", { name: "+1 life" }).click();
    await expect(p1).toHaveText("41");

    // 4. click -1 life twice → 39; P2 stays 40
    await zone(page, 1).getByRole("button", { name: "-1 life" }).click();
    await zone(page, 1).getByRole("button", { name: "-1 life" }).click();
    await expect(p1).toHaveText("39");
    await expect(p2).toHaveText("40");

    // 5. cleanup
    await page.context().setOffline(false);
  });

  test("SM-PWA-07: /api/* never cached (SPEC 9.11)", async ({ page }) => {
    test.setTimeout(60_000);
    // 1. fresh context; install + activate SW
    await setupOnline(page);

    // 2. scan every cache for /api/ entries
    const hits = await page.evaluate(async () => {
      const bad: string[] = [];
      for (const k of await caches.keys()) {
        const c = await caches.open(k);
        for (const r of await c.keys()) {
          if (new URL(r.url).pathname.startsWith("/api/")) bad.push(r.url);
        }
      }
      return bad;
    });
    // expect: no cache entry whose pathname starts with /api/
    expect(hits).toEqual([]);
  });

  test("SM-PWA-08: Cache is versioned — mtg-life-v2, no stale v1", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // 1. fresh context; install + activate SW
    await setupOnline(page);

    // 2. read cache keys
    const keys = await page.evaluate(() => caches.keys());
    // expect: current version cache present
    expect(keys).toContain("mtg-life-v2");
    // expect: stale v1 purged
    expect(keys).not.toContain("mtg-life-v1");

    // 3. cross-check /sw.js CACHE const matches the found key
    const sw = await page.request.get("/sw.js");
    const swText = await sw.text();
    const match = swText.match(/CACHE\s*=\s*"([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(keys.find((k) => k.startsWith("mtg-life-")));
  });

  test("SM-PWA-09: Offline navigation fallback — unknown route serves app shell", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // 1. fresh context; install + activate SW
    await setupOnline(page);

    // 2. go offline; navigate to a nonexistent route
    await page.context().setOffline(true);
    await page.goto("/some-nonexistent-route", {
      waitUntil: "domcontentloaded",
    });
    // expect: no browser error page
    const bodyText = await page.locator("body").innerText();
    for (const s of ERROR_PAGE_STRINGS) expect(bodyText).not.toContain(s);
    // expect: app shell renders — 2 zones, life 40, +1 life button
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      2,
    );
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
    await expect(
      page.getByRole("button", { name: "+1 life" }).first(),
    ).toBeVisible();
    // expect: URL unchanged (fallback is a response, not a redirect)
    expect(page.url()).toBe("http://localhost:3000/some-nonexistent-route");

    // 3. cleanup
    await page.context().setOffline(false);
  });

  test("SM-PWA-10: PWA metadata present", async ({ page }) => {
    // 1. goto /
    await page.goto("/");

    // 2. head assertions
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#292A2A",
    );
    await expect(
      page.locator('meta[name="apple-mobile-web-app-title"]'),
    ).toHaveAttribute("content", "Life Counter");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("MTG Life Counter");
    await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(
      1,
    );
  });
});
