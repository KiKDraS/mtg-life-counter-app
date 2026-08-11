# AI Judge Test Plan

## Application Overview

# AI Judge — E2E Test Plan (specs/ai-judge.spec.md)

Feature: `feature/ai-judge`. App: MTG Life Counter PWA, Next.js 16 App Router. Target file: `tests/e2e/ai-judge.spec.ts` (single spec, 22 tests — TC-AJ-22 is `test.fixme` blocked, see §1.15; describe blocks per area). Config: baseURL `http://localhost:3000`, chromium, 1 worker, viewport 1280x720. Seed: `tests/seed.spec.ts` (goto `/` only). Assumptions: blank/fresh state each test; dev machine has NO OpenRouter key → route 503s — **every test MUST mock `**/api/judge`**, never hit real route.

## Contract sources
DESIGN.md §6.4 (chat window), §6.4.0 (offline), §6.4.1 (chips). SPEC.md §9.5 (SSE), §9.8 (gameContext), §9.9 (session), §9.10 (UI/offline).

## Open modal (reused prelude)
1. `page.goto("/")`.
2. Click `getByLabel("Open Spellbook Menu")`; expect `#spellbook-toggle` checked.
3. Click `getByRole("button", { name: "AI Judge" })`; expect `#ai-judge-modal` visible.
(Modal opened via `dialog.show()`; `open` attr present; Escape handled by DialogShell keydown.)

## Selectors (current DOM — no testids yet)
- DIALOG `#ai-judge-modal` (aria-modal="true", aria-labelledby="ai-judge-title")
- CLOSE `getByRole("button", { name: "Close AI Judge" })`
- INPUT `getByRole("textbox", { name: "Ask about a card or rule" })` — placeholder exact `Ask about a card or rule…` (U+2026). autoFocus on open.
- CHIP_GROUP `getByRole("group", { name: "Suggestions" })`
- CHIPS (button aria-label = FULL prompt, not short text): `getByRole("button", { name: "Judge this play: <current game state>" })`, `{ name: "Is <card> legal in Commander?" }`, `{ name: "Explain combat damage here." }`. Visible text: "Judge this play" / "Card legality" / "Combat math".
- STATUS `page.locator("#ai-judge-modal [role='status']")` — offline alert
- TYPING `page.getByLabel("AI Judge is typing")` — 3-dot span
- SCROLL `page.locator("#ai-judge-modal div[class*='overflow-y-auto']")` — chat list
- SYSTEM bubble `#ai-judge-modal .bg-mana-b` (left, self-start). USER bubble `#ai-judge-modal .bg-mana-c` (right, self-end). Error bubble = `.bg-mana-b` with error message text.
- TITLE `#ai-judge-title` (sr-only h2, text "AI Judge")

## Color assertions (computed style)
- system bubble: background-color `rgb(102, 101, 101)` (#666565), color `rgb(250, 248, 245)` (#FAF8F5)
- user bubble: background-color `rgb(202, 197, 192)` (#CAC5C0), color `rgb(26, 26, 26)` (#1A1A1A)
- alignment: user bubble boundingBox.x > system bubble boundingBox.x (left vs right)
- disabled chip: `disabled` attr + `toHaveCSS("opacity", "0.25")`; enabled chip: opacity `1`. Disabled input: `disabled` attr.
- offline alert: bg `rgb(102, 101, 101)`, text exact `You're offline — AI Judge needs internet.` (apostrophe = U+2019)

## Mock fixtures (exact payloads)
Client parses SSE blocks split on `\n\n`, accepts `data: ` prefixed lines. Body = `data: <json>\n\n` per event, LF line endings.

- **FULL** (single fulfill, all events at once): status 200, `Content-Type: text/event-stream`, body:
  `data: {"type":"token","content":"When"}\n\ndata: {"type":"token","content":" you"}\n\ndata: {"type":"token","content":" gain life"}\n\ndata: {"type":"done","citations":[],"usage":{"inputTokens":1200,"outputTokens":300,"cost":0.0015},"model":"anthropic/claude-sonnet-4","sourcesUsed":["mtg.wtf"]}\n\n`
  Expected rendered answer text: "When you gain life".
- **ERR_429** (200): `data: {"type":"error","code":"rate_limited","message":"The AI Judge is busy. Please wait a moment."}\n\n`
- **ERR_503** (status 503, `Content-Type: text/event-stream`): `data: {"type":"error","code":"misconfigured","message":"The AI Judge is not configured. Please try again later."}\n\n` — client reads error body on non-ok status (SPEC §9.5).
- **STREAM_TWO_STAGE** (incremental, Playwright ≥1.38 supports `route.fulfill({ response: new Response(stream, {status:200, headers}) })` with a web `ReadableStream`; Node ≥18): t=0 hold 300ms with NO data (typing indicator window); then chunk `data: {"type":"token","content":"The "}\n\n`; then every 100ms: `data: {"type":"token","content":"answer "}\n\n`, `{"type":"token","content":"is "}`, `{"type":"token","content":"forty."}`; then `data: {"type":"done","citations":[],"usage":{"inputTokens":10,"outputTokens":20,"cost":0.0001},"model":"test/model","sourcesUsed":["mtg.wtf"]}\n\n` and close. Rendered: "The answer is forty."
- **STREAM_NEVER_ENDS**: enqueue 1 token `data: {"type":"token","content":"partial "}\n\n` at t=0, hold stream open, never done.
- **STREAM_MANY**: 300 chunks `data: {"type":"token","content":"tokenN "}\n\n` every 5ms, then done (like FULL's done), close.
- **STREAM_LONG**: 600 chunks `data: {"type":"token","content":"answer "}\n\n` every 5ms, then done, close. (~3600 chars → overflow.)

Route handler (all tests): `page.route("**/api/judge", handler)` where handler pushes `request.postDataJSON()` to a closure array `bodies` then fulfills per fixture. Assert on `bodies[0]` (chip JudgePlay is async — `page.waitForRequest` or poll array). POST body shape (SPEC §9.5): `{sessionId, question, gameContext?}`; sessionId = `aijudge-<version>` — deterministic per game version (SPEC §9.9), e.g. `aijudge-0`; NOT a UUID.

## Chat persistence (SPEC §9.9 — landed behavior, supersedes old "fresh per open")
- Chat persisted per game version in IndexedDB store `ai-judge-chat`, key `chat-v<version>`.
- Survives modal close AND page reload. Close no longer clears history.
- Restart (⟳ Restart Life) / setup changes bump `version` → fresh chat under `chat-v<version+1>`, sessionId `aijudge-<version+1>`.
- IndexedDB blocked/private mode → memory-only fallback, app stays usable (no crash).
- Mock via `page.addInitScript` re-applies automatically on `page.reload()` — mock stays active after reload.

## Data-testid recommendations (future hardening, NOT in current DOM — use class/aria fallbacks above)
`chat-scroll`, `bubble-user`, `bubble-system`, `bubble-stream`, `bubble-error`, `judge-input`, `chip-judge-play`, `chip-card-legality`, `chip-combat-math`, `offline-alert`. Generator: do NOT modify app code; tests run against current selectors.

## Failure collection
Streaming/abort tests: attach `page.on("pageerror")` + `page.on("console")` error collector at test start; assert empty at end.

## Test Scenarios

### 1. AI Judge

**Seed:** `tests/seed.spec.ts`

#### 1.1. TC-AJ-01: Modal opens from belt with input + 3 chips

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Run open-modal prelude (goto /, open belt, click "AI Judge")
    - expect: #ai-judge-modal is visible (has open attribute)
    - expect: dialog has aria-modal="true"
  2. Check chat input
    - expect: textbox "Ask about a card or rule" visible
    - expect: placeholder attribute exactly "Ask about a card or rule…"
    - expect: input is focused (autoFocus per DESIGN §6.4)
  3. Check suggestion chips
    - expect: group with aria-label "Suggestions" visible
    - expect: 3 chip buttons visible with aria-labels "Judge this play: <current game state>", "Is <card> legal in Commander?", "Explain combat damage here."
    - expect: each chip enabled, computed opacity "1"

#### 1.2. TC-AJ-02: Type + Enter sends correct POST; bubbles render; typing indicator

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge: handler records postDataJSON into bodies[], then awaits 400ms sleep, then fulfills FULL fixture (single body, all tokens + done). Open modal (prelude)
  2. Type "When can I cast instants?" into INPUT, press Enter
    - expect: input value becomes "" (cleared after send, §6.4.1)
    - expect: typing indicator "AI Judge is typing" visible while response pending (during 400ms delay)
  3. Wait for response to complete
    - expect: exactly 1 request captured; postDataJSON.question === "When can I cast instants?"
    - expect: postDataJSON.sessionId === "aijudge-0" (version-derived, SPEC §9.9; NOT a UUID)
    - expect: postDataJSON.gameContext is undefined (manual question, SPEC §9.8)
    - expect: user bubble (.bg-mana-c) with text "When can I cast instants?" visible
    - expect: user bubble computed bg rgb(202,197,192), color rgb(26,26,26)
    - expect: system bubble (.bg-mana-b) with text "When you gain life" visible
    - expect: system bubble computed bg rgb(102,101,101), color rgb(250,248,245)
    - expect: user bubble boundingBox.x > system bubble boundingBox.x (right vs left)
    - expect: typing indicator gone
    - expect: 3 chips still visible and enabled (persist after send)
    - expect: exactly 1 system bubble with answer text (tokens merged)

#### 1.3. TC-AJ-03: Streaming — tokens accumulate into one system bubble; done finalizes

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge → STREAM_TWO_STAGE fixture (300ms hold, then 4 tokens 100ms apart, then done). Open modal (prelude)
  2. Type "Combat math question" and press Enter
    - expect: typing indicator "AI Judge is typing" visible during initial hold (before first token)
  3. Wait for first token chunk
    - expect: typing indicator gone once streamText non-empty
    - expect: a streaming system bubble (.bg-mana-b) with text "The " visible
  4. Poll bubble text while remaining tokens stream in
    - expect: text grows through "The answer is " to "The answer is forty." (same single bubble, tokens appended — never multiple answer bubbles)
  5. Wait for done + stream end
    - expect: exactly 1 system bubble .bg-mana-b with full text "The answer is forty."
    - expect: no leftover streaming bubble (total .bg-mana-b bubbles with answer content == 1)
    - expect: input re-enabled (not disabled)
    - expect: no console errors

#### 1.4. TC-AJ-04: Error SSE event → error bubble + input re-enabled

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge → ERR_429 fixture (200 with error event body). Open modal (prelude)
  2. Type "Is this play legal?" and press Enter
    - expect: user bubble "Is this play legal?" visible
  3. Wait for error handling
    - expect: error bubble .bg-mana-b with exact text "The AI Judge is busy. Please wait a moment." visible
    - expect: error bubble bg rgb(102,101,101), color rgb(250,248,245)
    - expect: typing indicator gone
    - expect: input enabled (not disabled) — SPEC §9.10 error → re-enable
    - expect: chips visible, enabled, opacity "1" (rate_limited does NOT hide chips)
    - expect: no system answer bubble (tokens none)

#### 1.5. TC-AJ-05: 503 misconfigured (no OpenRouter key) → error bubble + chips hidden

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge → ERR_503 fixture (status 503, SSE body with misconfigured error). Open modal (prelude)
  2. Type "Test question" and press Enter
    - expect: request captured with status 503 response
  3. Wait for error handling
    - expect: error bubble with exact text "AI Judge unavailable" visible (SPEC §9.10)
    - expect: chips group NOT visible (SPEC §9.10: misconfigured → chips hidden, chipsHidden)
    - expect: input enabled (not disabled)
    - expect: typing indicator gone
    - expect: no console errors

#### 1.6. TC-AJ-06: Input + chips disabled during streaming

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge → STREAM_NEVER_ENDS (1 token, stream held open). Open modal (prelude)
  2. Type "Long question" and press Enter
    - expect: user bubble visible, stream bubble with "partial " visible
  3. Assert disabled states while streaming
    - expect: input has disabled attribute
    - expect: all 3 chips have disabled attribute
    - expect: each chip computed opacity "0.25" (DESIGN §6.4.1 streaming state)
    - expect: chip group still visible
    - expect: typing another question into input is impossible (disabled)
  4. Cleanup: close modal via CLOSE button
    - expect: dialog not visible
    - expect: no console/page errors

#### 1.7. TC-AJ-07: Chips — Card legality sends exact prompt; Judge this play sends gameContext

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge → FULL fixture, handler records bodies[]. Seed board state: open belt → click "Players" → click "2 players" → wait modal closes; change player 1 life (+1) to force persistence write to IndexedDB; wait ~300ms
  2. Open judge modal (belt → "AI Judge")
    - expect: modal visible
  3. Click chip "Card legality" (aria-label "Is <card> legal in Commander?")
    - expect: request captured; postDataJSON.question === "Is <card> legal in Commander?" (exact, literal placeholder)
    - expect: postDataJSON.gameContext undefined (CardLegality sends prompt only)
    - expect: user bubble with that exact question text
  4. Wait for FULL response done
    - expect: system bubble "When you gain life" visible
  5. Click chip "Judge this play" (aria-label "Judge this play: <current game state>")
    - expect: second request captured; postDataJSON.question starts with "Judge this play: "
    - expect: postDataJSON.gameContext present; format === "commander"
    - expect: gameContext.players length === 2; each player has number life, color array, counters array, commanderDamage array (SPEC §9.8 shape)
    - expect: user bubble with the judge-play prompt visible

#### 1.8. TC-AJ-08: Offline — exact alert copy, input+chips disabled; online re-enables without reload

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Open modal (prelude). Attach page.on("load") counter. Route **/api/judge → FULL (for later send).
    - expect: load counter === 0
  2. context.setOffline(true) via page.context()
    - expect: status element (#ai-judge-modal [role='status']) visible with exact text "You're offline — AI Judge needs internet."
    - expect: status bg rgb(102,101,101), color rgb(250,248,245)
    - expect: input has disabled attribute
    - expect: all 3 chips disabled + opacity "0.25"
    - expect: no new page loads (load counter still 0)
  3. context.setOffline(false)
    - expect: status element not visible (count 0)
    - expect: input enabled
    - expect: chips enabled, opacity "1"
    - expect: no reload happened: URL unchanged, load counter === 0 (SPEC §9.10: state clears, no reload)
  4. Post-online send: type "Back online" + Enter (FULL mock active)
    - expect: request captured, user bubble "Back online" visible, system bubble "When you gain life" visible

#### 1.9. TC-AJ-09: Offline with history — bubbles stay visible + scrollable, read-only

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge → STREAM_LONG (600 answer chunks then done). Open modal (prelude)
  2. Type "Long rules question" + Enter; wait for done
    - expect: 1 user bubble + 1 system bubble (answer ~3600 chars) visible
  3. context.setOffline(true)
    - expect: offline status alert visible (exact copy)
    - expect: input disabled, chips disabled + opacity 0.25
    - expect: user + system bubbles still visible (count 2, history preserved §6.4.0)
  4. Evaluate SCROLL container
    - expect: scrollHeight > clientHeight (content overflows → scrollable)
    - expect: computed overflow-y is scroll or auto
  5. Cleanup: context.setOffline(false), close modal
    - expect: no console/page errors

#### 1.10. TC-AJ-10: Escape closes; re-open = same session (history persisted)

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge → FULL, record bodies[]. Open modal (prelude)
  2. Send "First question" (Enter); wait done; send "Second question"; wait done
    - expect: bodies[0].sessionId === bodies[1].sessionId === "aijudge-0" (same open, one session)
    - expect: 4 bubbles total (2 user + 2 system)
  3. Press Escape
    - expect: #ai-judge-modal not visible (closed)
  4. Re-open via belt → "AI Judge"
    - expect: modal visible
    - expect: history persisted across close (SPEC §9.9) — 2 user + 2 system bubbles restored
    - expect: input empty and enabled
  5. Send "Third question"; wait done
    - expect: bodies[2].sessionId === "aijudge-0" (same version thread, NOT a fresh session)
    - expect: 3 user + 3 system bubbles (history carried over, no reset)

#### 1.11. TC-AJ-11: Auto-scroll — long stream pins to bottom

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge → STREAM_MANY (300 tokens, 5ms apart, then done). Open modal (prelude)
  2. Send "Scroll test" + Enter
    - expect: user bubble visible
  3. While streaming (after ~100 tokens): evaluate SCROLL element
    - expect: scrollTop + clientHeight >= scrollHeight - 2 (pinned to bottom, DESIGN §6.4 auto-scroll)
  4. Wait done; evaluate again
    - expect: still pinned: scrollTop + clientHeight >= scrollHeight - 2
    - expect: single system bubble with full concatenated text (300 tokens)

#### 1.12. TC-AJ-12: Chips a11y — group + full-prompt aria-labels

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Open modal (prelude)
    - expect: group role="group" with aria-label "Suggestions" present in #ai-judge-modal
  2. Inspect each chip button
    - expect: button role with aria-label "Judge this play: <current game state>"
    - expect: button role with aria-label "Is <card> legal in Commander?"
    - expect: button role with aria-label "Explain combat damage here."
    - expect: aria-labels are full prompts, not short text (DESIGN §6.4.1)
  3. Inspect input + close
    - expect: input has aria-label "Ask about a card or rule"
    - expect: close button aria-label "Close AI Judge"

#### 1.13. TC-AJ-13: Close mid-stream → abort, no crash; user bubble persists

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Attach pageerror + console-error collectors. Route **/api/judge → STREAM_NEVER_ENDS. Open modal (prelude)
  2. Send "Abort me" + Enter; wait for stream bubble "partial "
    - expect: user bubble + stream bubble visible, input disabled
  3. Click CLOSE button while stream active
    - expect: #ai-judge-modal not visible
    - expect: no pageerror events, no error-level console messages (abort handled, SPEC §9.9)
  4. Re-open modal
    - expect: modal visible
    - expect: user bubble "Abort me" persisted (SPEC §9.9 — close no longer clears history); 0 system bubbles (partial answer dropped with abort)
    - expect: input enabled
  5. Send "After abort" (STREAM_NEVER_ENDS still active), then close via Escape
    - expect: request captured — sessionId "aijudge-0" (same version thread, unchanged)
    - expect: modal closed, no pageerror/console errors

#### 1.14. TC-AJ-14: A11y smoke — dialog semantics + sr-only title

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Open modal (prelude)
    - expect: #ai-judge-modal has aria-modal="true"
    - expect: #ai-judge-modal has aria-labelledby="ai-judge-title"
    - expect: #ai-judge-title attached with text "AI Judge" (sr-only h2)
    - expect: input is focused on open
  2. Keyboard: press Escape
    - expect: modal closes
    - expect: re-open works: belt → "AI Judge" → modal visible again

#### 1.15. TC-AJ-22: Reload — chat restored from IndexedDB; sessionId stable

**File:** `tests/e2e/ai-judge.spec.ts`

**Status: BLOCKED (2026-08-11) — `test.fixme` in spec. App bug, not test.**
`GameProvider` HYDRATE bumps `version` (reducer HYDRATE → version+1) whenever
`game-init`/`game-state` records exist — and they are written on every first
load — so after reload the app reads `chat-v1` while the chat persisted under
`chat-v0`. SPEC §9.9 (binding) requires chat to survive reload. Verified by
probe: `chat-v0` intact in IndexedDB post-reload, app sends sessionId
`aijudge-1` after reload. Fix direction: keep `version` stable across reload
(e.g. HYDRATE does not bump; PlayerProvider remount keyed on `isHydrated` as
well). Un-fixme when the app lands the fix.

**Steps (when unblocked):**
  1. Route **/api/judge → FULL via addInitScript (re-applies on reload). Open modal (prelude)
  2. Send "Persist me" + Enter; wait done
    - expect: system bubble "When you gain life" visible
  3. Wait for async IndexedDB write to land — poll store `ai-judge-chat`, key `chat-v0`, message count === 2
  4. `page.reload()`; wait for load
  5. Re-open judge modal
    - expect: user bubble "Persist me" + system bubble "When you gain life" restored from IndexedDB (SPEC §9.9)
    - expect: exactly 2 bubbles (1 user + 1 system)
    - expect: input empty and enabled
  6. Send "After reload" + Enter (mock still active after reload)
    - expect: request captured; sessionId === "aijudge-0" (deterministic across reload)
    - expect: 2 user + 2 system bubbles (restored + new exchange)

#### 1.16. TC-AJ-23: Game restart (⟳) bumps version → fresh chat, aijudge-1

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. Route **/api/judge → FULL. Open modal (prelude)
  2. Send "Reset me" + Enter; wait done; close modal via CLOSE
  3. Open belt → click "Restart Life" (⟳; version bump, SPEC §9.9)
  4. Re-open judge modal
    - expect: modal visible
    - expect: 0 bubbles — new game version starts fresh chat (no carryover)
    - expect: input enabled
  5. Send "After reset" + Enter; wait done
    - expect: request captured; sessionId === "aijudge-1" (version bumped by restart)
    - expect: exactly 1 user + 1 system bubble (fresh thread)

#### 1.17. TC-AJ-24: IndexedDB blocked → in-memory chat works, no crash

**File:** `tests/e2e/ai-judge.spec.ts`

**Steps:**
  1. `page.addInitScript`: override `indexedDB.open` to throw `DOMException("blocked")` (before app scripts). Attach pageerror + console-error collectors. Route **/api/judge → FULL. Open modal (prelude)
  2. Send "Memory only" + Enter; wait done
    - expect: user bubble + system bubble visible (in-memory chat works, SPEC §9.9 fallback)
    - expect: input re-enabled
  3. Close via CLOSE; re-open
    - expect: in-memory history survives modal close (1 user + 1 system bubble)
  4. Cleanup assertions
    - expect: no pageerror events, no error-level console messages (blocked IDB swallowed everywhere)
