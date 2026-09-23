# Semantic Retrieval (Phase 2) — AI Judge Regression Test Plan

Feature: `feature/semantic-retrieval` — server-side AI Judge change. App: MTG
Life Counter PWA, Next.js 16 App Router. Target: `tests/e2e/ai-judge-semantic-regression.spec.ts`
(single describe, **4 tests**). Config: baseURL `http://localhost:3000`,
chromium, 1 worker, 1280x720. Seed: `tests/seed.spec.ts` (goto `/` only).
Assumptions: blank/fresh state per test; judge route is MOCKED via the
`mockJudge` in-page fetch-override pattern (specs/ai-judge.spec.md §Mock
fixtures) — never hit the real route.

## Scope

Branch diff (develop...HEAD) is **100% server-side** — no UI files touched:

- `app/api/judge/embed.ts` (new) — question embedding + `retrieveSemanticRules` orchestration.
- `features/ai-judge/lib/rag/embeddings.ts` (new) — cosine/normalize/`retrieveSemantic` (pure TS).
- `app/api/judge/config.ts` — `EMBEDDING_OK` gate for `OPEN_ROUTER_EMBEDDING_MODEL` (opt-in; unset → lexical only).
- `app/api/judge/context.ts` — `loadRules` tries semantic first, falls back to lexical on null.
- `features/ai-judge/lib/rag/embeddings-bundle.json` — placeholder (`""`/`0`/`[]`) until `pnpm embed:refresh`.
- `scripts/embed-rules.mjs` (new) + `package.json` `embed:refresh` script.

Degradation chain (never throws, never surfaces client-side): `EMBEDDING_OK`
false → null; bundle model ≠ env → null; bundle version/hash ≠ rules artifact
→ null; wrong dims → null; embed API non-2xx/timeout(10s)/parse-fail → null;
`retrieveSemanticRules` null → `retrieveRules` lexical. The client-visible
SSE contract (`status` → `token`* → `done`, SPEC §9.5) is UNCHANGED — this
plan proves that plus the two new failure-timing surfaces the semantic path
introduces (longer silent context phase; degraded-context `done`).

## Contract sources

DESIGN.md §6.4, §6.4.0 (offline). SPEC.md §9.3.2 (degraded mode), §9.4
(semantic retrieval opt-in + degradation), §9.5 (SSE contract incl. `timings`
in `done`), §9.10 (UI/offline). Convention + selectors/helpers: specs/ai-judge.spec.md.

## Selectors / helpers (reuse from tests/e2e/ai-judge.spec.ts)

- `modal(page)` `#ai-judge-modal`; `input(page)` textbox "Ask about a card or rule"; `sendButton(page)` "Send question"; `typing(page)` `getByLabel("AI Judge is typing")`; `closeButton(page)` "Close AI Judge".
- `scroll(page)` `modal.locator("div[class*='overflow-y-auto']")`; `systemBubbles`/`userBubbles`/`allBubbles` scoped to `scroll` (offline alert also carries `bg-mana-b`).
- `mockJudge(page, fixture)` — `page.addInitScript` fetch override, records `{bodies, statuses}` on `window.__judgeMock`, survives reload. `kind: "stream"` for incremental SSE.
- `openJudgeModal` / `reopenJudgeModal` / `sendQuestion` / `waitForBodies` / `judgeBodies` / `errorCollectors` — as in specs/ai-judge.spec.md.
- `sessionIdFor(version)` = `aijudge-<version>`; POST body contract = `{sessionId, question}`, `gameContext` undefined.

## Mock fixtures (new — all `kind: "stream"` unless noted)

- **DONE_WITH_TIMINGS** — mirrors the LIVE-observed real-server `done` payload (dev log 2026-09-23: `totalMs 5142`, `phases [{context,0},{thinking,51}]`, `scryfallMs 48`, `rulesMs 47`, `firstTokenMs 1656`, `firstCharMs 4597`). The ai-judge.spec.md fixtures deliberately OMIT `timings` (client `isJudgeEvent` checks `type` only) — this fixture closes the mock-vs-reality gap. `status:context` + `status:thinking` immediately, then tokens `Semantic ` / `path ` / `answer.`, then `done` with `timings`. Rendered: "Semantic path answer."
- **LONG_SILENCE** — semantic-path latency proxy: `status:context` immediately, then **2500ms silence**, then `status:thinking`, then `The ` / `answer ` / `is ` / `forty.` 100ms apart, then done. Rendered: "The answer is forty." (Same shape as STREAM_TWO_STAGE but 2500ms hold — pins the client under the embed-call context-phase delay, up to `EMBED_TIMEOUT_MS` 10s server-side.)
- **DEGRADED_DONE** (`kind: "body"`) — degraded-mode done (SPEC §9.3.2: rules fetch failed AND stale missing, or both retrievals fell through): token `No rules found.`, `done` with `citations: []`, `sourcesUsed: []`, `usage` present, `model` `test/model`.
- **SILENCE_HELD** — `status:context`, then silence forever (`holdOpen: true`, never a token, never done). Simulates a user closing mid-context-phase.

## Test Scenarios

### 1. Semantic Retrieval Regression

**Seed:** `tests/seed.spec.ts` — all 4 tests in `tests/e2e/ai-judge-semantic-regression.spec.ts`.

#### 1.1. TC-SR-01: done-with-timings (real-server payload) → renders, no raw JSON, input re-enabled

Contract: branch-era route still emits `timings` in `done` (SPEC §9.5; route
untouched by branch — this TC pins the contract with the LIVE observed
shape). Client must render the answer, never surface JSON keys, re-enable the
input.

1. Error collectors on (spec §Failure collection). Mock DONE_WITH_TIMINGS. `openJudgeModal(page)`.
   - expect: `#ai-judge-modal` visible/open; input focused
2. `sendQuestion(page, "Cast timing question")`; wait done (`input` enabled).
   - expect: exactly 1 user bubble (.bg-mana-c) text exact `Cast timing question`
   - expect: exactly 1 system bubble (.bg-mana-b) text exact `Semantic path answer.`
   - expect: DOM clean in both bubbles — no `{` / `}` characters; none of the literals `timings`, `phases`, `contextMs`, `totalMs`, `scryfallMs`, `rulesMs`, `firstTokenMs`, `firstCharMs`, `usage`, `model`, `sourcesUsed` appear in bubble markup
   - expect: typing gone; input + send button enabled
3. POST contract unchanged: `waitForBodies(page, 1)`.
   - expect: `bodies[0].question` exact `Cast timing question`; `bodies[0].sessionId` = `aijudge-0`; `bodies[0].gameContext` undefined
4. Cleanup: assert error collectors empty — no pageerror / console errors.

#### 1.2. TC-SR-02: long silent context phase (embed latency proxy) → typing persists, no premature error, stream completes

Contract: semantic path adds up to `EMBED_TIMEOUT_MS` (10s) to the server
context phase. Client must hold the typing indicator + disabled input through
the ENTIRE silence (no premature error bubble, no premature re-enable), then
render normally.

1. Error collectors on. Mock LONG_SILENCE (2.5s hold). `openJudgeModal(page)`.
   - expect: modal visible
2. `sendQuestion(page, "Combat timing question")`; within ~1s of send.
   - expect: 1 user bubble visible; typing indicator visible (pre-first-token 3-dot bubble, aria-label "AI Judge is typing")
3. Mid-silence (t ≈ 1.5s after send — BEFORE the 2.5s mark):
   - expect: typing STILL visible (no premature timeout)
   - expect: input `disabled`; send button `disabled`
   - expect: 0 system bubbles with text — no error bubble, no partial answer (silence produced no `token`)
4. Stream completes (t ≈ 3s+): wait for `input` enabled.
   - expect: exactly 1 system bubble text exact `The answer is forty.`; typing gone; input + send button enabled
5. Cleanup: assert error collectors empty.

#### 1.3. TC-SR-03: degraded-context done (empty sources/citations) → answer still renders, no crash

Contract: degraded mode (SPEC §9.3.2 — rules + cards both unavailable, the
server outcome when semantic AND lexical retrievals fall through) streams the
answer normally with `sourcesUsed: []` / `citations: []` in `done`. Client
must render, never surface JSON.

1. Error collectors on. Mock DEGRADED_DONE. `openJudgeModal(page)`.
2. `sendQuestion(page, "Edge rule question")`; wait done (`input` enabled).
   - expect: 1 user bubble exact `Edge rule question`; 1 system bubble exact `No rules found.`
   - expect: typing gone; input + send button enabled
3. DOM clean: no `{` / `}` in bubble markup; none of `citations`, `sourcesUsed`, `usage`, `model` as literal text.
4. Cleanup: assert error collectors empty.

#### 1.4. TC-SR-04: close during pre-token silence → clean abort, no phantom bubble on reopen

Contract: the semantic path lengthens the no-token window, so closing
mid-context-phase is a likelier user action. Abort must be clean (no
pageerror/console errors), and reopening must NOT show a phantom empty
system/typing bubble — only the persisted user bubble (SPEC §9.9: partial
stream dropped with abort).

1. Error collectors on. Mock SILENCE_HELD (silence forever). `openJudgeModal(page)`.
2. `sendQuestion(page, "Slow question")`.
   - expect: 1 user bubble visible; typing indicator visible; input disabled
3. Click `closeButton(page)` while STILL silent (typing present, no token yet).
   - expect: modal not visible; no pageerror / console errors (abort swallowed)
4. `reopenJudgeModal(page)`.
   - expect: 1 user bubble `Slow question` persisted (close no longer clears history — SPEC §9.9); 0 system bubbles (no phantom typing/empty bubble from the aborted silence)
   - expect: input empty + enabled; typing gone
5. Cleanup: assert error collectors empty.

## Server-side coverage note (NOT e2e — do NOT generate)

The semantic path itself (`embedQuestion`, `retrieveSemanticRules` guards,
`pnpm embed:refresh`, placeholder-bundle staleness, dimension-mismatch
degrade, lexical fallback) is server-internal and env-gated — e2e cannot
exercise it without `OPEN_ROUTER_EMBEDDING_MODEL` + a built bundle + live
embed API. Covered by unit tests / live-smoke only. E2e scope = the client
under the branch-era server's OBSERVABLE behaviors (done-with-timings,
long-context latency, degraded done) — which is what these 4 tests pin.

## Existing coverage (generator MUST skip — already in specs/ai-judge.spec.md + tests/e2e)

| Area | Existing spec TC |
| --- | --- |
| Modal opens from belt, input focused, placeholder | TC-AJ-01 |
| POST contract, bubbles, colors, typing indicator (300ms hold) | TC-AJ-02, TC-AJ-26, TC-AJ-27 |
| Streaming accumulation into one bubble | TC-AJ-03 |
| Error SSE event (429) → error bubble + re-enable | TC-AJ-04, TC-AJ-32 |
| 503 misconfigured → "AI Judge unavailable" bubble | TC-AJ-05 |
| Input/send disabled during streaming | TC-AJ-06, TC-AJ-30 |
| Offline alert copy, input disabled, online re-enable no-reload | TC-AJ-08, TC-AJ-30 |
| Offline history read-only + scroll | TC-AJ-09 |
| Escape close, reopen same session, multi-question | TC-AJ-10 |
| Auto-scroll pinning | TC-AJ-11 |
| Close mid-stream (token present) → abort, user bubble persists | TC-AJ-13 |
| Dialog a11y + sr-only title | TC-AJ-14 |
| Raw JSON never visible (citations-in-done) | TC-AJ-17 |
| Markdown bold/lists/tolerance/paragraphize/rule refs | TC-AJ-18/19/20/21 |
| Reload persistence, restart bump, IDB blocked | TC-AJ-22/23/24 |
| Send button states, click path, textarea grow/cap | TC-AJ-25/26/28/29/33 |
| Viewport meta, layout shrink, vv/vk keyboard lift, canvas black | TC-AJ-34/35/36/37/38, judge-close-reset.spec.ts, ios-judge.spec.ts |
| Belt → AI Judge open + collapse | spellbook-belt.spec.ts TC-2.7 |

Overlap guard: TC-SR-01 differs from TC-AJ-17 (fixture WITH `timings`/real
shape vs citations-only); TC-SR-02 differs from TC-AJ-02/03 (2.5s pre-token
silence vs 300ms/active streaming — no premature error/enable is the point);
TC-SR-03 differs from TC-AJ-17 (degraded done, empty sources vs populated
citations); TC-SR-04 differs from TC-AJ-13 (close during ZERO-token silence
vs 1-token stream — phantom-bubble absence is the point).