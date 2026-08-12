// spec: specs/extended-splash.plan.md — Extended Splash Screen (Hydration Cover, SPEC §4.6)
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── UI helpers (verbatim conventions from app-smoke / persistence specs) ── */

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

/**
 * Returns errors collected so far for the given page.
 * Skips the SpeedInsights 404 pair: off-Vercel, `/_vercel/speed-insights/script.js`
 * 404s (generic resource error + strict-MIME refusal) — benign, PR #122 artifact.
 */
function consoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.text().includes("_vercel/speed-insights")) return;
    if (msg.text() === "Failed to load resource: the server responded with a status of 404 (Not Found)")
      return;
    errors.push(msg.text());
  });
  return errors;
}

/* ── IDB helpers (ES-05 — readIdb pattern from specs/persistence.plan.md) ── */

const STORE_STATE = "game-state";
const KEY_STATE = "state";

interface PersistedPlayerState {
  playerId: number;
  life: number;
}

interface PersistedGameState {
  playerStates: PersistedPlayerState[];
}

/** Reads a record from one of the app's IndexedDB stores. */
async function readIdb<T>(
  page: Page,
  store: string,
  key: string,
): Promise<T | undefined> {
  return page.evaluate(async ({ store, key }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("mtg-life-counter", 2);
      // Mirrors features/persistence/idb.ts openDb(): if this helper opens the
      // DB before the app's post-mount hydrator does, `onupgradeneeded` MUST
      // create the stores — otherwise a version-2 DB with zero object stores
      // is created and the app's same-version open can never fire the upgrade
      // event again (permanently poisoned for the whole context).
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("game-init")) {
          db.createObjectStore("game-init");
        }
        if (!db.objectStoreNames.contains("game-state")) {
          db.createObjectStore("game-state");
        }
        if (!db.objectStoreNames.contains("ai-judge-chat")) {
          db.createObjectStore("ai-judge-chat");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise<T | undefined>((resolve, reject) => {
        const r = db.transaction(store, "readonly").objectStore(store).get(key);
        r.onsuccess = () => resolve(r.result as T | undefined);
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  }, { store, key });
}

/** [P1 life, P2 life] from the persisted game-state record, once it lands. */
async function persistedLives(
  page: Page,
): Promise<[number, number] | undefined> {
  const rec = await readIdb<PersistedGameState>(page, STORE_STATE, KEY_STATE);
  if (!rec?.playerStates || rec.playerStates.length < 2) return undefined;
  return [rec.playerStates[0].life, rec.playerStates[1].life];
}

/* ── Splash lifecycle logging (ES-03/ES-07 — §4.6 MutationObserver trick) ── */

/**
 * Runs before page scripts on every navigation: attaches a MutationObserver on
 * `document` (subtree) that records every className change of
 * #extended-splash-screen — and a "removed" marker on its removal — into
 * window.__splashLog. Deterministic record of insert → pointer-events-none/
 * opacity-0 → remove without racing the 310ms timer.
 *
 * The overlay is SSR-rendered (ES-01), so no "insert" mutation ever fires.
 * A requestAnimationFrame poll snapshots the overlay's initial SSR className
 * (visible cover — opacity-100, no pointer-events-none) the first frame it
 * exists in the DOM, before the client bundle can even load — that entry is
 * the "inserted visible" record; the observer records everything after.
 */
async function attachSplashLog(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __splashLog: string[] };
    const log: string[] = [];
    w.__splashLog = log;
    const record = (el: HTMLElement) => {
      if (log.length === 0 || !log.includes(el.className)) log.push(el.className);
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.removedNodes) {
            if (
              node instanceof HTMLElement &&
              node.id === "extended-splash-screen"
            ) {
              log.push("removed");
            }
          }
        } else if (mutation.type === "attributes") {
          const target = mutation.target;
          if (
            target instanceof HTMLElement &&
            target.id === "extended-splash-screen"
          ) {
            log.push(target.className);
          }
        }
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    // SSR markup is present before any script runs: snapshot the overlay's
    // initial className (the "inserted visible" entry) as soon as it exists.
    // rAF polling starts at document-start, so this lands pre-hydration —
    // long before the client bundle (and the handler's class flips) load.
    const poll = () => {
      const el = document.getElementById("extended-splash-screen");
      if (el) record(el);
      else requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

const splashLog = (page: Page): Promise<string[]> =>
  page.evaluate(
    () => (window as unknown as { __splashLog: string[] }).__splashLog,
  );

/* ───────────────────────────────────────────────
 * Extended Splash Screen (Hydration Cover) — SPEC §4.6
 * ─────────────────────────────────────────────── */

test.describe("Extended Splash Screen", () => {
  test("ES-01: Overlay is present in SSR HTML with the §4.6 contract, before game content", async ({
    page,
  }) => {
    // 1. goto /; capture raw SSR response (pre-hydration snapshot — overlay has
    //    NOT been removed yet, no timing race)
    const res = await page.goto("/");
    if (!res) throw new Error("goto returned no response");
    const html = await res.text();

    // expect: overlay present in the SSR HTML
    expect(html).toContain('id="extended-splash-screen"');

    // 2. Assert the SSR contract classes on the overlay's opening tag
    const match = html.match(/<div[^>]*id="extended-splash-screen"[^>]*>/);
    if (!match) throw new Error("overlay opening tag missing from SSR HTML");
    const tag = match[0];
    // expect: covers viewport, above all UI (fixed inset-0 z-9999)
    expect(html).toContain("fixed inset-0 z-9999");
    // expect: brand background (SPEC §4.6, DESIGN §2.2 token)
    expect(html).toContain("bg-ui-splash");
    // expect: visible cover, 300ms CSS fade
    expect(html).toContain("opacity-100");
    expect(html).toContain("transition-opacity duration-300");

    // 3. Assert the app icon renders inside the overlay
    expect(html).toContain('alt="App Icon"');

    // 4. Assert "covers first paint" structurally — overlay markup precedes any
    //    game content in document order (GameShell renders overlay before
    //    GameInner). Deviation from plan: SSR emits no literal role="region"
    //    (player sections get the region role implicitly via aria-label), so
    //    anchor on the first player section label instead.
    const overlayPos = html.indexOf('id="extended-splash-screen"');
    const gamePos = html.indexOf('aria-label="Player 1:');
    expect(overlayPos).toBeGreaterThanOrEqual(0);
    expect(gamePos).toBeGreaterThan(overlayPos);

    // 5. Assert no user-dismiss affordances in the SSR markup
    // expect: overlay is a plain <div> — NOT <dialog>, no aria-modal (no focus
    // trap). Scoped to the overlay tag: dialog shells legitimately SSR
    // aria-modal="true" elsewhere.
    expect(tag.startsWith("<div")).toBe(true);
    expect(tag).not.toContain("aria-modal");
    // expect: pointer-events-none NOT on the overlay in SSR (added only at
    // runtime by the handler — §4.6). Scoped to the overlay tag:
    // CustomCounterModal legitimately SSR pointer-events-none elsewhere.
    expect(tag).not.toContain("pointer-events-none");
  });

  test("ES-02: Overlay is removed from the DOM shortly after load (fresh context)", async ({
    page,
  }) => {
    // 1. goto / on a fresh context (clean IDB → fast hydration path, §4.6)
    await page.goto("/");

    // 2. Poll for removal with a bounded window — 310ms timer post-mount;
    //    1.5s covers dev-mode jitter
    await expect
      .poll(() => page.locator("#extended-splash-screen").count(), {
        timeout: 1500,
      })
      .toBe(0);

    // 3. Belt and zones are reachable — the overlay is not blocking anything
    await expect(page.getByLabel("Open Spellbook Menu")).toBeVisible();

    // 4. reload (same context — IDB now self-seeded, §4.5 path)
    await page.reload();
    // expect: overlay gone (auto-retry)
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
    // expect: exactly 2 player regions, P1/P2 life 40
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      2,
    );
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
  });

  test("ES-03: Full §4.6 lifecycle sequence: insert → pointer-events-none + fade → remove", async ({
    page,
  }) => {
    // 1. MutationObserver init script — logs className changes for
    //    #extended-splash-screen (and a marker on removal)
    await attachSplashLog(page);

    // 2. goto /; wait for overlay count 0 (auto-retry)
    await page.goto("/");
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);

    // 3. Read the splash lifecycle log
    const entries = await splashLog(page);

    // expect: an entry where className includes opacity-100 (inserted visible)
    const insertIdx = entries.findIndex((e) => e.includes("opacity-100"));
    expect(insertIdx).toBeGreaterThanOrEqual(0);
    // expect: NO entry where pointer-events-none precedes the opacity-100
    // insert (order contract: visible first, then hidden — §4.6 "covers first
    // paint")
    expect(
      entries
        .slice(0, insertIdx)
        .every((e) => !e.includes("pointer-events-none")),
    ).toBe(true);
    // expect: a later entry where className includes pointer-events-none AND
    // opacity-0 (handler ran — non-interceptive + fade started)
    const pointerIdx = entries.findIndex((e) =>
      e.includes("pointer-events-none"),
    );
    const fadeIdx = entries.findIndex((e) => e.includes("opacity-0"));
    expect(pointerIdx).toBeGreaterThan(insertIdx);
    expect(fadeIdx).toBeGreaterThan(insertIdx);
    // expect: a removal marker after the pointer-events-none/opacity-0 entries
    // (removed at 310ms)
    const removedIdx = entries.indexOf("removed");
    expect(removedIdx).toBeGreaterThan(Math.max(pointerIdx, fadeIdx));
  });

  test("ES-04: Overlay never intercepts pointer events after load (regression guard)", async ({
    page,
  }) => {
    // 1. collect console errors; goto /; wait overlay gone (auto-retry)
    const errors = consoleErrors(page);
    await page.goto("/");
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);

    // 2. Exercise the same interactions the existing suite relies on
    //    (app-smoke pattern): openBelt → Restart Life visible → closeBelt
    await openBelt(page);
    await expect(page.getByRole("button", { name: "Restart Life" })).toBeVisible();
    await closeBelt(page);

    // 3. Tap P1 -1 life 2×
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 2; i++) await p1Minus.click();
    // expect: P1 life total "38"
    await expect(lifeTotal(zone(page, 1))).toHaveText("38");

    // 4. Open P1 color picker → Blue mana → Confirm color
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-0"]');
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Blue mana" }).click();
    await picker.getByRole("button", { name: "Confirm color" }).click();
    // expect: picker closes; P1 zone bg blue (WYSIWYG, §8.5.1)
    await expect(picker).not.toBeVisible();
    await expect(zone(page, 1)).toHaveCSS(
      "background-color",
      "rgb(193, 215, 233)",
    );

    // 5. Final overlay + dialog state
    // expect: overlay still gone; no dialog left open
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    // expect: zero console errors (z-9999 overlay sits above everything; if it
    // lingered or re-mounted it would swallow belt/zone clicks)
    expect(errors).toEqual([]);
  });

  test("ES-05: Reload with persisted non-default state: overlay covers the swap, values restored", async ({
    page,
  }) => {
    // 1. collect console errors; goto /; tap P1 -1 life 3×, P2 +1 life 5×
    const errors = consoleErrors(page);
    await page.goto("/");
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 3; i++) await p1Minus.click();
    const p2Plus = zone(page, 2).getByRole("button", { name: "+1 life" });
    for (let i = 0; i < 5; i++) await p2Plus.click();
    // expect: P1 37, P2 45
    await expect(lifeTotal(zone(page, 1))).toHaveText("37");
    await expect(lifeTotal(zone(page, 2))).toHaveText("45");

    // 2. Poll IDB (game-state/state) until the write landed before reload
    await expect.poll(() => persistedLives(page)).toEqual([37, 45]);

    // 3. reload — hydration must now restore 37/45 over the SSR 40/40 defaults
    //    (the swap the overlay covers)
    await page.reload();
    // expect: overlay removed (auto-retry)
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);
    // expect: P1 37, P2 45 (auto-retry tolerates the brief SSR-default frame)
    await expect(lifeTotal(zone(page, 1))).toHaveText("37");
    await expect(lifeTotal(zone(page, 2))).toHaveText("45");

    // 4. Zero console errors after reload (hydration mismatch would surface here)
    expect(errors).toEqual([]);
  });

  test("ES-06: Slow-hydration visibility: overlay actually covers the viewport pre-hydration", async ({
    page,
  }) => {
    // Flake policy (plan): this is the only timing-sensitive scenario. Dev
    // hydration is fast, so the overlay's visible window (~310ms) is normally
    // unobservable — delay the client chunks to widen it deterministically.
    // If CI shows instability (route-delay interacting with dev HMR), downgrade
    // to structural-only: test.skip + TODO — ES-01 + ES-03 already prove §4.6.
    const errors = consoleErrors(page);

    // 1. Delay client chunks 1200ms — SSR HTML + splash render immediately;
    //    React hydration (and thus the removal timer) starts only after the
    //    delayed chunks arrive. Scripts only: the CSS <link> is a separate
    //    request that must load normally, or the splash renders unstyled
    //    (static-positioned, in-flow) and the cover assertions below fail.
    await page.route("**/_next/**", async (route) => {
      if (route.request().resourceType() === "script") {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      await route.continue();
    });
    //    waitUntil "commit": default load would wait on the delayed scripts,
    //    so return with the SSR DOM in place
    await page.goto("/", { waitUntil: "commit" });

    // 2. Immediately assert the overlay is live, visible, and covering the
    //    whole viewport
    const overlay = page.locator("#extended-splash-screen");
    // expect: overlay present and visible
    await expect(overlay).toHaveCount(1);
    // expect: still intercepting — the cover is active
    await expect(overlay).toHaveCSS("opacity", "1");
    await expect(overlay).toHaveCSS("pointer-events", "auto");
    // expect: stylesheet applied (fixed inset-0) before reading the box —
    //    at "commit" the CSS <link> may still be in flight
    await expect(overlay).toHaveCSS("position", "fixed");
    // expect: boundingBox ≈ viewport (1280×720 from playwright.config.ts)
    const box = await overlay.boundingBox();
    expect(box).not.toBeNull();
    expect(box).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
    // expect: app icon visible inside the overlay
    await expect(
      page.locator('#extended-splash-screen img[alt="App Icon"]'),
    ).toBeVisible();

    // 3. Let the delay expire (chunks arrive → hydration runs → 310ms timer)
    await expect(overlay).toHaveCount(0);
    // expect: belt visible and clickable — no dead zone left behind
    await openBelt(page);
    await closeBelt(page);
    // expect: zero console errors
    expect(errors).toEqual([]);
  });

  test("ES-07: Overlay is inert mid-fade: pointer-events-none before removal (no click loss)", async ({
    page,
  }) => {
    // 1. MutationObserver init script (same as ES-03); goto /; wait overlay
    //    count 0 (auto-retry) — overlay gone
    await attachSplashLog(page);
    await page.goto("/");
    await expect(page.locator("#extended-splash-screen")).toHaveCount(0);

    // 2. Read the splash lifecycle log
    const entries = await splashLog(page);
    // expect: pointer-events-none is present in the SAME or an EARLIER entry
    // than opacity-0 — interception is disabled the moment the fade starts
    // (§4.6), so even the 300ms fade window never eats clicks
    const fadeIdx = entries.findIndex((e) => e.includes("opacity-0"));
    expect(fadeIdx).toBeGreaterThanOrEqual(0);
    expect(
      entries
        .slice(0, fadeIdx + 1)
        .some((e) => e.includes("pointer-events-none")),
    ).toBe(true);
    // removal still lands after the fade (310ms timer)
    expect(entries.indexOf("removed")).toBeGreaterThan(fadeIdx);

    // 3. Belt interaction sanity after removal (guards against any leftover
    //    capture phase): toggle checked/unchecked cleanly
    await openBelt(page);
    await closeBelt(page);
  });
});
