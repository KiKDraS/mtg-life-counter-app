// spec: specs/semantic-retrieval-regression.plan.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Semantic Retrieval (Phase 2) regression — client under branch-era server
   behaviors. Feature: feature/semantic-retrieval — 100% server-side diff; the
   client-visible SSE contract (status → token* → done, SPEC §9.5) is UNCHANGED.
   These 4 tests pin the two new failure-timing surfaces the semantic path
   introduces: done-with-timings (live-observed payload), long silent context
   phase (embed latency), degraded-context done, close-during-silence abort.
   Judge route is ALWAYS mocked via the in-page fetch override — never hits the
   real route. Selectors/helpers mirror tests/e2e/ai-judge.spec.ts exactly. */

/* SPEC §9.9 — sessionId is version-derived: `aijudge-${gameVersion}`. */
const sessionIdFor = (version: number): string => `aijudge-${version}`;

/* ── Mock fixtures (specs/semantic-retrieval-regression.plan.md §Mock
   fixtures) ── */

interface StreamChunk {
  readonly data: string;
  readonly delayMs?: number;
}

type MockFixture =
  | {
      readonly kind: "body";
      readonly status?: number;
      readonly contentType?: string;
      readonly delayMs?: number;
      readonly body: string;
    }
  | { readonly kind: "stream"; readonly chunks: StreamChunk[]; readonly holdOpen?: boolean };

/* Mirrors the LIVE-observed real-server `done` payload (dev log 2026-09-23:
   totalMs 5142, phases [{context,0},{thinking,51}], scryfallMs 48, rulesMs 47,
   firstTokenMs 1656, firstCharMs 4597). The ai-judge.spec.md fixtures omit
   `timings` — this one closes the mock-vs-reality gap. */
const FIXTURE_DONE_WITH_TIMINGS: MockFixture = {
  kind: "stream",
  chunks: [
    { data: 'data: {"type":"status","phase":"context"}\n\n' },
    { data: 'data: {"type":"status","phase":"thinking"}\n\n' },
    { data: 'data: {"type":"token","content":"Semantic "}\n\n' },
    { data: 'data: {"type":"token","content":"path "}\n\n' },
    { data: 'data: {"type":"token","content":"answer."}\n\n' },
    {
      data: 'data: {"type":"done","timings":{"totalMs":5142,"phases":[{"phase":"context","ms":0},{"phase":"thinking","ms":51}],"scryfallMs":48,"rulesMs":47,"firstTokenMs":1656,"firstCharMs":4597},"citations":[],"usage":{"inputTokens":1200,"outputTokens":300,"cost":0.0015},"model":"anthropic/claude-sonnet-4","sourcesUsed":["mtg.wtf"]}\n\n',
    },
  ],
};

/* Semantic-path latency proxy: status:context immediately, then 2500ms
   silence, then status:thinking, then tokens 100ms apart, then done. Pins the
   client under the embed-call context-phase delay (up to EMBED_TIMEOUT_MS 10s
   server-side). */
const FIXTURE_LONG_SILENCE: MockFixture = {
  kind: "stream",
  chunks: [
    { data: 'data: {"type":"status","phase":"context"}\n\n' },
    { delayMs: 2500, data: 'data: {"type":"status","phase":"thinking"}\n\n' },
    { delayMs: 100, data: 'data: {"type":"token","content":"The "}\n\n' },
    { delayMs: 100, data: 'data: {"type":"token","content":"answer "}\n\n' },
    { delayMs: 100, data: 'data: {"type":"token","content":"is "}\n\n' },
    { delayMs: 100, data: 'data: {"type":"token","content":"forty."}\n\n' },
    {
      delayMs: 100,
      data: 'data: {"type":"done","citations":[],"usage":{"inputTokens":10,"outputTokens":20,"cost":0.0001},"model":"test/model","sourcesUsed":["mtg.wtf"]}\n\n',
    },
  ],
};

/* Degraded-mode done (SPEC §9.3.2): rules fetch failed AND stale missing, or
   both retrievals fell through — empty citations/sourcesUsed. */
const FIXTURE_DEGRADED_DONE: MockFixture = {
  kind: "body",
  body: [
    'data: {"type":"token","content":"No rules found."}\n\n',
    'data: {"type":"done","citations":[],"sourcesUsed":[],"usage":{"inputTokens":10,"outputTokens":20,"cost":0.0001},"model":"test/model"}\n\n',
  ].join(""),
};

/* status:context, then silence forever — never a token, never done. Simulates
   a user closing mid-context-phase. */
const FIXTURE_SILENCE_HELD: MockFixture = {
  kind: "stream",
  holdOpen: true,
  chunks: [{ data: 'data: {"type":"status","phase":"context"}\n\n' }],
};

/* ── Helpers (verbatim from tests/e2e/ai-judge.spec.ts) ── */

interface GameContextBody {
  readonly format?: string;
  readonly players?: Array<{
    readonly playerId?: number;
    readonly life?: number;
    readonly color?: unknown[];
    readonly counters?: unknown[];
    readonly commanderDamage?: unknown[];
  }>;
}

interface JudgeRequestBody {
  readonly sessionId?: string;
  readonly question?: string;
  readonly gameContext?: GameContextBody;
}

type JudgeMock = { readonly bodies: JudgeRequestBody[]; readonly statuses: number[] };

/**
 * Mock the judge API in-page by overriding window.fetch (installed before any
 * app script via addInitScript). Returns a native browser Response whose web
 * ReadableStream delivers SSE chunks incrementally to the client reader —
 * route.fulfill() buffers and cannot stream, so this is the only way to get
 * true incremental token delivery. POST bodies + response statuses are
 * recorded on window.__judgeMock.
 */
async function mockJudge(page: Page, fixture: MockFixture): Promise<void> {
  await page.addInitScript((fx) => {
    const bodies: Array<Record<string, unknown>> = [];
    const statuses: number[] = [];
    (window as unknown as { __judgeMock: unknown }).__judgeMock = { bodies, statuses };
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!url.includes("/api/judge")) return origFetch(input, init);
      try {
        bodies.push(JSON.parse(String(init?.body ?? "")) as Record<string, unknown>);
      } catch {
        bodies.push({});
      }
      statuses.push(
        fx.kind === "body" ? (fx.status ?? 200) : 200,
      );
      if (fx.kind === "body") {
        if (fx.delayMs) await new Promise((r) => setTimeout(r, fx.delayMs));
        return new Response(fx.body, {
          status: fx.status ?? 200,
          headers: { "Content-Type": fx.contentType ?? "text/event-stream" },
        });
      }
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for (const chunk of fx.chunks) {
              if (chunk.delayMs) await new Promise((r) => setTimeout(r, chunk.delayMs));
              controller.enqueue(new TextEncoder().encode(chunk.data));
            }
            if (!fx.holdOpen) controller.close();
          } catch {
            /* stream aborted (dialog closed mid-stream) — swallow */
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    };
  }, fixture);
}

async function judgeBodies(page: Page): Promise<JudgeRequestBody[]> {
  return page.evaluate(() => {
    const mock = (window as unknown as { __judgeMock?: JudgeMock }).__judgeMock;
    return mock?.bodies ?? [];
  });
}

async function waitForBodies(page: Page, count: number): Promise<JudgeRequestBody[]> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const mock = (window as unknown as { __judgeMock?: JudgeMock }).__judgeMock;
        return mock?.bodies.length ?? 0;
      }),
    )
    .toBe(count);
  return judgeBodies(page);
}

/** Open modal prelude: goto /, open belt, click "AI Judge". */
async function openJudgeModal(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Open Spellbook Menu").click();
  await expect(page.locator("#spellbook-toggle")).toBeChecked();
  await page.getByRole("button", { name: "AI Judge", exact: true }).click();
  await expect(modal(page)).toBeVisible();
}

/** Re-open the judge modal without navigating (belt may be open or closed). */
async function reopenJudgeModal(page: Page): Promise<void> {
  if (!(await page.locator("#spellbook-toggle").isChecked())) {
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(page.locator("#spellbook-toggle")).toBeChecked();
  }
  await page.getByRole("button", { name: "AI Judge", exact: true }).click();
  await expect(modal(page)).toBeVisible();
}

async function sendQuestion(page: Page, text: string): Promise<void> {
  const field = input(page);
  await field.fill(text);
  await field.press("Enter");
}

function errorCollectors(page: Page): {
  pageErrors: string[];
  consoleErrors: string[];
} {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // Off-Vercel, Vercel scripts 404 — benign (PR #122 artifact; Analytics
    // added by feature/vercel-analytics, same self-host 404).
    if (msg.text().includes("_vercel/")) return;
    if (msg.text() === "Failed to load resource: the server responded with a status of 404 (Not Found)")
      return;
    consoleErrors.push(msg.text());
  });
  return { pageErrors, consoleErrors };
}

/* ── Locators (specs/ai-judge.spec.md §Selectors) ── */

const modal = (page: Page): Locator => page.locator("#ai-judge-modal");
const input = (page: Page): Locator =>
  page.getByRole("textbox", { name: "Ask about a card or rule" });
const sendButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Send question" });
const typing = (page: Page): Locator => page.getByLabel("AI Judge is typing");
const scroll = (page: Page): Locator =>
  modal(page).locator("div[class*='overflow-y-auto']");
/* Bubbles live inside the chat list; the offline alert also carries bg-mana-b,
   so scope bubble locators to the scroll container to exclude it. */
const systemBubbles = (page: Page): Locator => scroll(page).locator(".bg-mana-b");
const userBubbles = (page: Page): Locator => scroll(page).locator(".bg-mana-c");
const closeButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Close AI Judge" });

/** Send button not stuck by streaming: with an empty draft it sits at the
    idle trim-guard baseline (disabled, TC-AJ-25); a draft re-enables it. */
async function expectSendReleased(page: Page): Promise<void> {
  await expect(sendButton(page)).toBeDisabled();
  await input(page).fill("draft");
  await expect(sendButton(page)).toBeEnabled();
  await input(page).fill("");
}

/* ───────────────────────────────────────────────
 * 1. Semantic Retrieval Regression
 * ─────────────────────────────────────────────── */

test.describe("Semantic Retrieval Regression", () => {
  test("TC-SR-01: done-with-timings (real-server payload) → renders, no raw JSON, input re-enabled", async ({
    page,
  }) => {
    // 1. Error collectors on; mock DONE_WITH_TIMINGS (live-observed real-server
    //    done payload incl. `timings`); open modal
    const errors = errorCollectors(page);
    await mockJudge(page, FIXTURE_DONE_WITH_TIMINGS);
    await openJudgeModal(page);

    // expect: #ai-judge-modal visible/open; input focused
    await expect(modal(page)).toHaveAttribute("open", "");
    await expect(input(page)).toBeFocused();

    // 2. Send "Cast timing question"; wait done (input re-enabled)
    await sendQuestion(page, "Cast timing question");
    await expect(input(page)).toBeEnabled();

    // expect: exactly 1 user bubble with exact text
    await expect(userBubbles(page)).toHaveCount(1);
    await expect(userBubbles(page)).toHaveText("Cast timing question");
    // expect: exactly 1 system bubble with exact answer text
    await expect(systemBubbles(page)).toHaveCount(1);
    await expect(systemBubbles(page)).toHaveText("Semantic path answer.");

    // expect: DOM clean in both bubbles — no braces, no raw JSON keys
    // (timings/phases/contextMs/totalMs/scryfallMs/rulesMs/firstTokenMs/
    // firstCharMs/usage/model/sourcesUsed never reach bubble markup)
    const systemHtml = await systemBubbles(page).innerHTML();
    const userHtml = await userBubbles(page).innerHTML();
    expect(systemHtml).not.toContain("{");
    expect(systemHtml).not.toContain("}");
    expect(userHtml).not.toContain("{");
    expect(userHtml).not.toContain("}");
    expect(systemHtml).not.toMatch(
      /(timings|phases|contextMs|totalMs|scryfallMs|rulesMs|firstTokenMs|firstCharMs|usage|model|sourcesUsed)/,
    );
    expect(userHtml).not.toMatch(
      /(timings|phases|contextMs|totalMs|scryfallMs|rulesMs|firstTokenMs|firstCharMs|usage|model|sourcesUsed)/,
    );

    // expect: typing gone; input re-enabled; send button not streaming-locked
    await expect(typing(page)).toHaveCount(0);
    await expect(input(page)).toBeEnabled();
    await expectSendReleased(page);

    // 3. POST contract unchanged: sessionId version-derived, no gameContext
    const bodies = await waitForBodies(page, 1);
    expect(bodies[0].question).toBe("Cast timing question");
    expect(bodies[0].sessionId).toBe(sessionIdFor(0));
    expect(bodies[0].gameContext).toBeUndefined();

    // 4. Cleanup: assert error collectors empty
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("TC-SR-02: long silent context phase → typing persists, no premature error, stream completes", async ({
    page,
  }) => {
    // 1. Error collectors on; mock LONG_SILENCE (2.5s pre-token hold); open modal
    const errors = errorCollectors(page);
    await mockJudge(page, FIXTURE_LONG_SILENCE);
    await openJudgeModal(page);
    // expect: modal visible
    await expect(modal(page)).toBeVisible();

    // 2. Send "Combat timing question"
    await sendQuestion(page, "Combat timing question");
    // expect: 1 user bubble; typing indicator visible (pre-first-token 3-dot
    // bubble, aria-label "AI Judge is typing")
    await expect(userBubbles(page)).toHaveCount(1);
    await expect(userBubbles(page)).toHaveText("Combat timing question");
    await expect(typing(page)).toBeVisible();

    // 3. Mid-silence (t ≈ 1.5s after send — BEFORE the 2.5s mark):
    //    typing STILL visible, no premature timeout
    await page.waitForTimeout(1500);
    await expect(typing(page)).toBeVisible();
    // expect: input disabled; send button disabled
    await expect(input(page)).toBeDisabled();
    await expect(sendButton(page)).toBeDisabled();
    // expect: no error bubble, no partial answer — the only system element is
    // the empty pre-token typing bubble (silence produced no token)
    await expect(systemBubbles(page)).toHaveCount(1);
    await expect(systemBubbles(page).first()).toHaveText("");

    // 4. Stream completes (t ≈ 3s+): wait for input re-enabled
    await expect(input(page)).toBeEnabled();
    // expect: exactly 1 system bubble with exact answer text; typing gone
    await expect(systemBubbles(page)).toHaveCount(1);
    await expect(systemBubbles(page)).toHaveText("The answer is forty.");
    await expect(typing(page)).toHaveCount(0);
    // expect: input + send button released
    await expect(input(page)).toBeEnabled();
    await expectSendReleased(page);

    // 5. Cleanup: assert error collectors empty
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("TC-SR-03: degraded-context done (empty sources/citations) → answer still renders, no crash", async ({
    page,
  }) => {
    // 1. Error collectors on; mock DEGRADED_DONE (rules + cards both
    //    unavailable — semantic AND lexical retrievals fell through); open modal
    const errors = errorCollectors(page);
    await mockJudge(page, FIXTURE_DEGRADED_DONE);
    await openJudgeModal(page);

    // 2. Send "Edge rule question"; wait done (input re-enabled)
    await sendQuestion(page, "Edge rule question");
    await expect(input(page)).toBeEnabled();

    // expect: 1 user bubble exact; 1 system bubble exact
    await expect(userBubbles(page)).toHaveCount(1);
    await expect(userBubbles(page)).toHaveText("Edge rule question");
    await expect(systemBubbles(page)).toHaveCount(1);
    await expect(systemBubbles(page)).toHaveText("No rules found.");
    // expect: typing gone; input + send button released
    await expect(typing(page)).toHaveCount(0);
    await expect(input(page)).toBeEnabled();
    await expectSendReleased(page);

    // 3. DOM clean: no braces; no citations/sourcesUsed/usage/model literals
    const systemHtml = await systemBubbles(page).innerHTML();
    const userHtml = await userBubbles(page).innerHTML();
    expect(systemHtml).not.toContain("{");
    expect(systemHtml).not.toContain("}");
    expect(userHtml).not.toContain("{");
    expect(userHtml).not.toContain("}");
    expect(systemHtml).not.toMatch(/(citations|sourcesUsed|usage|model)/);
    expect(userHtml).not.toMatch(/(citations|sourcesUsed|usage|model)/);

    // 4. Cleanup: assert error collectors empty
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("TC-SR-04: close during pre-token silence → clean abort, no phantom bubble on reopen", async ({
    page,
  }) => {
    // 1. Error collectors on; mock SILENCE_HELD (status:context then silence
    //    forever — never a token, never done); open modal
    const errors = errorCollectors(page);
    await mockJudge(page, FIXTURE_SILENCE_HELD);
    await openJudgeModal(page);

    // 2. Send "Slow question"
    await sendQuestion(page, "Slow question");
    // expect: 1 user bubble; typing indicator visible; input disabled
    await expect(userBubbles(page)).toHaveCount(1);
    await expect(userBubbles(page)).toHaveText("Slow question");
    await expect(typing(page)).toBeVisible();
    await expect(input(page)).toBeDisabled();

    // 3. Click CLOSE while STILL silent (typing present, no token yet)
    await closeButton(page).click();
    await expect(modal(page)).not.toBeVisible();
    await page.waitForTimeout(200);
    // expect: no pageerror / console errors (abort swallowed)
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);

    // 4. Re-open modal
    await reopenJudgeModal(page);
    // expect: user bubble persisted (close no longer clears history — SPEC
    // §9.9); 0 system bubbles (no phantom typing/empty bubble from the aborted
    // silence)
    await expect(userBubbles(page)).toHaveCount(1);
    await expect(userBubbles(page)).toHaveText("Slow question");
    await expect(systemBubbles(page)).toHaveCount(0);
    // expect: input empty + enabled; typing gone
    await expect(input(page)).toHaveValue("");
    await expect(input(page)).toBeEnabled();
    await expect(typing(page)).toHaveCount(0);

    // 5. Cleanup: assert error collectors empty
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });
});