# AI Judge — E2E Test Plan (specs/ai-judge.spec.md)

Feature: `feature/ai-judge`. App: MTG Life Counter PWA, Next.js 16 App Router. Target: `tests/e2e/ai-judge.spec.ts` (single describe, **20 tests**). Config: baseURL `http://localhost:3000`, chromium, 1 worker, 1280x720. Seed: `tests/seed.spec.ts` (goto `/` only). Assumptions: blank/fresh state per test; dev machine has NO OpenRouter key → real route 503s — **every test MUST mock `/api/judge`** via in-page fetch override, never hit real route.

## Contract sources
DESIGN.md §6.4 (chat window), §6.4.0 (offline), §6.4.1 (answer formatting). SPEC.md §9.5 (SSE), §9.9 (history/sessionId), §9.10 (UI/offline).

## Open modal (reused prelude)
1. `page.goto("/")`.
2. Click `getByLabel("Open Spellbook Menu")`; expect `#spellbook-toggle` checked.
3. Click `getByRole("button", { name: "AI Judge" })`; expect `#ai-judge-modal` visible.
(Modal = native `<dialog>` via `show()`; `open` attr present; Escape handled by DialogShell keydown inside dialog. `reopenJudgeModal` variant re-opens without navigation — belt may be open or closed.)

## Selectors (current DOM — no testids)
- DIALOG `#ai-judge-modal` (aria-modal="true", aria-labelledby="ai-judge-title")
- CLOSE `getByRole("button", { name: "Close AI Judge" })`
- INPUT `getByRole("textbox", { name: "Ask about a card or rule" })` — placeholder exact `Ask about a card or rule…` (U+2026). autoFocus on open.
- STATUS `modal.locator("[role='status']")` — offline alert
- TYPING `page.getByLabel("AI Judge is typing")` — 3-dot span
- SCROLL `modal.locator("div[class*='overflow-y-auto']")` — chat list (bubble locators scoped here; offline alert also carries `bg-mana-b`, so never scope to modal root)
- SYSTEM bubble `scroll.locator(".bg-mana-b")` (left). USER bubble `scroll.locator(".bg-mana-c")` (right). Error bubble = `.bg-mana-b` with error text.
- TITLE `#ai-judge-title` (sr-only h2, text "AI Judge")
- MarkdownText output (inside system bubble): `strong` (bold), `ul>li` / `ol>li` (lists), `p` (paragraphs), `i` (rule-ref suffix)

NO chip selectors. NO citation pills — removed from UI. UI never renders citations (DESIGN §6.4, SPEC §9.5).

## Color assertions (computed style)
- system bubble: background-color `rgb(102, 101, 101)` (#666565), color `rgb(250, 248, 245)` (#FAF8F5)
- user bubble: background-color `rgb(202, 197, 192)` (#CAC5C0), color `rgb(26, 26, 26)` (#1A1A1A)
- alignment: user bubble boundingBox.x > system bubble boundingBox.x
- offline alert: bg `rgb(102, 101, 101)`, text exact `You're offline — AI Judge needs internet.` (apostrophe = U+2019)
- rule-ref `<i>`: fontStyle italic; color #FAF8F5 @ 75% opacity — computed as rgba, `color(srgb ...)` or `lab(...)` (Tailwind color-mix); accept any form

## POST body contract (SPEC §9.5, §9.8, §9.9)
- Client sends `{ sessionId, question }` only. **No `gameContext`** — client sends manual questions only (SPEC §9.8: capability reserved, client never attaches).
- `sessionId = aijudge-<version>` — deterministic per game version, NOT a UUID. Stable across reload; bumped by game restart.
- Assert `bodies[i].question` exact, `bodies[i].sessionId` exact, `bodies[i].gameContext` undefined.

## Mock fixtures (exact payloads)
Mechanism: `page.addInitScript(fixture)` overrides `window.fetch` BEFORE app scripts → native browser `Response` with web `ReadableStream` delivering SSE chunks incrementally. `route.fulfill()` buffers and cannot stream — do NOT use `page.route` for this route. POST bodies + statuses recorded on `window.__judgeMock` (`{bodies, statuses}`). addInitScript re-applies on `page.reload()` — mock survives reload.

Client parses SSE blocks split on `\n\n`, accepts `data: ` lines. LF endings. Fixtures:

- **FULL** (single body, all events at once; optional `delayMs`): `data: {"type":"token","content":"When"}` + ` you` + ` gain life`, then done `{"type":"done","citations":[],"usage":{"inputTokens":1200,"outputTokens":300,"cost":0.0015},"model":"anthropic/claude-sonnet-4","sourcesUsed":["mtg.wtf"]}`. Rendered: "When you gain life".
- **ERR_429** (200 body): `data: {"type":"error","code":"rate_limited","message":"The AI Judge is busy. Please wait a moment."}`
- **ERR_503** (status 503 + SSE error body): `data: {"type":"error","code":"misconfigured","message":"The AI Judge is not configured. Please try again later."}` — client reads error body on non-ok status (SPEC §9.5).
- **STREAM_TWO_STAGE** (incremental): hold 300ms no data (typing window), then chunks `The ` / `answer ` / `is ` / `forty.` 100ms apart, then done, close. Rendered: "The answer is forty." DONE_EVENT: `{"type":"done","citations":[],"usage":{"inputTokens":10,"outputTokens":20,"cost":0.0001},"model":"test/model","sourcesUsed":["mtg.wtf"]}`.
- **STREAM_NEVER_ENDS** (`holdOpen`): 1 token `partial `, stream held open, never done.
- **STREAM_MANY**: 300 chunks `tokenN ` every 5ms, then done, close.
- **STREAM_LONG**: 600 chunks `answer ` every 5ms, then done, close (~3600 chars → overflow).
- **FORMATTED_MD** (DESIGN §6.4.3): stream split mid-`**`, between list items, inside list item text — chunks yield `**Yes.** You may block.\n\n- Rule one\n- Rule two\n\n1. First\n2. Second`. Renders: strong "Yes.", `ul` [Rule one, Rule two], `ol` [First, Second].
- **TOLERANT_LIST** (DESIGN §6.4.3): single block `Start text\n- Item one\n- Item two\nEnd text` — no blank line before list. Renders `<p>` + `<ul>` + `<p>`.
- **LONG_PLAIN** (DESIGN §6.4.3 paragraphize): one ~450-char block, no markdown, rule id `CR 405.1a` mid-first-sentence. Splits on sentence boundaries into ≥2 `<p>`; rule id never split.
- **RULE_REFS** (DESIGN §6.4.2): block `The stack is a zone (CR 405.1) and holds spells (rule 405.2) and survives (117.1d).` — refs stripped, appended as ` - CR 405.1, CR 405.2, CR 117.1d` italic suffix (3 `<i>`). Bare-number `(117.1d)` form extracted too.
- **CLEAN_ANSWER** (SPEC §9.5): tokens = extracted answer text only `Yes. Reanimate returns the creature.`; citations (`rule` 702.12a + `card` Reanimate/scryfall) arrive ONCE in done. Bubble must never show raw JSON.

## Chat persistence (SPEC §9.9 — landed)
- Persisted per game version: IndexedDB store `ai-judge-chat`, key `chat-v<version>`, entry `{version, sessionId, updatedAt, messages[]}`.
- Survives modal close AND page reload. Close no longer clears history.
- Restart (⟳ Restart Life) bumps version → fresh chat `chat-v<version+1>`, sessionId `aijudge-<version+1>`.
- IndexedDB blocked/private mode → memory-only fallback, app usable, no crash.
- Poll helper `persistedMessageCount(page, version)` reads store directly from page.

## Failure collection
Streaming/abort/IDB tests: attach `page.on("pageerror")` + `page.on("console")` error collector at test start; assert empty at end.

## Server-side coverage note (NOT e2e)
Retrieval pipeline, card RAG context injection (SPEC §9.7), language mirror (es→es, stopword detection), multi-model fallback routing (SPEC §9.6), rate limiting/timeouts (SPEC §9.5) — live-smoke verified only, mocked out of e2e. E2e covers client contract: SSE parsing, rendering, offline, persistence. Server e2e would require real OpenRouter key — excluded by design.

## Test Scenarios

### 1. AI Judge

**Seed:** `tests/seed.spec.ts` — all 20 tests in `tests/e2e/ai-judge.spec.ts`.

#### 1.1. TC-AJ-01: Modal opens from belt with input
1. Open-modal prelude.
   - expect: `#ai-judge-modal` visible (has `open` attr), `aria-modal="true"`
2. Check chat input.
   - expect: textbox "Ask about a card or rule" visible, placeholder exactly `Ask about a card or rule…`, focused (autoFocus, DESIGN §6.4)

#### 1.2. TC-AJ-02: Type + Enter sends correct POST; bubbles render; typing indicator
1. Mock FULL with 400ms delay. Open modal.
2. Type "When can I cast instants?" + Enter.
   - expect: input value `""` (cleared after send)
   - expect: typing indicator visible during delay
3. Wait for response.
   - expect: 1 request; `question` exact; `sessionId` = `aijudge-0`; `gameContext` undefined
   - expect: user bubble (.bg-mana-c) text exact, bg `rgb(202,197,192)`, color `rgb(26,26,26)`
   - expect: system bubble (.bg-mana-b) text "When you gain life", bg `rgb(102,101,101)`, color `rgb(250,248,245)`
   - expect: userX > systemX (right vs left)
   - expect: typing gone; exactly 1 system bubble (tokens merged)

#### 1.3. TC-AJ-03: Streaming — tokens accumulate into one system bubble; done finalizes
1. Mock STREAM_TWO_STAGE. Error collectors on. Open modal.
2. Type "Combat math question" + Enter.
   - expect: typing visible during initial hold
3. Poll bubble text fast (25ms) while tokens stream.
   - expect: empty streaming bubble preceded first token; first chunk exactly "The "; text grows through intermediate states to full answer; never multiple answer bubbles
   - expect: typing gone once streamText non-empty
4. Done.
   - expect: 1 system bubble "The answer is forty."; input enabled; no console/page errors

#### 1.4. TC-AJ-04: Error SSE event → error bubble + input re-enabled
1. Mock ERR_429 (200 + error event). Open modal.
2. Type "Is this play legal?" + Enter.
   - expect: user bubble visible
3. Error handling.
   - expect: error bubble .bg-mana-b exact text "The AI Judge is busy. Please wait a moment.", system colors
   - expect: typing gone; input enabled (SPEC §9.10)
   - expect: exactly 1 system bubble, no answer text ("gain life" absent)

#### 1.5. TC-AJ-05: 503 misconfigured (no OpenRouter key) → error bubble + input state
1. Mock ERR_503 (status 503 + SSE error body). Error collectors on. Open modal.
2. Type "Test question" + Enter.
   - expect: request captured with status 503
3. Error handling.
   - expect: error bubble exact text "AI Judge unavailable" (SPEC §9.10)
   - expect: input enabled; typing gone; no console/page errors

#### 1.6. TC-AJ-06: Input disabled during streaming
1. Mock STREAM_NEVER_ENDS (1 token, held open). Error collectors on. Open modal.
2. Type "Long question" + Enter.
   - expect: user bubble visible; stream bubble "partial " visible
3. Streaming states.
   - expect: input `disabled`
4. Cleanup: close via CLOSE button.
   - expect: modal not visible; no console/page errors

#### 1.7. TC-AJ-08: Offline — exact alert copy, input disabled; online re-enables without reload
1. Mock FULL (addInitScript must precede navigation). Goto `/`. Attach `page.on("load")` counter AFTER initial load. Open modal.
   - expect: loads === 0
2. `context.setOffline(true)`.
   - expect: status visible, exact copy `You're offline — AI Judge needs internet.`, bg `rgb(102,101,101)`, color `rgb(250,248,245)`
   - expect: input disabled; loads === 0
3. `context.setOffline(false)`.
   - expect: status gone (count 0); input enabled; URL unchanged; loads === 0 (SPEC §9.10: state clears, no reload)
4. Post-online send "Back online" + Enter (FULL active).
   - expect: 1 request; user + system bubbles render

#### 1.8. TC-AJ-09: Offline with history — bubbles stay visible + scrollable, read-only
1. Mock STREAM_LONG. Error collectors on. Open modal.
2. Type "Long rules question" + Enter; wait done (input disabled→enabled).
   - expect: 1 user + 1 system bubble; answer length > 3000 chars
3. `context.setOffline(true)`.
   - expect: status alert exact copy; input disabled; bubbles still visible (2 total, history preserved §6.4.0)
4. Evaluate SCROLL: scrollHeight > clientHeight; computed overflow-y `scroll` or `auto`.
5. Cleanup: offline(false), close modal.
   - expect: no console/page errors

#### 1.9. TC-AJ-10: Escape closes; re-open = same session (history persisted)
1. Mock FULL. Open modal.
2. Send "First question" (done), "Second question" (done).
   - expect: bodies[0].sessionId === bodies[1].sessionId === `aijudge-0`
   - expect: 2 user + 2 system bubbles
3. Focus input (send blurs it during stream), press Escape.
   - expect: modal not visible
4. Re-open via belt.
   - expect: history restored (2+2 bubbles, SPEC §9.9); input empty + enabled
5. Send "Third question"; wait done.
   - expect: bodies[2].sessionId === `aijudge-0` (same thread, not fresh session)
   - expect: 3 user + 3 system bubbles (carried over, no reset)

#### 1.10. TC-AJ-11: Auto-scroll — long stream pins to bottom
1. Mock STREAM_MANY (300 tokens, 5ms). Open modal.
2. Send "Scroll test" + Enter.
   - expect: user bubble visible
3. Mid-stream (poll text length > 500): SCROLL pinned — scrollTop + clientHeight >= scrollHeight - 2 (DESIGN §6.4 auto-scroll).
4. Done: tail token "token299" present (loose — timing varies); still pinned; 1 system bubble (full concatenated text).

#### 1.11. TC-AJ-13: Close mid-stream → abort, no crash; user bubble persists
1. Error collectors on. Mock STREAM_NEVER_ENDS. Open modal.
2. Send "Abort me" + Enter; wait stream bubble "partial ".
   - expect: input disabled
3. Click CLOSE while stream active.
   - expect: modal not visible; no pageerror / console errors (abort handled)
4. Re-open modal.
   - expect: user bubble "Abort me" persisted (SPEC §9.9 — close no longer clears history); 0 system bubbles (partial dropped with abort); input enabled
5. Send "After abort" (STREAM_NEVER_ENDS active), close via Escape — focus CLOSE first (stream blurs input to body; Escape only fires from inside dialog).
   - expect: request captured, sessionId `aijudge-0`; modal closed; no errors

#### 1.12. TC-AJ-14: A11y smoke — dialog semantics + sr-only title
1. Open modal.
   - expect: `aria-modal="true"`, `aria-labelledby="ai-judge-title"`, `#ai-judge-title` text "AI Judge" (sr-only h2), input focused
2. Press Escape; re-open via belt.
   - expect: modal closes; re-open works

#### 1.13. TC-AJ-17: Raw JSON never visible — bubble shows extracted answer text only
1. Error collectors on. Mock CLEAN_ANSWER (tokens = answer text only; citations once in done, §9.5). Open modal.
2. Send "Reanimate timing?" + Enter.
   - expect: system bubble text exactly "Yes. Reanimate returns the creature."
3. DOM clean: no `{` / `}` anywhere in bubble markup; no raw JSON keys `(citations|ruleId|excerpt|section|source|usage)`.
   - expect: no console/page errors

#### 1.14. TC-AJ-18: Markdown formatting — bold, bullet + numbered lists render in system bubble
1. Error collectors on. Mock FORMATTED_MD (split mid-`**`, between items, inside item text; DESIGN §6.4.3). Open modal.
2. Send "Can I block here?" + Enter; wait done.
   - expect: full text `Yes. You may block.Rule oneRule twoFirstSecond` (textContent joins blocks without separators)
   - expect: 1 `strong` with exact "Yes." (period inside strong); "You may block." present as plain text
   - expect: 1 `ul` with 2 `li` [Rule one, Rule two]; 1 `ol` with 2 `li` [First, Second]
   - expect: no literal `**` in rendered text
   - expect: no console/page errors

#### 1.15. TC-AJ-19: List tolerance — list inside a single block without blank line
1. Error collectors on. Mock TOLERANT_LIST. Open modal.
2. Send question + Enter; wait done.
   - expect: text `Start textItem oneItem twoEnd text`
   - expect: 1 `ul` with 2 `li` in order; 2 `p` with exact [Start text, End text]
   - expect: no console/page errors

#### 1.16. TC-AJ-20: Paragraphize fallback — long single block splits on sentences, rule id intact
1. Error collectors on. Mock LONG_PLAIN (~450 chars, "CR 405.1a" in first sentence; DESIGN §6.4.3). Open modal.
2. Send question + Enter; wait done.
   - expect: ≥2 `p` (sentence-boundary split); no `p` ends with "CR 405." / starts with "1a" (rule id intact)
   - expect: full text preserved ("stack resolution", "readable on one screen.")
   - expect: no console/page errors

#### 1.17. TC-AJ-21: Rule references — inline refs extracted to italic suffix
1. Error collectors on. Mock RULE_REFS (inline `(CR 405.1)` + `(rule 405.2)` + bare `(117.1d)`; DESIGN §6.4.2). Open modal.
2. Send question + Enter; wait done.
   - expect: text `The stack is a zone and holds spells and survives. - CR 405.1, CR 405.2, CR 117.1d`
   - expect: no `(CR 405.1)` / `(rule 405.2)` / `(117.1d)` remnants
   - expect: exactly 3 `i` refs, exact normalized texts
3. Style: `i` fontStyle italic; color #FAF8F5 @ 0.75 opacity — rgba / `color(srgb)` / `lab()` forms all accepted.
   - expect: no console/page errors

#### 1.18. TC-AJ-22: Reload — chat restored from IndexedDB; sessionId stable
1. Mock FULL (addInitScript re-applies on reload). Open modal.
2. Send "Persist me" + Enter; wait done.
3. Poll IndexedDB: `ai-judge-chat` key `chat-v0`, message count === 2.
4. `page.reload()`; wait load.
5. Re-open modal.
   - expect: user + system bubbles restored (SPEC §9.9); 2 bubbles total; input empty + enabled
6. Send "After reload" (mock active).
   - expect: sessionId `aijudge-0` (deterministic across reload — HYDRATE no longer bumps version); 2 user + 2 system bubbles

#### 1.19. TC-AJ-23: Game restart (⟳) bumps version → fresh chat, aijudge-1
1. Mock FULL. Open modal.
2. Send "Reset me" + Enter; wait done; close via CLOSE.
3. Belt → "Restart Life" (version bump, SPEC §9.9).
4. Re-open modal.
   - expect: 0 bubbles (fresh chat, no carryover); input enabled
5. Send "After reset" + Enter; wait done (2 bodies total).
   - expect: bodies[1].sessionId === `aijudge-1`; 1 user + 1 system bubble (fresh thread)

#### 1.20. TC-AJ-24: IndexedDB blocked → in-memory chat works, no crash
1. `addInitScript`: override `indexedDB.open` to throw `DOMException("blocked", "BlockedError")` before app scripts. Error collectors on. Mock FULL. Open modal.
2. Send "Memory only" + Enter; wait done.
   - expect: user + system bubbles; input re-enabled (memory-only fallback, SPEC §9.9)
3. Close via CLOSE; re-open.
   - expect: in-memory history survives modal close (1 user + 1 system)
4. Cleanup assertions: no pageerror / console errors (blocked IDB swallowed everywhere).
