// spec: specs/persistence.plan.md — IndexedDB persistence (SPEC §3/§4/§5/§8)
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── IDB helpers (DB name `mtg-life-counter`, version 2 — idb.ts DB_VERSION) ── */

const STORE_INIT = "game-init";
const STORE_STATE = "game-state";
const KEY_INIT = "init";
const KEY_STATE = "state";

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

/* ── §5 data-model shapes (mirrors SPEC.md §5) ── */

interface Counter {
  id: string;
  type: "poison" | "energy" | "experience" | "time" | "custom" | string;
  value: number;
  name?: string;
}

interface CommanderDamage {
  playerId: number;
  value: number;
}

interface PlayerState {
  playerId: number;
  life: number;
  color: string[];
  commanderDamage: CommanderDamage[];
  counters: Counter[];
}

interface GameInit {
  players: number;
  initialLife: number;
  playerColors: Record<string, string[]>;
}

interface GameStateRecord {
  playerStates: PlayerState[];
}

const readInit = (page: Page): Promise<GameInit | undefined> =>
  readIdb<GameInit>(page, STORE_INIT, KEY_INIT);

const readState = (page: Page): Promise<GameStateRecord | undefined> =>
  readIdb<GameStateRecord>(page, STORE_STATE, KEY_STATE);

/** §3 defaults — four base counters (never empty, cleared on reset). */
const DEFAULT_COUNTERS: Counter[] = [
  { id: "poison", type: "poison", value: 0 },
  { id: "energy", type: "energy", value: 0 },
  { id: "experience", type: "experience", value: 0 },
  { id: "time", type: "time", value: 0 },
];

/** Zone mana colors → CSS background (DESIGN.md §2.1, §8.5.1). */
const BG = {
  red: "rgb(228, 153, 119)",
  white: "rgb(248, 246, 216)",
  blue: "rgb(193, 215, 233)",
} as const;

/* ── UI helpers (verbatim conventions from app-smoke / player-selector specs) ── */

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

/** Navigate to / and wait for hydration: the client hydrator self-seeds both
 *  stores once it resolves (§4.1/§4.2). On reload the records already exist,
 *  so the polls resolve immediately with the restored values. */
async function gotoApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect.poll(() => readInit(page)).toBeDefined();
  await expect.poll(() => readState(page)).toBeDefined();
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

/** Value span preceding the `+1 <name> counter` button in the Counters overlay. */function counterValue(dlg: Locator, name: string): Locator {
  const btn = dlg.getByRole("button", { name: `+1 ${name} counter` });
  return btn.locator("xpath=./preceding-sibling::*[@aria-live='polite']");
}

/** Same as counterValue, but pinned to the nth row — needed when two rows
 *  share the same name (custom-counter id-collision, PERS-03). */
function counterValueAt(dlg: Locator, name: string, index: number): Locator {
  const btn = dlg
    .getByRole("button", { name: `+1 ${name} counter` })
    .nth(index);
  return btn.locator("xpath=./preceding-sibling::*[@aria-live='polite']");
}

/** Builds the §3 default PlayerState record for a fresh game. */
function defaultPlayerState(id: number): PlayerState {
  return {
    playerId: id,
    life: 40,
    color: ["r"],
    commanderDamage: [
      { playerId: 0, value: 0 },
      { playerId: 1, value: 0 },
    ],
    counters: DEFAULT_COUNTERS,
  };
}

/** [life0, life1, ...] from the persisted game-state record. */
async function persistedLives(
  page: Page,
): Promise<number[] | undefined> {
  const rec = await readState(page);
  return rec?.playerStates.map((ps) => ps.life);
}

/* ───────────────────────────────────────────────
 * PERS-01 — Clean first load shows §3 defaults and self-seeds both stores
 * ─────────────────────────────────────────────── */

test.describe("PERS-01 — Clean first load shows §3 defaults and self-seeds both stores", () => {
  test("Clean load renders defaults and seeds game-init + game-state", async ({
    page,
  }) => {
    // 1. Navigate to /
    await gotoApp(page);

    // expect: exactly 2 player regions
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      2,
    );
    // expect: P1 life 40, P2 life 40
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
    // expect: both zones red (default color ["r"])
    await expect(zone(page, 1)).toHaveCSS("background-color", BG.red);
    await expect(zone(page, 2)).toHaveCSS("background-color", BG.red);

    // 2. Read game-init store — app self-seeds the default record (§4.1)
    await expect.poll(() => readInit(page)).toEqual({
      players: 2,
      initialLife: 40,
      playerColors: { "0": ["r"], "1": ["r"] },
    });

    // 3. Read game-state store (§5 schema)
    await expect.poll(() => readState(page)).toEqual({
      playerStates: [defaultPlayerState(0), defaultPlayerState(1)],
    });
  });
});

/* ───────────────────────────────────────────────
 * PERS-02 — Life persists across reload (both players)
 * ─────────────────────────────────────────────── */

test.describe("PERS-02 — Life persists across reload (both players)", () => {
  test("Life totals survive a reload", async ({ page }) => {
    // 1. Navigate to /; tap P1 -1 life 3×, P2 +1 life 5×
    await gotoApp(page);
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 3; i++) await p1Minus.click();
    const p2Plus = zone(page, 2).getByRole("button", { name: "+1 life" });
    for (let i = 0; i < 5; i++) await p2Plus.click();

    // expect: P1 37, P2 45
    await expect(lifeTotal(zone(page, 1))).toHaveText("37");
    await expect(lifeTotal(zone(page, 2))).toHaveText("45");

    // 2. Poll game-state before reload (async idbPut must land first)
    await expect.poll(() => persistedLives(page)).toEqual([37, 45]);

    // 3. Navigate to / again (reload, same context — IDB survives)
    await gotoApp(page);
    // expect: P1 37, P2 45 (auto-retry tolerates the SSR-default flash)
    await expect(lifeTotal(zone(page, 1))).toHaveText("37");
    await expect(lifeTotal(zone(page, 2))).toHaveText("45");

    // 4. Read game-state again
    // expect: [37, 45] unchanged (restore did not overwrite the source)
    await expect.poll(() => persistedLives(page)).toEqual([37, 45]);
  });
});

/* ───────────────────────────────────────────────
 * PERS-03 — Counters persist across reload (defaults + custom, id-collision check)
 * ─────────────────────────────────────────────── */

test.describe("PERS-03 — Counters persist across reload (defaults + custom, id-collision)", () => {
  test("Default + custom counters restore, duplicate-name ids stay distinct", async ({
    page,
  }) => {
    // 1. Navigate to /; open P1 Counters overlay (2p: 180° slot → physical left)
    await gotoApp(page);
    await swipeOn(zone(page, 1), "left");
    const counters = page.getByRole("dialog", { name: "Counters" });
    await expect(counters).toBeVisible();

    // 2. Adjust defaults via +1 <name> counter: poison +2, energy +1, exp +3, time +4
    const tapPlus = async (name: string, n: number) => {
      const btn = counters.getByRole("button", { name: `+1 ${name} counter` });
      for (let i = 0; i < n; i++) await btn.click();
    };
    await tapPlus("poison", 2);
    await tapPlus("energy", 1);
    await tapPlus("experience", 3);
    await tapPlus("time", 4);
    // expect: counterValue reads 2 / 1 / 3 / 4
    await expect(counterValue(counters, "poison")).toHaveText("2");
    await expect(counterValue(counters, "energy")).toHaveText("1");
    await expect(counterValue(counters, "experience")).toHaveText("3");
    await expect(counterValue(counters, "time")).toHaveText("4");

    // 3. Add custom counter "Lore"; tap +1 Lore counter 5×
    await counters.getByRole("button", { name: "Add custom counter" }).click();
    const customDlg = page.getByRole("dialog", { name: "Custom Counter" });
    await customDlg.getByRole("textbox", { name: "Counter name" }).fill("Lore");
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();
    // expect: pill [aria-label="Lore counter"] visible
    await expect(counters.locator('[aria-label="Lore counter"]')).toBeVisible();
    await tapPlus("Lore", 5);
    // expect: value 5
    await expect(counterValue(counters, "Lore")).toHaveText("5");

    // 4. Escape to close overlay; poll state, then reload
    await page.keyboard.press("Escape");
    await expect(counters).not.toBeVisible();
    await expect
      .poll(() =>
        readState(page).then(
          (r) =>
            r?.playerStates[0]?.counters.find((c) => c.type === "custom")
              ?.value === 5,
        ),
      )
      .toBe(true);
    await gotoApp(page);

    // 5. Reopen P1 Counters overlay
    await swipeOn(zone(page, 1), "left");
    await expect(counters).toBeVisible();
    // expect: defaults restored
    await expect(counterValue(counters, "poison")).toHaveText("2");
    await expect(counterValue(counters, "energy")).toHaveText("1");
    await expect(counterValue(counters, "experience")).toHaveText("3");
    await expect(counterValue(counters, "time")).toHaveText("4");
    // expect: "Lore" pill present, value 5 (custom id `custom-<ts36>` survives)
    await expect(counters.locator('[aria-label="Lore counter"]')).toBeVisible();
    await expect(counterValue(counters, "Lore")).toHaveText("5");

    // 6. Collision check: add ANOTHER custom counter also named "Lore"
    await counters.getByRole("button", { name: "Add custom counter" }).click();
    await customDlg.getByRole("textbox", { name: "Counter name" }).fill("Lore");
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();
    // expect: 2 pills matching [aria-label="Lore counter"] (ids must not clash)
    await expect(counters.locator('[aria-label="Lore counter"]')).toHaveCount(2);
    // expect: counters grid rows = 6 (4 defaults + 2 custom)
    await expect(counters.locator("div.grid > div")).toHaveCount(6);
    // expect: two type:"custom" entries with different ids, both name "Lore"
    await expect
      .poll(() =>
        readState(page).then((r) => {
          const customs =
            r?.playerStates[0]?.counters.filter((c) => c.type === "custom") ??
            [];
          return (
            customs.length === 2 &&
            new Set(customs.map((c) => c.id)).size === 2 &&
            customs.every((c) => c.name === "Lore")
          );
        }),
      )
      .toBe(true);

    // 7. Tap +1 Lore counter on the NEW row only (.nth(1))
    await counters
      .getByRole("button", { name: "+1 Lore counter" })
      .nth(1)
      .click();
    // expect: new row value 1, restored row still 5 (adjusted by id, not name)
    await expect(counterValueAt(counters, "Lore", 1)).toHaveText("1");
    await expect(counterValueAt(counters, "Lore", 0)).toHaveText("5");
  });
});

/* ───────────────────────────────────────────────
 * PERS-04 — Commander damage persists across reload (value + life co-reduction)
 * ─────────────────────────────────────────────── */

test.describe("PERS-04 — Commander damage persists across reload", () => {
  test("Commander damage values and co-reduced life survive a reload", async ({
    page,
  }) => {
    // 1. Navigate to /; open P1 Commander Damage (2p: 180° slot → physical right)
    await gotoApp(page);
    await swipeOn(zone(page, 1), "right");
    const dlg = page.locator('dialog[id="commander-dmg-0"]');
    await expect(dlg).toBeVisible();

    // 2. Tap +1 on column 2 (opponent, .nth(1)) 3× and column 1 (own, .nth(0)) 2×
    const cdBtn = dlg.getByRole("button", { name: "+1 commander damage" });
    for (let i = 0; i < 3; i++) await cdBtn.nth(1).click();
    for (let i = 0; i < 2; i++) await cdBtn.nth(0).click();
    // expect: values [2, 3]
    await expect(dlg.locator('[aria-live="polite"]').nth(0)).toHaveText("2");
    await expect(dlg.locator('[aria-live="polite"]').nth(1)).toHaveText("3");
    // expect: P1 life 35 (40 − 5, §7.3 life co-reduction)
    await expect(lifeTotal(zone(page, 1))).toHaveText("35");

    // 3. Escape; poll state, then reload
    await page.keyboard.press("Escape");
    await expect(dlg).not.toBeVisible();
    await expect
      .poll(() =>
        readState(page).then(
          (r) =>
            r?.playerStates[0]?.life === 35 &&
            JSON.stringify(r.playerStates[0].commanderDamage) ===
              JSON.stringify([
                { playerId: 0, value: 2 },
                { playerId: 1, value: 3 },
              ]),
        ),
      )
      .toBe(true);
    await gotoApp(page);

    // 4. Reopen P1 Commander Damage
    await swipeOn(zone(page, 1), "right");
    await expect(dlg).toBeVisible();
    // expect: values [2, 3] restored
    await expect(dlg.locator('[aria-live="polite"]').nth(0)).toHaveText("2");
    await expect(dlg.locator('[aria-live="polite"]').nth(1)).toHaveText("3");
    // expect: P1 life 35 restored
    await expect(lifeTotal(zone(page, 1))).toHaveText("35");

    // 5. Read game-state
    await expect
      .poll(() => readState(page).then((r) => r?.playerStates[0]))
      .toEqual({
        playerId: 0,
        life: 35,
        color: ["r"],
        commanderDamage: [
          { playerId: 0, value: 2 },
          { playerId: 1, value: 3 },
        ],
        counters: DEFAULT_COUNTERS,
      });
  });
});

/* ───────────────────────────────────────────────
 * PERS-05 — Color identity persists across reload
 * ─────────────────────────────────────────────── */

test.describe("PERS-05 — Color identity persists across reload", () => {
  test("P1 blue and P2 red survive a reload via game-init", async ({ page }) => {
    // 1. Navigate to /; open P1 color picker
    await gotoApp(page);
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-0"]');
    await expect(picker).toBeVisible();

    // 2. Tap Blue mana, then Confirm color
    await picker.getByRole("button", { name: "Blue mana" }).click();
    await picker.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker).not.toBeVisible();
    // expect: P1 zone blue (WYSIWYG, §8.5.1)
    await expect(zone(page, 1)).toHaveCSS("background-color", BG.blue);

    // 3. Read game-init — blue persists as "u" (MTG WUBRG code, §5)
    await expect.poll(() => readInit(page)).toEqual({
      players: 2,
      initialLife: 40,
      playerColors: { "0": ["u"], "1": ["r"] },
    });

    // 4. Navigate to / (reload)
    await gotoApp(page);
    // expect: P1 still blue, P2 still red (restored from game-init)
    await expect(zone(page, 1)).toHaveCSS("background-color", BG.blue);
    await expect(zone(page, 2)).toHaveCSS("background-color", BG.red);

    // 5. Read game-init again — unchanged (color is a setup value, init only)
    await expect.poll(() => readInit(page)).toEqual({
      players: 2,
      initialLife: 40,
      playerColors: { "0": ["u"], "1": ["r"] },
    });
  });
});

/* ───────────────────────────────────────────────
 * PERS-06 — Restart (⟳) resets to initial life AND persists the reset
 * ─────────────────────────────────────────────── */

test.describe("PERS-06 — Restart (⟳) resets to initial life AND persists the reset", () => {
  test("Restart rewrites game-state, leaves game-init untouched", async ({
    page,
  }) => {
    // 1. Navigate to /; tap P1 -1 life 5× (35), P2 -1 life 2× (38)
    await gotoApp(page);
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 5; i++) await p1Minus.click();
    const p2Minus = zone(page, 2).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 2; i++) await p2Minus.click();
    // expect: P1 35, P2 38
    await expect(lifeTotal(zone(page, 1))).toHaveText("35");
    await expect(lifeTotal(zone(page, 2))).toHaveText("38");

    // 2. openBelt; tap Restart Life (no modal — §8.2 instant)
    await openBelt(page);
    await page.getByRole("button", { name: "Restart Life" }).click();
    // expect: no dialog open
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // expect: P1 40, P2 40 (reset to game-init.initialLife)
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");

    // 3. closeBelt; poll game-state — restart rewrote the store
    await closeBelt(page);
    await expect.poll(() => persistedLives(page)).toEqual([40, 40]);

    // 4. Read game-init — unchanged initialLife 40 (restart never writes init)
    await expect.poll(() => readInit(page)).toEqual({
      players: 2,
      initialLife: 40,
      playerColors: { "0": ["r"], "1": ["r"] },
    });

    // 5. Navigate to / (reload)
    await gotoApp(page);
    // expect: P1 40, P2 40 restored
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
    // store-level proof: 40 equals the SSR default, so a UI-only check could
    // pass pre-hydration — assert the persisted record too
    await expect.poll(() => persistedLives(page)).toEqual([40, 40]);
  });
});

/* ───────────────────────────────────────────────
 * PERS-07 — Set initial life (⚙️) resets ALL players AND persists both stores
 * ─────────────────────────────────────────────── */

test.describe("PERS-07 — Set initial life (⚙️) resets all players and persists both stores", () => {
  test("Initial life 20 resets lives in place and writes both stores", async ({
    page,
  }) => {
    // 1. Navigate to /; tap P1 -1 life 7× (33), P2 +1 life 4× (44)
    await gotoApp(page);
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 7; i++) await p1Minus.click();
    const p2Plus = zone(page, 2).getByRole("button", { name: "+1 life" });
    for (let i = 0; i < 4; i++) await p2Plus.click();
    // expect: P1 33, P2 44
    await expect(lifeTotal(zone(page, 1))).toHaveText("33");
    await expect(lifeTotal(zone(page, 2))).toHaveText("44");

    // 2. openBelt → Initial Life → Set initial life to 20
    await openBelt(page);
    await page.getByRole("button", { name: "Initial Life" }).click();
    await page.getByRole("button", { name: "Set initial life to 20" }).click();
    await expect(page.locator("dialog#initial-life-modal")).not.toBeVisible();
    // expect: P1 20 AND P2 20 — behavior change: SET_INITIAL_LIFE resets in place
    await expect(lifeTotal(zone(page, 1))).toHaveText("20");
    await expect(lifeTotal(zone(page, 2))).toHaveText("20");

    // 3. closeBelt; poll both stores (both written — §8.3)
    await closeBelt(page);
    await expect.poll(() => readInit(page)).toEqual({
      players: 2,
      initialLife: 20,
      playerColors: { "0": ["r"], "1": ["r"] },
    });
    await expect.poll(() => persistedLives(page)).toEqual([20, 20]);

    // 4. Navigate to / (reload)
    await gotoApp(page);
    // expect: P1 20, P2 20 restored
    await expect(lifeTotal(zone(page, 1))).toHaveText("20");
    await expect(lifeTotal(zone(page, 2))).toHaveText("20");
    // expect: game-init.initialLife still 20
    await expect.poll(() => readInit(page).then((r) => r?.initialLife)).toBe(20);
  });
});

/* ───────────────────────────────────────────────
 * PERS-08 — Set initial life SAME value still resets (SPEC §8.3 edge)
 * ─────────────────────────────────────────────── */

test.describe("PERS-08 — Set initial life SAME value still resets", () => {
  test("Selecting 40 when initialLife is already 40 still resets lives", async ({
    page,
  }) => {
    // 1. Navigate to /; tap P1 -1 life 3× (37)
    await gotoApp(page);
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 3; i++) await p1Minus.click();
    // expect: P1 37
    await expect(lifeTotal(zone(page, 1))).toHaveText("37");

    // 2. openBelt → Initial Life → Set initial life to 40 (equals current)
    await openBelt(page);
    await page.getByRole("button", { name: "Initial Life" }).click();
    await page.getByRole("button", { name: "Set initial life to 40" }).click();
    await expect(page.locator("dialog#initial-life-modal")).not.toBeVisible();
    // expect: P1 40 — reset performed even though the value did not change
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 3. closeBelt; read game-state — same-value selection still rewrites state
    await closeBelt(page);
    await expect.poll(() => persistedLives(page)).toEqual([40, 40]);

    // 4. Read game-init — initialLife still 40 (rewrite proves the action ran)
    await expect.poll(() => readInit(page)).toEqual({
      players: 2,
      initialLife: 40,
      playerColors: { "0": ["r"], "1": ["r"] },
    });
  });
});

/* ───────────────────────────────────────────────
 * PERS-09 — Player count UP (2→4) resets existing + appends new, persists
 * ─────────────────────────────────────────────── */

test.describe("PERS-09 — Player count UP (2→4) resets existing + appends new", () => {
  test("4 players persists: colors kept, lives reset, new players appended", async ({
    page,
  }) => {
    // 1. Navigate to /; set P1 color White
    await gotoApp(page);
    await zone(page, 1).getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-0"]');
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "White mana" }).click();
    await picker.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker).not.toBeVisible();
    // expect: P1 white
    await expect(zone(page, 1)).toHaveCSS("background-color", BG.white);

    // 2. Tap P1 -1 life 2× (38) — dirtied life, to prove reset
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 2; i++) await p1Minus.click();
    await expect(lifeTotal(zone(page, 1))).toHaveText("38");

    // 3. openBelt → Players → 4 players
    await openBelt(page);
    await page.getByRole("button", { name: "Players" }).click();
    await page.getByRole("button", { name: "4 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    // expect: 4 regions
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      4,
    );
    // expect: P1 still white, P1/P2 life 40 (existing reset via §8.1)
    await expect(zone(page, 1)).toHaveCSS("background-color", BG.white);
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
    // expect: P3/P4 red default, life 40 (appended — §8.4.1)
    for (const n of [3, 4]) {
      await expect(zone(page, n)).toHaveCSS("background-color", BG.red);
      await expect(lifeTotal(zone(page, n))).toHaveText("40");
    }

    // 4. closeBelt; read both stores
    await closeBelt(page);
    await expect.poll(() => readInit(page)).toEqual({
      players: 4,
      initialLife: 40,
      playerColors: { "0": ["w"], "1": ["r"], "2": ["r"], "3": ["r"] },
    });
    // expect: 4 playerStates, each commanderDamage length 4 (player-count invariant)
    await expect
      .poll(() =>
        readState(page).then(
          (r) =>
            r?.playerStates.length === 4 &&
            r.playerStates.every((ps) => ps.commanderDamage.length === 4),
        ),
      )
      .toBe(true);

    // 5. Navigate to / (reload)
    await gotoApp(page);
    // expect: 4 regions restored; P1 white; all lives 40
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      4,
    );
    await expect(zone(page, 1)).toHaveCSS("background-color", BG.white);
    for (const n of [1, 2, 3, 4]) {
      await expect(lifeTotal(zone(page, n))).toHaveText("40");
    }
  });
});

/* ───────────────────────────────────────────────
 * PERS-10 — Player count DOWN (4→2) resets + removes, persists, no leftovers
 * ─────────────────────────────────────────────── */

test.describe("PERS-10 — Player count DOWN (4→2) resets + removes, persists", () => {
  test("2 players after 4: removed states gone, records rebuilt, no leftovers", async ({
    page,
  }) => {
    // 1. Navigate to /; openBelt → Players → 4 players; closeBelt
    await gotoApp(page);
    await openBelt(page);
    await page.getByRole("button", { name: "Players" }).click();
    await page.getByRole("button", { name: "4 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    await closeBelt(page);

    // 2. Tap P4 +1 life 6× (46), P1 +1 life 2× (42)
    const p4Plus = zone(page, 4).getByRole("button", { name: "+1 life" });
    for (let i = 0; i < 6; i++) await p4Plus.click();
    const p1Plus = zone(page, 1).getByRole("button", { name: "+1 life" });
    for (let i = 0; i < 2; i++) await p1Plus.click();
    // expect: P4 46, P1 42
    await expect(lifeTotal(zone(page, 4))).toHaveText("46");
    await expect(lifeTotal(zone(page, 1))).toHaveText("42");

    // 3. openBelt → Players → 2 players
    await openBelt(page);
    await page.getByRole("button", { name: "Players" }).click();
    await page.getByRole("button", { name: "2 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    // expect: exactly 2 regions (P3/P4 gone)
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      2,
    );
    // expect: P1/P2 life 40 (reset — §8.4.2)
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");

    // 4. closeBelt; read both stores
    await closeBelt(page);
    // expect: game-init players 2, playerColors only keys "0","1" (trimmed)
    await expect.poll(() => readInit(page)).toEqual({
      players: 2,
      initialLife: 40,
      playerColors: { "0": ["r"], "1": ["r"] },
    });
    // expect: exactly 2 playerStates, ids [0,1], commanderDamage length 2 all 0,
    // and NO entry with playerId 2 or 3 (record rewritten wholesale)
    await expect
      .poll(() =>
        readState(page).then((r) => {
          if (!r || r.playerStates.length !== 2) return false;
          return (
            r.playerStates.map((ps) => ps.playerId).join(",") === "0,1" &&
            r.playerStates.every(
              (ps) =>
                ps.commanderDamage.length === 2 &&
                ps.commanderDamage.every((cd) => cd.value === 0),
            ) &&
            !r.playerStates.some((ps) => ps.playerId === 2 || ps.playerId === 3)
          );
        }),
      )
      .toBe(true);

    // 5. Navigate to / (reload)
    await gotoApp(page);
    // expect: 2 regions; both 40
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      2,
    );
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");
    await expect(lifeTotal(zone(page, 2))).toHaveText("40");
    // expect: stores still exactly 2 players, no leftover keys
    await expect
      .poll(() =>
        readInit(page).then(
          (r) => Object.keys(r?.playerColors ?? {}).join(","),
        ),
      )
      .toBe("0,1");
  });
});

/* ───────────────────────────────────────────────
 * PERS-11 — Same player count selection still resets (SPEC §8.4.3 edge)
 * ─────────────────────────────────────────────── */

test.describe("PERS-11 — Same player count selection still resets", () => {
  test("Re-selecting 4 players clears custom counters and resets lives", async ({
    page,
  }) => {
    // 1. Navigate to /; openBelt → Players → 4 players; closeBelt
    await gotoApp(page);
    await openBelt(page);
    await page.getByRole("button", { name: "Players" }).click();
    await page.getByRole("button", { name: "4 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    await closeBelt(page);

    // 2. Tap P1 -1 life 5× (35)
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 5; i++) await p1Minus.click();
    // expect: P1 35
    await expect(lifeTotal(zone(page, 1))).toHaveText("35");

    // 3. Add custom counter "Lore" to P1 (4p: 90° slot → Counters = swipeY DOWN)
    await swipeY(zone(page, 1), "down");
    const counters = page.getByRole("dialog", { name: "Counters" });
    await expect(counters).toBeVisible();
    await counters.getByRole("button", { name: "Add custom counter" }).click();
    const customDlg = page.getByRole("dialog", { name: "Custom Counter" });
    await customDlg.getByRole("textbox", { name: "Counter name" }).fill("Lore");
    await page.keyboard.press("Enter");
    await expect(customDlg).not.toBeVisible();
    // expect: Lore pill visible
    await expect(counters.locator('[aria-label="Lore counter"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(counters).not.toBeVisible();

    // 4. openBelt → Players → 4 players again (same count)
    await openBelt(page);
    await page.getByRole("button", { name: "Players" }).click();
    await page.getByRole("button", { name: "4 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    await closeBelt(page);
    // expect: still exactly 4 regions
    await expect(page.getByRole("region", { name: /^Player \d:/ })).toHaveCount(
      4,
    );
    // expect: P1 40 — same-count selection still performs the §8.1 reset
    await expect(lifeTotal(zone(page, 1))).toHaveText("40");

    // 5. Reopen P1 Counters (swipeY down)
    await swipeY(zone(page, 1), "down");
    await expect(counters).toBeVisible();
    // expect: "Lore" gone — custom counters cleared on common reset (§8.1)
    await expect(counters.locator('[aria-label="Lore counter"]')).toHaveCount(0);
    // expect: exactly 4 default counter rows, all at 0
    await expect(counters.locator("div.grid > div")).toHaveCount(4);
    for (const name of ["poison", "energy", "experience", "time"]) {
      await expect(counterValue(counters, name)).toHaveText("0");
    }
  });
});

/* ───────────────────────────────────────────────
 * PERS-12 — game-init vs game-state split: exact schemas after actions
 * ─────────────────────────────────────────────── */

test.describe("PERS-12 — game-init vs game-state split: exact schemas", () => {
  test("Setup writes go to game-init, live writes to game-state only", async ({
    page,
  }) => {
    // 1. Navigate to /; read both stores — exact schemas (§5)
    await gotoApp(page);
    // expect: game-init is EXACTLY { players, initialLife, playerColors } (3 fields)
    await expect.poll(() => readInit(page)).toEqual({
      players: 2,
      initialLife: 40,
      playerColors: { "0": ["r"], "1": ["r"] },
    });
    // expect: game-state is EXACTLY { playerStates } (1 field)
    await expect
      .poll(() =>
        readState(page).then(
          (r) =>
            !!r &&
            Object.keys(r).length === 1 &&
            Array.isArray(r.playerStates) &&
            r.playerStates.length === 2,
        ),
      )
      .toBe(true);

    // 2. openBelt → Initial Life → 30; re-open belt → Players → 4 players; P2 color Blue
    await openBelt(page);
    await page.getByRole("button", { name: "Initial Life" }).click();
    await page.getByRole("button", { name: "Set initial life to 30" }).click();
    await expect(page.locator("dialog#initial-life-modal")).not.toBeVisible();
    // The Initial Life tap auto-collapsed the belt (DESIGN §5.2) — re-open it
    // before tapping the next belt action.
    await openBelt(page);
    await page.getByRole("button", { name: "Players" }).click();
    await page.getByRole("button", { name: "4 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    // Both action taps auto-collapse the belt (DESIGN §5.2); closeBelt is now
    // an idempotent no-op toggle that waits for the collapse to settle before
    // touching zone buttons.
    await closeBelt(page);
    await zone(page, 2).getByRole("button", { name: "Change color" }).click();
    const picker = page.locator('dialog[id="color-picker-1"]');
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Blue mana" }).click();
    await picker.getByRole("button", { name: "Confirm color" }).click();
    await expect(picker).not.toBeVisible();

    // expect: game-init exact record (blue persists as "u")
    await expect.poll(() => readInit(page)).toEqual({
      players: 4,
      initialLife: 30,
      playerColors: { "0": ["r"], "1": ["u"], "2": ["r"], "3": ["r"] },
    });
    // expect: game-state = 4 full PlayerState records
    await expect
      .poll(() =>
        readState(page).then((r) => {
          if (!r || r.playerStates.length !== 4) return false;
          return r.playerStates.every(
            (ps) =>
              typeof ps.life === "number" &&
              Array.isArray(ps.color) &&
              Array.isArray(ps.commanderDamage) &&
              ps.commanderDamage.length === 4 &&
              Array.isArray(ps.counters) &&
              ps.counters.length === 4,
          );
        }),
      )
      .toBe(true);

    // 3. Tap P1 -1 life 2× (28); read both stores
    const p1Minus = zone(page, 1).getByRole("button", { name: "-1 life" });
    for (let i = 0; i < 2; i++) await p1Minus.click();
    await expect(lifeTotal(zone(page, 1))).toHaveText("28");
    // expect: game-state P1 life 28 — live writes go to state only
    await expect
      .poll(() => readState(page).then((r) => r?.playerStates[0]?.life))
      .toBe(28);
    // expect: game-init UNCHANGED — setup writes only on setup actions
    await expect.poll(() => readInit(page)).toEqual({
      players: 4,
      initialLife: 30,
      playerColors: { "0": ["r"], "1": ["u"], "2": ["r"], "3": ["r"] },
    });
  });
});
