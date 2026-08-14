# IndexedDB Persistence Test Plan

**Contracts under test:** SPEC.md §3 (defaults), §4 (two-store persistence + load priority),
§5 (data model), §8 (menu actions: 8.1 common reset, 8.2 restart, 8.3 initial life,
8.4 player selector, 8.5 color). DESIGN.md §5 (spellbook belt), §6 (modals),
§7 (gestures). DESIGN.md wins on conflicts (contract hierarchy).

**Behavior change to verify:** `SET_INITIAL_LIFE` and `SET_PLAYER_COUNT` previously did
NOT reset lives in place; they now bump `version` → `PlayerProvider` remount → §8.1
common reset. Every scenario below that touches ⚙️/👥 asserts the reset happens
immediately (pre-reload), not just after reload.

**Branch:** `feature/indexeddb-persistence`. Server: `pnpm dev` on `http://localhost:3000`
(playwright.config.ts has **no** `webServer` — the dev server must be running; seed spec
pattern assumes it).

## Application Overview

PWA life counter for Magic (2–6 players). State is split across two IndexedDB stores
(SPEC §4): `game-init` (key `"init"` — bootstrap settings: players, initialLife,
playerColors) and `game-state` (key `"state"` — live `{ playerStates: [...] }`). On load,
SSR renders §3 defaults (2 players, 40 life, red); a client hydrator reads both stores
post-mount (load priority: init → state → defaults) and remounts providers with restored
values. Every life/counter/commander-damage change rewrites `game-state`; every setup
action (player count, initial life, color) rewrites `game-init` **and** triggers a §8.1
common reset that also rewrites `game-state`.

**Verified live (exploration notes):** on a clean first load the app self-seeds BOTH
stores with default records once hydration resolves — `game-init` =
`{players:2, initialLife:40, playerColors:{0:["r"],1:["r"]}}` and `game-state` =
`{playerStates:[2 full records]}`. So "no persisted state" is observable only in a fresh
context before the first load completes, or at the UI level (defaults render).

## Shared Setup / Teardown

**Seed:** `tests/seed.spec.ts` (plain `page.goto('http://localhost:3000')`).

### IDB isolation between tests

- Playwright gives every test a **fresh browser context** by default, and
  playwright.config.ts sets no `storageState` — IndexedDB for origin `localhost:3000`
  is therefore **empty at each test's first `goto("/")`**. No explicit deletion is
  needed between tests. This is the primary isolation mechanism; do not add a
  `storageState` to the config or tests will start cross-polluted.
- If a test ever needs to wipe state mid-test, use the helper below. Caveat: the app
  holds one cached IDB connection (`dbPromise` in `features/persistence/idb.ts`), so
  `deleteDatabase` blocks until the app page unloads. Recipe: delete, and on `blocked`
  navigate away (unload closes the connection; the pending delete then completes):

```ts
async function resetIndexedDB(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("mtg-life-counter");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve(); // app connection open → resolve, then unload below
    });
  });
  await page.goto("/"); // unload drops the app connection; delete completes
}
```

- DB name: `mtg-life-counter`, version 1. Stores: `game-init` (key `"init"`),
  `game-state` (key `"state"`).

### Reading IDB from tests

Writes are async (`void idbPut`), so after the last UI change, poll the store with
`expect.poll` before reloading (guarantees the write landed before the navigation that
would otherwise race it):

```ts
async function readIdb<T>(page: Page, store: string, key: string): Promise<T | undefined> {
  return page.evaluate(async ({ store, key }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("mtg-life-counter", 1);
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
// usage: await expect.poll(() => readIdb(page, "game-state", "state")).toEqual({ playerStates: ... });
```

### Interaction caveats (learned from exploration + existing specs)

- **The open belt covers zone buttons** — after any belt action (Restart, ⚙️, 👥) the belt
  STAYS OPEN. `closeBelt` (toggle M again, then wait for `div.relative.z-50` height `0px`,
  per `app-smoke.spec.ts`) must run before touching zones, or clicks time out on the
  overlay. Reuse the `openBelt`/`closeBelt`/`swipeOn`/`swipeY`/`zone`/`lifeTotal`/
  `counterValue` helpers verbatim from `tests/e2e/app-smoke.spec.ts` /
  `tests/e2e/player-selector-modal.spec.ts`.
- **Hydration is async after `goto`/reload.** SSR paints §3 defaults first, then the
  hydrator restores. `expect(...).toHaveText()` auto-retries, so a flash of 40 before 37
  is harmless. BUT when the expected value equals the SSR default (e.g. restart-to-40),
  a UI assertion alone can pass pre-hydration — pair it with a store-level assertion
  (`expect.poll(readIdb)`) to prove hydration actually ran.
- **Zone color = inline `background` style** on the `<section role="region">`; solid color
  assertion via `toHaveCSS("background-color", ...)`: red `rgb(228, 153, 119)`, white
  `rgb(248, 246, 216)`, blue `rgb(193, 215, 233)`, black `rgb(102, 101, 101)`, green
  `rgb(163, 192, 149)`, colorless `rgb(202, 197, 192)`. Multi-color → equal-hard-stop
  to-bottom-right gradient (assert `el.style.background` / computed `background-image`):
  e.g. `["r","w"]` = red `rgb(228,153,119)` 0–50% + white `rgb(248,246,216)` 50–100%,
  `["r","u"]` = red 0–50% + blue `rgb(193,215,233)` 50–100% (§8.5.1: taps on default
  `["r"]` ADD; solid single color only via Colorless-clear then color).
- **Swipes are rotation-aware (2p):** P1 is a 180° slot → player-left (Commander Damage)
  = physical **right**; player-right (Counters) = physical **left**. P2 (0°) is the
  reverse. On 4p, P1/P2 top row are ±90° slots → use `swipeY`. (Same helper pattern as
  existing specs.)

### Shared helper cheat-sheet (selectors)

| Thing | Selector |
| --- | --- |
| Player zone | `getByRole("region", { name: /^Player n:/ })` |
| Life total | `zone.locator('[aria-live="polite"]')` |
| Belt toggle / open | `getByLabel("Open Spellbook Menu")` (+ `#spellbook-toggle` checked) |
| ⟳ Restart Life | `getByRole("button", { name: "Restart Life" })` |
| ⚙️ Initial Life | `getByRole("button", { name: "Initial Life" })` → `dialog#initial-life-modal`, presets `"Set initial life to 20/30/40/60"`, numpad `"[+] Add custom value"` → `spinbutton "Custom starting life"` → `"+ Add"` |
| 👥 Players | `getByRole("button", { name: "Players" })` → `dialog#player-selector-modal`, `"2 players"`…`"6 players"` |
| Gear / color picker | `zone.getByRole("button", { name: "Change color" })` → `dialog[id="color-picker-<playerId>"]`, mana buttons `"White|Blue|Black|Red|Green|Colorless mana"`, close `"Confirm color"` |
| Counters overlay | P1 2p: `swipeOn(zone,"left")` → `getByRole("dialog", { name: "Counters" })`; value = `+1 <name> counter` button's preceding `[aria-live="polite"]` sibling; rows = `dlg.locator("div.grid > div")` |
| Custom counter | `"Add custom counter"` → `getByRole("dialog", { name: "Custom Counter" })` → `textbox "Counter name"` → Enter; pill `dlg.locator('[aria-label="<name> counter"]')` |
| Commander overlay | P1 2p: `swipeOn(zone,"right")` → `dialog[id="commander-dmg-0"]`; `getByRole("button", { name: "+1 commander damage" })`; values = `dlg.locator('[aria-live="polite"]')` |

## Test Scenarios

### 1. PERS-01 — Clean first load shows §3 defaults and self-seeds both stores

**Prerequisites:** fresh context (clean IDB).
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`
   - expect: exactly 2 player regions (`/^Player \d:/` count = 2)
   - expect: P1 life 40, P2 life 40
   - expect: both zones red `rgb(228, 153, 119)` (default color `["r"]`)
2. Read `game-init` store (key `"init"`) with `expect.poll`
   - expect: `{ players: 2, initialLife: 40, playerColors: { "0": ["r"], "1": ["r"] } }`
     (app self-seeds the default record once hydration resolves — §4.1)
3. Read `game-state` store (key `"state"`)
   - expect: `playerStates` length 2, playerIds `[0, 1]`, each with life 40, color `["r"]`,
     `commanderDamage` length 2 (all 0), `counters` = exactly the 4 defaults
     (poison/energy/experience/time @ 0) — §5 schema

### 2. PERS-02 — Life persists across reload (both players)

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; tap P1 `-1 life` 3×, P2 `+1 life` 5×
   - expect: P1 37, P2 45
2. `expect.poll` read `game-state`
   - expect: `playerStates[0].life === 37`, `playerStates[1].life === 45`
3. Navigate to `/` again (reload, same context — IDB survives)
   - expect: P1 37, P2 45 (auto-retry tolerates the SSR-default flash)
4. Read `game-state` again
   - expect: `[37, 45]` unchanged (restore did not overwrite the source)

### 3. PERS-03 — Counters persist across reload (defaults + custom, id-collision check)

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; open P1 Counters overlay (`swipeOn(zone(page,1), "left")`)
2. Adjust defaults via `+1 <name> counter`: poison +2, energy +1, experience +3, time +4
   - expect: `counterValue` reads 2 / 1 / 3 / 4
3. Add custom counter "Lore" (`Add custom counter` → type `Lore` → Enter); tap `+1 Lore counter` 5×
   - expect: pill `[aria-label="Lore counter"]` visible, value 5
4. `Escape` to close overlay; navigate to `/` (reload)
5. Reopen P1 Counters overlay
   - expect: poison 2, energy 1, experience 3, time 4 — restored
   - expect: "Lore" pill present, value 5 — custom counter restored (§7, custom id `custom-<ts36>` survives)
6. **Collision check:** add ANOTHER custom counter also named "Lore"
   - expect: 2 pills matching `[aria-label="Lore counter"]` (count 2) — ids must not clash
   - expect: counters grid rows = 6 (4 defaults + 2 custom)
   - expect: read `game-state` → P1 `counters` contains two `type: "custom"` entries with
     **different** `id` values, both `name: "Lore"`
7. Tap `+1 Lore counter` on the NEW row only (`.nth(1)` — two buttons share the name, so
   strict-mode locators need `.nth()`/`.first()`)
   - expect: new row value 1, restored row still 5 (adjust targets by id, not name)

### 4. PERS-04 — Commander damage persists across reload (value + life co-reduction)

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; open P1 Commander Damage (`swipeOn(zone(page,1), "right")` →
   `dialog[id="commander-dmg-0"]`)
2. Tap `+1 commander damage` on column 2 (opponent, `.nth(1)`) 3× and column 1 (own,
   `.nth(0)`) 2×
   - expect: values `[2, 3]`
   - expect: P1 life = 35 (40 − 5, §7.3 life co-reduction)
3. `Escape`; navigate to `/` (reload)
4. Reopen P1 Commander Damage
   - expect: values `[2, 3]` restored
   - expect: P1 life 35 restored
5. Read `game-state`
   - expect: P1 `commanderDamage` = `[{playerId:0,value:2},{playerId:1,value:3}]`, `life: 35`

### 5. PERS-05 — Color identity persists across reload

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; open P1 color picker (`Change color` → `dialog[id="color-picker-0"]`)
2. Tap `Blue mana`, then `Confirm color`
   - expect: picker closes; P1 zone bg red+blue gradient (Blue ADDS to default `["r"]` → `["r","u"]`,
     red `rgb(228, 153, 119)` 0–50% + blue `rgb(193, 215, 233)` 50–100%; WYSIWYG, §8.5.1)
3. Read `game-init`
   - expect: `playerColors = { "0": ["r","u"], "1": ["r"] }`
4. Navigate to `/` (reload)
   - expect: P1 still red+blue gradient, P2 still red (restored from `game-init`)
5. Read `game-init` again
   - expect: unchanged `{"0":["r","u"],"1":["r"]}` — color is a setup value, written to init only

### 6. PERS-06 — Restart (⟳) resets to initial life AND persists the reset

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; tap P1 `-1 life` 5× (35), P2 `-1 life` 2× (38)
   - expect: P1 35, P2 38
2. `openBelt`; tap `Restart Life` (no modal — §8.2 instant)
   - expect: no dialog open
   - expect: P1 40, P2 40 (reset to `game-init.initialLife`)
3. `closeBelt`; `expect.poll` read `game-state`
   - expect: `[40, 40]` — restart **rewrote** `game-state` (this is the persistence claim)
4. Read `game-init`
   - expect: unchanged `initialLife: 40` — restart reads init, never writes it (§8.2)
5. Navigate to `/` (reload)
   - expect: P1 40, P2 40 restored; **also** read `game-state` → `[40, 40]` (store-level
     proof, since 40 equals the SSR default and a UI-only check could pass pre-hydration)

### 7. PERS-07 — Set initial life (⚙️) resets ALL players AND persists both stores

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; tap P1 `-1 life` 7× (33), P2 `+1 life` 4× (44)
   - expect: P1 33, P2 44
2. `openBelt` → `Initial Life` → `Set initial life to 20`
   - expect: modal closes
   - expect: P1 20 AND P2 20 — **behavior change**: SET_INITIAL_LIFE now resets lives in place
3. `closeBelt`; `expect.poll` read both stores
   - expect: `game-init` → `{ players: 2, initialLife: 20, playerColors: {...} }`
   - expect: `game-state` → both lives 20 (both stores written — §8.3)
4. Navigate to `/` (reload)
   - expect: P1 20, P2 20 restored; `game-init.initialLife` still 20

### 8. PERS-08 — Set initial life SAME value still resets (SPEC §8.3 edge)

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; tap P1 `-1 life` 3× (37)
   - expect: P1 37
2. `openBelt` → `Initial Life` → `Set initial life to 40` (equals current `initialLife`)
   - expect: P1 40 — reset performed even though the value did not change (§8.3 edge)
3. `closeBelt`; read `game-state`
   - expect: `[40, 40]` — same-value selection still rewrites state
4. Read `game-init`
   - expect: `initialLife` still 40 (no visible change, but store rewrite proves the action ran)

### 9. PERS-09 — Player count UP (2→4) resets existing + appends new, persists across reload

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; set P1 color White (picker → `White mana` → `Confirm color`; adds to default → `["r","w"]`)
   - expect: P1 red+white gradient (`rgb(228, 153, 119)` → `rgb(248, 246, 216)`)
2. Tap P1 `-1 life` 2× (38) — dirtied life, to prove reset
3. `openBelt` → `Players` → `4 players`
   - expect: modal closes; 4 regions
   - expect: P1 still red+white gradient, P1/P2 life 40 (existing players reset via §8.1 with new count)
   - expect: P3/P4 red default, life 40 (appended — §8.4.1)
4. `closeBelt`; read both stores
   - expect: `game-init` → `players: 4`, `playerColors` = `{"0":["r","w"],"1":["r"],"2":["r"],"3":["r"]}`
   - expect: `game-state` → 4 `playerStates`, each `commanderDamage` length 4 (array length =
     player count invariant, SPEC §5)
5. Navigate to `/` (reload)
   - expect: 4 regions restored; P1 red+white gradient; all lives 40

### 10. PERS-10 — Player count DOWN (4→2) resets + removes, persists, no leftover data

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; `openBelt` → `Players` → `4 players`; `closeBelt`
2. Tap P4 `+1 life` 6× (46), P1 `+1 life` 2× (42)
   - expect: P4 46, P1 42
3. `openBelt` → `Players` → `2 players`
   - expect: modal closes; exactly 2 regions (P3/P4 gone)
   - expect: P1/P2 life 40 (reset — §8.4.2)
4. `closeBelt`; read both stores
   - expect: `game-init` → `players: 2`, `playerColors` has ONLY keys `"0"`, `"1"` (trimmed)
   - expect: `game-state` → EXACTLY 2 `playerStates`, playerIds `[0, 1]`, each
     `commanderDamage` length 2 rebuilt to all 0 (§8.4.3) — **no entry with playerId 2 or 3
     remains** (record is rewritten wholesale by the registry, `setMap({})` on count change)
5. Navigate to `/` (reload)
   - expect: 2 regions; both 40; stores still exactly 2 players, no leftover keys

### 11. PERS-11 — Same player count selection still resets (SPEC §8.4.3 edge)

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; `openBelt` → `Players` → `4 players`; `closeBelt`
2. Tap P1 `-1 life` 5× (35)
   - expect: P1 35
3. Add custom counter "Lore" to P1 (P1 on 4p is a 90° slot → Counters opens with `swipeY(zone, "down")`)
   - expect: `[aria-label="Lore counter"]` visible
4. `openBelt` → `Players` → `4 players` again (same count)
   - expect: still exactly 4 regions
   - expect: P1 40 — same-count selection still performs the §8.1 reset (§8.4.3)
   - expect: "Lore" gone — custom counters cleared on common reset (§8.1)
5. Reopen P1 Counters (`swipeY` down)
   - expect: exactly 4 default counter rows, all at 0 (poison/energy/experience/time)

### 12. PERS-12 — game-init vs game-state split: exact schemas after actions

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Navigate to `/`; read both stores
   - expect: `game-init` record is EXACTLY `{ players, initialLife, playerColors }` (3 fields — §5)
   - expect: `game-state` record is EXACTLY `{ playerStates }` (1 field — §5)
2. `openBelt` → `Initial Life` → `30`; → `Players` → `4 players`; set P2 color Blue
   (picker `color-picker-1` → `Blue mana` → `Confirm color`; adds to default → `["r","u"]`); `closeBelt`
   - expect: `game-init` = `{ players: 4, initialLife: 30, playerColors: {"0":["r"],"1":["r","u"],"2":["r"],"3":["r"]} }`
   - expect: `game-state` = 4 full `PlayerState` records (playerId, life, color, commanderDamage[], counters[])
3. Tap P1 `-1 life` 2× (28); read both stores
   - expect: `game-state` P1 `life: 28` — live writes go to state only
   - expect: `game-init` UNCHANGED (`players: 4, initialLife: 30`, colors intact) — setup
     writes only on setup actions; proves the two-store split (§4.1 vs §4.2)

## Notes for the test generator

- One file: `tests/e2e/persistence.spec.ts`, one `test.describe` per PERS-xx section, all
  sharing the helpers listed above (import/redefine per existing spec convention — each
  spec file defines its own local helpers).
- Every test starts with `await page.goto("/")` on a fresh context — that IS the clean-IDB
  prerequisite; do not add `storageState` or share contexts.
- After any state mutation, `expect.poll(readIdb(...))` before `goto("/")` to avoid racing
  the async `idbPut`.
- `+1/-1 <name> counter` and `+1 commander damage` locators become ambiguous when multiple
  rows/columns exist — use `.nth()`/`.first()` (PERS-03 step 7, PERS-04).
- Belt must be closed (`closeBelt`) before zone taps/swipes (PERS-06, 07, 09, 10).
