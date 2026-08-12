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

- DB name: `mtg-life-counter`, **version 2** (v2 added `ai-judge-chat`; stores
  `game-init` (key `"init"`), `game-state` (key `"state"`), `ai-judge-chat`
  (key `chat-v<version>`)). **Do NOT pass a version to `indexedDB.open` from tests —
  `open(name, 1)` on the v2 DB fails with `VersionError` (verified live).**

### Reading IDB from tests

Writes are async (`void idbPut`), so after the last UI change, poll the store with
`expect.poll` before reloading (guarantees the write landed before the navigation that
would otherwise race it):

```ts
async function readIdb<T>(page: Page, store: string, key: string): Promise<T | undefined> {
  return page.evaluate(async ({ store, key }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("mtg-life-counter"); // NO version arg — DB is v2; open(name, 1) throws VersionError
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
- **Hydration is async after `goto`/reload — and since the §4.6 splash change, player rows
  render ONLY post-hydration (`isHydrated` gate): SSR = belt + empty zone area, NO rows.**
  Zone locators auto-wait for the post-hydration mount, so `toHaveCount`/`toHaveText` need no
  extra polling; there is no more "SSR-default flash" (rows mount once with final restored
  values — no wrong-value frame). Belt buttons (Restart Life, Players, Initial Life, AI Judge)
  ARE in SSR, so belt actions can still run before hydration lands (pre-existing race,
  unchanged). When the expected value equals a §3 default (e.g. restart-to-40), a UI assertion
  alone can pass without a store rewrite — keep the `expect.poll(readIdb)` pair (PERS-06 step 5).
- **Zone color = inline `background` style** on the `<section role="region">`; solid color
  assertion via `toHaveCSS("background-color", ...)`: red `rgb(228, 153, 119)`, white
  `rgb(248, 246, 216)`, blue `rgb(193, 215, 233)`, black `rgb(102, 101, 101)`, green
  `rgb(163, 192, 149)`, colorless `rgb(202, 197, 192)`.
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

**Note — splash regression coverage (TC-SPLASH-3):** this reload-restore IS the seeded
fast-hydration regression test for §4.6. Since the gate, rows mount only post-hydration —
the `toHaveText` asserts above auto-wait for that mount (no extra poll needed; rows appear
slightly later than pre-gate SSR). Optionally add one negative splash assert after step 3:
`getByTestId("extended-splash")` has no `[open]` attribute (fast hydration → splash never
opens).

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
   - expect: picker closes; P1 zone bg `rgb(193, 215, 233)` (WYSIWYG, §8.5.1)
3. Read `game-init`
   - expect: `playerColors = { "0": ["b"], "1": ["r"] }`
4. Navigate to `/` (reload)
   - expect: P1 still blue, P2 still red (restored from `game-init`)
5. Read `game-init` again
   - expect: unchanged `{"0":["b"],"1":["r"]}` — color is a setup value, written to init only

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
1. Navigate to `/`; set P1 color White (picker → `White mana` → `Confirm color`)
   - expect: P1 white `rgb(248, 246, 216)`
2. Tap P1 `-1 life` 2× (38) — dirtied life, to prove reset
3. `openBelt` → `Players` → `4 players`
   - expect: modal closes; 4 regions
   - expect: P1 still white, P1/P2 life 40 (existing players reset via §8.1 with new count)
   - expect: P3/P4 red default, life 40 (appended — §8.4.1)
4. `closeBelt`; read both stores
   - expect: `game-init` → `players: 4`, `playerColors` = `{"0":["w"],"1":["r"],"2":["r"],"3":["r"]}`
   - expect: `game-state` → 4 `playerStates`, each `commanderDamage` length 4 (array length =
     player count invariant, SPEC §5)
5. Navigate to `/` (reload)
   - expect: 4 regions restored; P1 white; all lives 40

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
   (picker `color-picker-1` → `Blue mana` → `Confirm color`); `closeBelt`
   - expect: `game-init` = `{ players: 4, initialLife: 30, playerColors: {"0":["r"],"1":["b"],"2":["r"],"3":["r"]} }`
   - expect: `game-state` = 4 full `PlayerState` records (playerId, life, color, commanderDamage[], counters[])
3. Tap P1 `-1 life` 2× (28); read both stores
   - expect: `game-state` P1 `life: 28` — live writes go to state only
   - expect: `game-init` UNCHANGED (`players: 4, initialLife: 30`, colors intact) — setup
     writes only on setup actions; proves the two-store split (§4.1 vs §4.2)

## Extended Splash (SPEC §4.6 / DESIGN §4.4) — shared setup

**Timing model:** GameInner sets a 120ms timer on mount while `isHydrated=false`
(`SPLASH_DELAY_MS`) → `showModal()` on `#extended-splash`. `HYDRATE` flips `isHydrated` →
close effect calls `dialog.close()`; rows mount in the same render. Fast hydration
(<120ms) → timer cleared before firing → dialog never opens. Blocked/private IDB →
hydrator `catch` resolves fast → never opens (§4.6).

**Selectors:**

| Thing | Selector |
| --- | --- |
| Splash dialog | `getByTestId("extended-splash")` (also `#extended-splash`) |
| Splash open state | `[open]` attribute — `toHaveAttribute("open", "")` / `not.toHaveAttribute("open", "")`; closed dialog is also not visible |
| Splash semantics | `aria-label="Loading game"`, `aria-modal="true"`, bg `rgb(41, 42, 42)` (#292A2A) |

**Slow-hydration injection (verified live — do NOT simplify):** `page.addInitScript` before
`reload()` (init scripts re-apply on reload). Delay the FIRST `indexedDB.open` call only, by
~500ms, deferring the REAL open via `setTimeout` and returning a proxy request. The proxy
MUST expose accessor properties for `result`/`error` and forward all four handlers
(`onsuccess`/`onerror`/`onupgradeneeded`/`onblocked`) to the real request once created:
`idb.ts` reads `request.result` from a closure, so a bare proxy object resolves
`undefined` → `Promise.all` rejects → silent §3-defaults fallback (verified live — hydration
looks "successful" but restores nothing). Delaying the CALL (not the success event) keeps the
v2 upgrade/onsuccess dance intact.

```ts
await page.addInitScript(() => {
  const origOpen = window.indexedDB.open.bind(window.indexedDB);
  let delayed = false;
  window.indexedDB.open = function (name: string, version?: number) {
    if (delayed) return origOpen(name, version);
    delayed = true;
    let real: IDBOpenDBRequest | null = null;
    const handlers: Record<string, ((this: IDBRequest) => void) | null> = {};
    const proxy = {} as IDBOpenDBRequest;
    (["onsuccess", "onerror", "onupgradeneeded", "onblocked"] as const).forEach((k) => {
      Object.defineProperty(proxy, k, {
        set(fn) { handlers[k] = fn; },
        get() { return handlers[k]; },
        configurable: true,
      });
    });
    Object.defineProperty(proxy, "result", { get() { return real ? real.result : undefined; }, configurable: true });
    Object.defineProperty(proxy, "error", { get() { return real ? real.error : null; }, configurable: true });
    setTimeout(() => {
      real = origOpen(name, version);
      (["onsuccess", "onerror", "onupgradeneeded", "onblocked"] as const).forEach((k) => {
        if (handlers[k]) real[k] = handlers[k].bind(real);
      });
    }, 500);
    return proxy;
  };
});
```

**Timing discipline:** open window ≈ 120ms–~600ms (timer vs delayed hydration). All
assertions MUST auto-retry (`expect`/`expect.poll`, default 5s timeout) — never hard-wait.

## Test Scenarios (splash)

### 13. TC-SPLASH-1 — Slow hydration: splash covers, cannot be dismissed early, closes on hydration

**Contracts:** SPEC §4.6, DESIGN §4.4.
**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Seed (PERS-09 pattern — 4 players, distinctive lives):**
1. `goto("/")`; `openBelt` → `Players` → `4 players`; `closeBelt`
2. Tap `-1 life` per zone (helper loop, belt verified closed first): P1 ×33, P2 ×27, P3 ×18, P4 ×10
   - expect: lives 7 / 13 / 22 / 30
3. `expect.poll(readIdb(page, "game-state", "state"))` → lives `[7, 13, 22, 30]` (write landed before reload)

**Slow hydration + assertions:**
4. `page.addInitScript(delayWrapper)` (pattern above, 500ms), then `page.reload()`
5. While hydration is pending (poll, ~120ms window opens):
   - expect: `getByTestId("extended-splash")` has `[open]` attribute
   - expect: player regions count 0 (rows gated until hydration — `getByRole("region", { name: /^Player \d:/ })` count 0)
6. Press `Escape` (`page.keyboard.press("Escape")`)
   - expect: splash STILL has `[open]` (onCancel guard — DESIGN §4.4: no dismiss path)
7. Click "outside"/backdrop: `page.mouse.click(5, 5)` (corner), then `page.mouse.click(640, 360)` (viewport center; dialog is fullscreen `h-dvh w-dvw` so both land on dialog surface — no onClick handler)
   - expect: splash STILL has `[open]` after each click
8. Poll hydration completion (auto-retry ≤5s; resolves ~500ms after reload):
   - expect: splash `[open]` gone / not visible
9. Rows mount once with final values (no wrong-value frame, no §3-default flash):
   - expect: exactly 4 regions; lives 7 / 13 / 22 / 30
10. Store proof: `game-state` lives still `[7, 13, 22, 30]` (restore did not overwrite the source)

**Failure conditions:** splash never opens during the slow window; Escape or any click closes
it early; rows render pre-hydration or with §3 defaults; wrong restored values; splash stays
open after hydration.

### 14. TC-SPLASH-2 — Fast hydration: splash never opens; §3 defaults render

**Contracts:** SPEC §4.6 ("fast hydration → never opens"), §3 defaults.
**Prerequisites:** fresh context (empty IDB — default isolation; no init script, no seed).
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. `goto("/")`
2. Negative assert must poll PAST the 120ms threshold — an instant check can pass before the
   timer would have fired:
   - `page.waitForTimeout(350)` then expect: `getByTestId("extended-splash")` not visible /
     no `[open]` attribute
   - (alternative: `expect.poll(() => splash.evaluate((d) => d.open), { timeout: 1200 }).toBe(false)`
     — but a bare `.toBe(false)` passes on the first poll; the waitForTimeout form is preferred)
3. Rows mount with §3 defaults (rows visible ⟹ hydration completed ⟹ timer was cleared):
   - expect: exactly 2 regions; P1 life 40; P2 life 40
4. Optional store proof: `game-init` / `game-state` self-seeded defaults (as PERS-01)

**Note:** same never-opens behavior holds on a SEEDED context — TC-SPLASH-3 covers that variant.

### 15. TC-SPLASH-3 — Seeded game + fast hydration: restore regression guard

**Coverage:** PERS-02 (reload-restore) is the existing regression TC — see the note added
there; it runs this exact scenario against a 2p seed. This TC is the standalone 4p variant.

**Prerequisites:** clean IDB.
**File:** `tests/e2e/persistence.spec.ts`

**Steps:**
1. Seed as TC-SPLASH-1 steps 1–3 (4 players, lives 7 / 13 / 22 / 30)
2. `goto("/")` (reload, NO delay script — fast hydration)
3. Negative splash assert past the threshold (TC-SPLASH-2 step 2 pattern):
   - expect: splash never has `[open]`
4. Rows mount post-hydration (gate — `toHaveCount` auto-waits for the gated mount, no hard wait):
   - expect: 4 regions; lives 7 / 13 / 22 / 30

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
- **Splash TCs (13–15):** same file, same local helpers. The delay wrapper (shared setup) is
  contract-critical — a naive `setTimeout(() => origOpen(...))` returning the raw request
  silently breaks hydration (verified live); ship the proxy pattern verbatim. Zone taps for
  seeding: prefer the helper loop with actionability; direct element clicks
  (`btn.click()` via `locator.evaluate`) are fast but bypass actionability and are only safe
  with the belt verified closed. All splash assertions auto-retry — no hard waits.
- **`readIdb`:** opens WITHOUT a version arg — the DB is v2; `open(name, 1)` throws
  `VersionError` (verified live).

## Splash audit — impact on existing plans (not rewritten)

- **specs/ai-judge.spec.md:** no TC clicks player zones post-load, so the rows gate has no
  selector impact. TC-AJ-22/23 (reload → belt → AI Judge / Restart Life) touch only SSR-rendered
  belt buttons — clickable before hydration (pre-existing race, unchanged). Risk: on a machine
  slow enough that hydration exceeds 120ms the splash (top layer) covers the belt and
  intercepts `getByLabel("Open Spellbook Menu")` clicks; on CI/dev machines hydration is fast —
  splash never opens, no change needed. If flakiness ever appears, wait for splash absence or
  player rows before belt clicks. TC-AJ-24 (blocked IDB) is explicitly compatible: hydrator
  catch → fast fallback → splash never opens (§4.6).
- **Belt specs (app-smoke.spec.ts, commander-damage-multiplayer.spec.ts, spellbook-belt.spec.ts
  and siblings):** same belt-timing note as above; zone-count assertions after `goto` now
  auto-wait for the post-hydration mount (they already retry). No hard timing assumptions found.
  Only splash risk is a >120ms hydration hold on a throttled/slow CI worker.
- **In this plan:** PERS-01–12 zone selectors auto-wait for the gated mount; PERS-01's
  "exactly 2 regions" right after `goto` retries until hydration — no change needed. PERS-06
  store-level proof rationale is now stronger (a visible 40 can only be post-hydration), keep
  it as-is.
