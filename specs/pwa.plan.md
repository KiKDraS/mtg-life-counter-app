# PWA Test Plan — MTG Life Counter (feature/pwa-offline)

## Application Overview

MTG Life Counter PWA (Next.js 16 App Router, React 19, Tailwind 4, @playwright/test). Life tracking for 2–6 players, per-player mana colors, commander damage, counters, swipe gestures. Branch `feature/pwa-offline` under review adds: `public/sw.js` rewrite (cache `mtg-life-v2`, precache `/`, `/manifest.json`, both manifest icons; runtime cache-first for same-origin GET; `/api/*` network-only; navigation network-first → offline fallback to cached `/`), `app/SWRegister.tsx` (registers `/sw.js`, fails silently), `app/manifest.json` (`id` `/`, icons `any maskable`). Contracts: DESIGN.md §4–9, SPEC.md §3–8, SPEC 9.11 (`/api/*` never cached — AI Judge is the only offline-degrading feature). App at http://localhost:3000.

**Selectors verified live against the app (prod build):**

| Element | Selector |
|---|---|
| Player zone (n = 1..2) | `page.getByRole("region", { name: new RegExp(\`^Player ${n}:\`) })` |
| Life total | zone `.locator('[aria-live="polite"]')` |
| Life +1 / −1 | zone `.getByRole("button", { name: "+1 life" })` / `"-1 life"` |
| Spellbook toggle | `page.getByRole("checkbox", { name: "Toggle Spellbook Menu" })` |
| Manifest link | `head link[rel="manifest"]` → `/manifest.json` |
| Apple touch icon | `head link[rel="apple-touch-icon"]` → href matches `/apple-icon\.png/` (href is hashed: `/apple-icon.png?apple-icon.<hash>.png`) |
| Meta | `meta[name="theme-color"]` → `#292A2A`; `meta[name="apple-mobile-web-app-title"]` → `Life Counter`; `html[lang]` → `en`; `document.title` → `MTG Life Counter` |

**Verified live facts (prod build, fresh context):** manifest JSON fields exactly as SPEC; `/web-app-manifest-192x192.png` (200, image/png, 42 186 B), `/web-app-manifest-512x512.png` (200, image/png, 245 339 B), `/apple-icon.png` (200, image/png); SW registers at `/sw.js`, scope `/`, controller active, only cache `mtg-life-v2`; no `/api/` request ever present in any cache; offline reload serves the app shell (2 zones, `40` life) and offline `+1 life` click changes 40 → 41; offline navigation to a nonexistent route serves the app shell from the cached `/`.

**Environment requirements (mandatory):**

- **Offline TCs (SM-PWA-05/06/09) REQUIRE the production build** — `pnpm build && pnpm start`. Against `pnpm dev` the offline reload serves the dev HTML shell, but the HMR client cannot reconnect (WebSocket `ERR_INTERNET_DISCONNECTED` spam) and player zones never hydrate (empty body). Non-offline TCs run fine on either.
- Server must be running on http://localhost:3000 before the run. If not: `pnpm build && pnpm start` (preferred for this suite).
- **Fresh context per test.** SW registration + caches persist per context; every test must load `/` online first (SW installs → precaches → activates via `skipWaiting` → claims), wait for readiness, and only then act. Playwright's default per-test context already provides this — do not reuse storage state between tests.
- A SW/cache installed from a different server mode (e.g. dev) pollutes the context: stale cached `/` HTML references dev chunks and breaks prod offline reload. Fresh context always avoids this.
- Offline toggling: `await page.context().setOffline(true)` / `setOffline(false)`. Reloads offline: `page.reload({ waitUntil: "domcontentloaded" })` — the SW navigation handler serves the cached shell.
- Config: `playwright.config.ts` (chromium, baseURL `http://localhost:3000`, viewport 1280x720, 1 worker). Seed: `tests/seed.spec.ts` (goto `/`). Conventions per existing specs: one `describe` per spec file, numbered TC comments matching this plan.
- Dev-mode caveat for the SW-readiness helper: in dev the page reloads once ~100 ms after load (HMR double connect) — wait for SW-ready *after* that settle, or just require prod for this suite.

**Shared helper (implement once in the spec file):**

```ts
// Install + activate SW, precache "/", wait app interactive.
async function setupOnline(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    if (!keys.includes("mtg-life-v2")) return false;
    const c = await caches.open("mtg-life-v2");
    return !!(await c.match("/")); // precache finished
  }, { timeout: 15_000 });
  await page.getByRole("region", { name: /^Player \d:/ }).first().waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "+1 life" }).first().waitFor();
  if (!(await page.evaluate(() => navigator.serviceWorker.controller))) await page.reload();
}
```

## Test Scenarios

All TCs in one spec file: `tests/e2e/pwa.spec.ts` (single describe `"PWA — manifest, SW, offline"`). Each test starts with a fresh context (default) and runs `setupOnline` when SW state is needed.

### 1. SM-PWA-01: Manifest served — valid JSON, all fields, correct icons

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. `page.goto("/")`, then `const resp = await page.request.get("/manifest.json")`
    - expect: `resp.status()` 200
    - expect: content-type is `application/json`
    - expect: `resp.json()` parses without error
  2. assert parsed manifest fields
    - expect: `name` == `"MTG Life Counter"`, `short_name` == `"Life Counter"`
    - expect: `id` == `"/"`, `start_url` == `"/"`, `scope` == `"/"`
    - expect: `display` == `"standalone"`, `orientation` == `"portrait"`
    - expect: `theme_color` == `"#292A2A"`, `background_color` == `"#292A2A"`
  3. assert icons array
    - expect: exactly 2 icons
    - expect: one icon with `sizes` `"192x192"`, one with `"512x512"`; both `type` `"image/png"`; `purpose` is `"any maskable"` (both tokens present, e.g. split on whitespace contains `any` and `maskable`); `src` `/web-app-manifest-192x192.png` and `/web-app-manifest-512x512.png`

### 2. SM-PWA-02: Manifest linked from the page

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. `page.goto("/")`
  2. read `head link[rel="manifest"]`
    - expect: link present, exactly 1, `href` == `"/manifest.json"` (or ends with `/manifest.json`)

### 3. SM-PWA-03: Icons fetch — manifest icons + apple-touch-icon

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. `page.goto("/")`
  2. `page.request.get("/web-app-manifest-192x192.png")` and `("/web-app-manifest-512x512.png")`
    - expect: both 200, content-type `image/png`, body length > 0
  3. read `link[rel="apple-touch-icon"]` href from head
    - expect: href matches `/apple-icon\.png/` (value is hashed, e.g. `/apple-icon.png?apple-icon.11db6v1od650r.png`)
  4. `page.request.get(<that exact href>)`
    - expect: 200, content-type `image/png`, body length > 0

### 4. SM-PWA-04: SW registers — ready, controller, scope

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. `page.goto("/")`
  2. `const reg = await page.evaluate(() => navigator.serviceWorker.ready)`
    - expect: `reg.active` non-null
    - expect: `reg.active.scriptURL` ends with `/sw.js`
    - expect: `reg.scope` == `http://localhost:3000/` (origin + `/`)
  3. controller check
    - expect: `navigator.serviceWorker.controller` truthy (skipWaiting + clients.claim). If null on first read, `page.reload()` once and re-check before failing.
  4. `page.request.get("/sw.js")`
    - expect: 200, content-type contains `javascript` (belt-and-braces: script actually servable)

### 5. SM-PWA-05: Offline reload — app shell renders (CORE)

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. fresh context; `setupOnline(page)` (load online, SW installs + precaches `/`, app interactive: 2 player regions, life buttons visible)
  2. `await page.context().setOffline(true)`
  3. `await page.reload({ waitUntil: "domcontentloaded" })`, then wait for zones
    - expect: no browser error page (assert body does NOT contain `This site can't be reached` / `ERR_INTERNET_DISCONNECTED` / `No internet`)
    - expect: `document.title` == `"MTG Life Counter"`
    - expect: exactly 2 `region` matching `^Player \d:` visible
    - expect: both life totals read `40`; `+1 life` / `-1 life` / `Change color` buttons present per zone
  4. `await page.context().setOffline(false)` (cleanup)

### 6. SM-PWA-06: Offline interaction — life changes work offline

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. fresh context; `setupOnline(page)`
  2. `setOffline(true)`; `page.reload({ waitUntil: "domcontentloaded" })`; wait for P1 zone (per SM-PWA-05)
  3. read P1 life total (`40`), click P1 `+1 life`
    - expect: P1 life total reads `41` (chunks + state work offline, not just the shell)
  4. click P1 `-1 life` twice
    - expect: P1 reads `39` (offline decrement also works)
    - expect: P2 stays `40`
  5. `setOffline(false)`

### 7. SM-PWA-07: /api/* never cached (SPEC 9.11)

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. fresh context; `setupOnline(page)`
  2. `const hits = await page.evaluate(async () => { const bad: string[] = []; for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) { if (new URL(r.url).pathname.startsWith("/api/")) bad.push(r.url); } } return bad; })`
    - expect: `hits` is empty (no cache entry whose pathname starts with `/api/`; AI Judge route is network-only)
  3. optional hardening: `page.request.get("/api/judge")` while offline → expect the request to fail (network error), NOT a cached response. (Run only if the server can serve `/api/judge` without key material; otherwise skip — cache-empty assertion is the contract.)

### 8. SM-PWA-08: Cache is versioned — `mtg-life-v2`, no stale `v1`

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. fresh context; `setupOnline(page)`
  2. `const keys = await page.evaluate(() => caches.keys())`
    - expect: `keys` contains `"mtg-life-v2"` (matches `CACHE` const in `public/sw.js`)
    - expect: `keys` does NOT contain `"mtg-life-v1"` (activate purges all caches except the current version — old names deleted)
  3. read `/sw.js` source text (`page.request.get`), regex `CACHE\s*=\s*"([^"]+)"`
    - expect: extracted name == the cache key found in step 2 (test stays valid across future cache bumps)

### 9. SM-PWA-09: Offline navigation fallback — unknown route serves app shell

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. fresh context; `setupOnline(page)`
  2. `setOffline(true)`; `await page.goto("/some-nonexistent-route", { waitUntil: "domcontentloaded" })`
    - expect: no browser error page (body does not contain `This site can't be reached` / `ERR_INTERNET_DISCONNECTED`)
    - expect: app shell renders — exactly 2 player regions, life totals `40`, `+1 life` button present (navigation network-first → `caches.match("/")` fallback, SPEC SW handler)
    - expect: `page.url()` still the requested path (`/some-nonexistent-route` — fallback is a response, not a redirect)
  3. `setOffline(false)`

### 10. SM-PWA-10: PWA metadata present

**File:** `tests/e2e/pwa.spec.ts`

**Steps:**
  1. `page.goto("/")`
  2. head assertions
    - expect: `meta[name="theme-color"]` content == `"#292A2A"`
    - expect: `meta[name="apple-mobile-web-app-title"]` content == `"Life Counter"`
    - expect: `html[lang]` == `"en"`
    - expect: `document.title` == `"MTG Life Counter"`
    - expect: `link[rel="apple-touch-icon"]` present (iOS home-screen icon, see SM-PWA-03)

## Success Criteria

- All 10 TCs pass on a fresh context against `pnpm build && pnpm start` at http://localhost:3000.
- SM-PWA-05/06/09 prove: shell + chunks + state fully functional offline; navigation fallback serves the app on unknown routes.
- SM-PWA-07/08 prove the cache discipline: `/api/*` never cached, cache versioned and stale versions purged.
- Zero test-order coupling: each TC runs standalone (fresh context, own SW install).

## Failure Conditions

- SM-PWA-05/06/09 fail with empty body / missing zones → suspect dev server (`pnpm dev`) instead of prod build, or polluted context (SW installed from dev). Restart clean: `pnpm build && pnpm start`, fresh context.
- SM-PWA-08 finds `mtg-life-v1` alongside `v2` → activate purge broken (SW updated without skipWaiting claim, or old SW not unregistered).
- SM-PWA-07 finds an `/api/` entry → runtime cache-first path caching API responses — contract violation (SPEC 9.11).
