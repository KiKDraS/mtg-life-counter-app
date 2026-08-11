// spec: specs/ai-judge.spec.md
// seed: tests/seed.spec.ts

import { test, expect, type Locator, type Page } from "@playwright/test";

/* ── Shared constants (DESIGN §6.4) ── */

const SYSTEM_BG = "rgb(102, 101, 101)"; // mana-b #666565
const SYSTEM_TEXT = "rgb(250, 248, 245)"; // ui-textLight #FAF8F5
const USER_BG = "rgb(202, 197, 192)"; // mana-c #CAC5C0
const USER_TEXT = "rgb(26, 26, 26)"; // ui-textDark #1A1A1A
const OFFLINE_COPY = "You're offline — AI Judge needs internet.";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const DONE_EVENT =
  'data: {"type":"done","citations":[],"usage":{"inputTokens":10,"outputTokens":20,"cost":0.0001},"model":"test/model","sourcesUsed":["mtg.wtf"]}\n\n';

/* ── Mock fixtures (specs/ai-judge.spec.md §Mock fixtures) ── */

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

const FIXTURE_FULL: MockFixture = {
  kind: "body",
  body: [
    'data: {"type":"token","content":"When"}\n\n',
    'data: {"type":"token","content":" you"}\n\n',
    'data: {"type":"token","content":" gain life"}\n\n',
    'data: {"type":"done","citations":[],"usage":{"inputTokens":1200,"outputTokens":300,"cost":0.0015},"model":"anthropic/claude-sonnet-4","sourcesUsed":["mtg.wtf"]}\n\n',
  ].join(""),
};

const FIXTURE_ERR_429: MockFixture = {
  kind: "body",
  body: 'data: {"type":"error","code":"rate_limited","message":"The AI Judge is busy. Please wait a moment."}\n\n',
};

const FIXTURE_ERR_503: MockFixture = {
  kind: "body",
  status: 503,
  body: 'data: {"type":"error","code":"misconfigured","message":"The AI Judge is not configured. Please try again later."}\n\n',
};

const FIXTURE_TWO_STAGE: MockFixture = {
  kind: "stream",
  chunks: [
    { delayMs: 300, data: 'data: {"type":"token","content":"The "}\n\n' },
    { delayMs: 100, data: 'data: {"type":"token","content":"answer "}\n\n' },
    { delayMs: 100, data: 'data: {"type":"token","content":"is "}\n\n' },
    { delayMs: 100, data: 'data: {"type":"token","content":"forty."}\n\n' },
    { delayMs: 100, data: DONE_EVENT },
  ],
};

const FIXTURE_NEVER_ENDS: MockFixture = {
  kind: "stream",
  holdOpen: true,
  chunks: [{ data: 'data: {"type":"token","content":"partial "}\n\n' }],
};

const FIXTURE_MANY: MockFixture = {
  kind: "stream",
  chunks: [
    ...Array.from({ length: 300 }, (_, i): StreamChunk => ({
      delayMs: 5,
      data: `data: {"type":"token","content":"token${i} "}\n\n`,
    })),
    { delayMs: 5, data: DONE_EVENT },
  ],
};

const FIXTURE_LONG: MockFixture = {
  kind: "stream",
  chunks: [
    ...Array.from({ length: 600 }, (): StreamChunk => ({
      delayMs: 5,
      data: 'data: {"type":"token","content":"answer "}\n\n',
    })),
    { delayMs: 5, data: DONE_EVENT },
  ],
};

/* ── Helpers ── */

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

async function judgeStatuses(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const mock = (window as unknown as { __judgeMock?: JudgeMock }).__judgeMock;
    return mock?.statuses ?? [];
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
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  return { pageErrors, consoleErrors };
}

/* ── Locators (specs/ai-judge.spec.md §Selectors) ── */

const modal = (page: Page): Locator => page.locator("#ai-judge-modal");
const input = (page: Page): Locator =>
  page.getByRole("textbox", { name: "Ask about a card or rule" });
const typing = (page: Page): Locator => page.getByLabel("AI Judge is typing");
const chips = (page: Page): Locator =>
  modal(page).getByRole("group", { name: "Suggestions" });
const scroll = (page: Page): Locator =>
  modal(page).locator("div[class*='overflow-y-auto']");
/* Bubbles live inside the chat list; the offline alert also carries bg-mana-b,
   so scope bubble locators to the scroll container to exclude it. */
const systemBubbles = (page: Page): Locator => scroll(page).locator(".bg-mana-b");
const userBubbles = (page: Page): Locator => scroll(page).locator(".bg-mana-c");
const allBubbles = (page: Page): Locator =>
  scroll(page).locator(".bg-mana-b, .bg-mana-c");
const status = (page: Page): Locator => modal(page).locator("[role='status']");
const closeButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Close AI Judge" });
const chipJudgePlay = (page: Page): Locator =>
  page.getByRole("button", { name: "Judge this play: <current game state>", exact: true });
const chipCardLegality = (page: Page): Locator =>
  page.getByRole("button", { name: "Is <card> legal in Commander?", exact: true });
const chipCombatMath = (page: Page): Locator =>
  page.getByRole("button", { name: "Explain combat damage here.", exact: true });
const chipButtons = (page: Page): Locator[] => [
  chipJudgePlay(page),
  chipCardLegality(page),
  chipCombatMath(page),
];

/* ───────────────────────────────────────────────
 * 1. AI Judge
 * ─────────────────────────────────────────────── */

test.describe("AI Judge", () => {
  test("TC-AJ-01: Modal opens from belt with input + 3 chips", async ({ page }) => {
    // 1. Run open-modal prelude (goto /, open belt, click "AI Judge")
    await openJudgeModal(page);

    // expect: #ai-judge-modal is visible (has open attribute)
    await expect(modal(page)).toHaveAttribute("open", "");
    // expect: dialog has aria-modal="true"
    await expect(modal(page)).toHaveAttribute("aria-modal", "true");

    // 2. Check chat input
    await expect(input(page)).toBeVisible();
    await expect(input(page)).toHaveAttribute(
      "placeholder",
      "Ask about a card or rule…",
    );
    await expect(input(page)).toBeFocused();

    // 3. Check suggestion chips
    await expect(chips(page)).toBeVisible();
    for (const chip of chipButtons(page)) {
      await expect(chip).toBeVisible();
      await expect(chip).toBeEnabled();
      await expect(chip).toHaveCSS("opacity", "1");
    }
  });

  test("TC-AJ-02: Type + Enter sends correct POST; bubbles render; typing indicator", async ({
    page,
  }) => {
    // 1. Mock the judge route: record postDataJSON, sleep 400ms, fulfill FULL fixture
    await mockJudge(page, { ...FIXTURE_FULL, delayMs: 400 });
    await openJudgeModal(page);

    // 2. Type "When can I cast instants?" into INPUT, press Enter
    await sendQuestion(page, "When can I cast instants?");

    // expect: input value becomes "" (cleared after send, §6.4.1)
    await expect(input(page)).toHaveValue("");
    // expect: typing indicator visible while response pending (during 400ms delay)
    await expect(typing(page)).toBeVisible();

    // 3. Wait for response to complete
    await expect(systemBubbles(page)).toHaveText("When you gain life");

    // expect: exactly 1 request captured; question exact; sessionId uuid; no gameContext
    const bodies = await waitForBodies(page, 1);
    expect(bodies[0].question).toBe("When can I cast instants?");
    expect(bodies[0].sessionId).toMatch(UUID_RE);
    expect(bodies[0].gameContext).toBeUndefined();

    // expect: user bubble with question text, colors, right-aligned
    await expect(userBubbles(page)).toHaveText("When can I cast instants?");
    await expect(userBubbles(page)).toHaveCSS("background-color", USER_BG);
    await expect(userBubbles(page)).toHaveCSS("color", USER_TEXT);

    // expect: system bubble with answer text, colors, left-aligned
    await expect(systemBubbles(page)).toHaveText("When you gain life");
    await expect(systemBubbles(page)).toHaveCSS("background-color", SYSTEM_BG);
    await expect(systemBubbles(page)).toHaveCSS("color", SYSTEM_TEXT);

    // expect: user bubble boundingBox.x > system bubble boundingBox.x (right vs left)
    const userX = (await userBubbles(page).boundingBox())?.x ?? 0;
    const systemX = (await systemBubbles(page).boundingBox())?.x ?? 0;
    expect(userX).toBeGreaterThan(systemX);

    // expect: typing indicator gone
    await expect(typing(page)).toHaveCount(0);
    // expect: 3 chips still visible and enabled (persist after send)
    for (const chip of chipButtons(page)) {
      await expect(chip).toBeVisible();
      await expect(chip).toBeEnabled();
    }
    // expect: exactly 1 system bubble with answer text (tokens merged)
    await expect(systemBubbles(page)).toHaveCount(1);
  });

  test("TC-AJ-03: Streaming — tokens accumulate into one system bubble; done finalizes", async ({
    page,
  }) => {
    // 1. Mock the judge route → STREAM_TWO_STAGE fixture
    const errors = errorCollectors(page);
    await mockJudge(page, FIXTURE_TWO_STAGE);
    await openJudgeModal(page);

    // 2. Type "Combat math question" and press Enter
    await sendQuestion(page, "Combat math question");

    // expect: typing indicator visible during initial hold (before first token)
    await expect(typing(page)).toBeVisible();

    // 3+4. Poll bubble text fast (25ms) while tokens stream in — one single
    //     bubble, tokens appended (never multiple answer bubbles)
    const seen: string[] = [];
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const text = await systemBubbles(page).last().textContent();
      if (text !== null) seen.push(text);
      if (text?.includes("forty.")) break;
      await page.waitForTimeout(25);
    }

    // expect: typing indicator gone once streamText non-empty
    await expect(typing(page)).toHaveCount(0);

    // expect: typing window (empty streaming bubble) preceded the first token
    const typingIdx = seen.indexOf("");
    expect(typingIdx).toBeGreaterThanOrEqual(0);
    // expect: first token chunk rendered as exactly "The " (incremental delivery)
    const firstTokenIdx = seen.findIndex((t) => t === "The ");
    expect(firstTokenIdx).toBeGreaterThan(typingIdx);
    // expect: text grows through intermediate states to the full answer
    const finalIdx = seen.findIndex((t) => t.includes("forty."));
    expect(finalIdx).toBeGreaterThan(firstTokenIdx);
    expect(
      seen
        .slice(firstTokenIdx, finalIdx)
        .some(
          (t) => t.length > "The ".length && t.length < "The answer is forty.".length,
        ),
    ).toBe(true);

    // 5. Wait for done + stream end
    // expect: exactly 1 system bubble .bg-mana-b with full text (tokens merged)
    await expect(systemBubbles(page)).toHaveText("The answer is forty.");
    await expect(systemBubbles(page)).toHaveCount(1);
    // expect: input re-enabled (not disabled)
    await expect(input(page)).toBeEnabled();
    // expect: no console errors
    expect(errors.consoleErrors).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });

  test("TC-AJ-04: Error SSE event → error bubble + input re-enabled", async ({ page }) => {
    // 1. Mock the judge route → ERR_429 fixture (200 with error event body)
    await mockJudge(page, FIXTURE_ERR_429);
    await openJudgeModal(page);

    // 2. Type "Is this play legal?" and press Enter
    await sendQuestion(page, "Is this play legal?");
    await expect(userBubbles(page)).toHaveText("Is this play legal?");

    // 3. Wait for error handling
    // expect: error bubble .bg-mana-b with exact text
    await expect(systemBubbles(page)).toHaveText(
      "The AI Judge is busy. Please wait a moment.",
    );
    await expect(systemBubbles(page)).toHaveCSS("background-color", SYSTEM_BG);
    await expect(systemBubbles(page)).toHaveCSS("color", SYSTEM_TEXT);
    // expect: typing indicator gone
    await expect(typing(page)).toHaveCount(0);
    // expect: input enabled (SPEC §9.10 error → re-enable)
    await expect(input(page)).toBeEnabled();
    // expect: chips visible, enabled, opacity "1" (rate_limited does NOT hide chips)
    await expect(chips(page)).toBeVisible();
    for (const chip of chipButtons(page)) {
      await expect(chip).toBeEnabled();
      await expect(chip).toHaveCSS("opacity", "1");
    }
    // expect: no system answer bubble (tokens none) — only the error bubble
    await expect(systemBubbles(page)).toHaveCount(1);
    await expect(systemBubbles(page)).not.toContainText("gain life");
  });

  test("TC-AJ-05: 503 misconfigured (no OpenRouter key) → error bubble + chips hidden", async ({
    page,
  }) => {
    // 1. Mock the judge route → ERR_503 fixture (status 503, SSE error body)
    const errors = errorCollectors(page);
    await mockJudge(page, FIXTURE_ERR_503);
    await openJudgeModal(page);

    // 2. Type "Test question" and press Enter
    await sendQuestion(page, "Test question");

    // expect: request captured with status 503 response
    await waitForBodies(page, 1);
    await expect.poll(() => judgeStatuses(page)).toEqual([503]);

    // 3. Wait for error handling
    // expect: error bubble with exact text (SPEC §9.10)
    await expect(systemBubbles(page)).toHaveText("AI Judge unavailable");
    // expect: chips group NOT visible (SPEC §9.10: misconfigured → chipsHidden)
    await expect(chips(page)).toHaveCount(0);
    // expect: input enabled
    await expect(input(page)).toBeEnabled();
    // expect: typing indicator gone
    await expect(typing(page)).toHaveCount(0);
    // expect: no console errors
    expect(errors.consoleErrors).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });

  test("TC-AJ-06: Input + chips disabled during streaming", async ({ page }) => {
    // 1. Mock the judge route → STREAM_NEVER_ENDS (1 token, stream held open)
    const errors = errorCollectors(page);
    await mockJudge(page, FIXTURE_NEVER_ENDS);
    await openJudgeModal(page);

    // 2. Type "Long question" and press Enter
    await sendQuestion(page, "Long question");

    // expect: user bubble visible, stream bubble with "partial " visible
    await expect(userBubbles(page)).toHaveText("Long question");
    await expect(systemBubbles(page).last()).toHaveText("partial");

    // 3. Assert disabled states while streaming
    // expect: input has disabled attribute
    await expect(input(page)).toBeDisabled();
    // expect: all 3 chips have disabled attribute + opacity "0.25"
    for (const chip of chipButtons(page)) {
      await expect(chip).toBeDisabled();
      await expect(chip).toHaveCSS("opacity", "0.25");
    }
    // expect: chip group still visible
    await expect(chips(page)).toBeVisible();
    // expect: typing another question into input is impossible (disabled)
    await expect(input(page)).toBeDisabled();

    // 4. Cleanup: close modal via CLOSE button
    await closeButton(page).click();
    await expect(modal(page)).not.toBeVisible();
    await page.waitForTimeout(200);
    // expect: no console/page errors
    expect(errors.consoleErrors).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });

  test("TC-AJ-07: Chips — Card legality sends exact prompt; Judge this play sends gameContext", async ({
    page,
  }) => {
    // 1. Mock the judge route → FULL fixture
    await mockJudge(page, FIXTURE_FULL);
    // Seed board state: open belt → "Players" → "2 players" → modal closes
    await page.goto("/");
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(page.locator("#spellbook-toggle")).toBeChecked();
    await page.getByRole("button", { name: "Players", exact: true }).click();
    await page.getByRole("button", { name: "2 players" }).click();
    await expect(page.locator("dialog#player-selector-modal")).not.toBeVisible();
    // close belt
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(page.locator("#spellbook-toggle")).not.toBeChecked();
    // change player 1 life (+1) to force persistence write to IndexedDB; wait ~300ms
    await page
      .getByRole("region", { name: /^Player 1:/ })
      .getByRole("button", { name: "+1 life" })
      .click();
    await expect(
      page.getByRole("region", { name: /^Player 1:/ }).locator('[aria-live="polite"]'),
    ).toHaveText("41");
    await page.waitForTimeout(300);

    // 2. Open judge modal (belt → "AI Judge")
    await reopenJudgeModal(page);
    await expect(modal(page)).toBeVisible();

    // 3. Click chip "Card legality"
    await chipCardLegality(page).click();
    const bodies = await waitForBodies(page, 1);
    // expect: question exact, literal placeholder
    expect(bodies[0].question).toBe("Is <card> legal in Commander?");
    // expect: gameContext undefined (CardLegality sends prompt only)
    expect(bodies[0].gameContext).toBeUndefined();
    // expect: user bubble with that exact question text
    await expect(userBubbles(page)).toHaveText("Is <card> legal in Commander?");

    // 4. Wait for FULL response done
    await expect(systemBubbles(page)).toHaveText("When you gain life");

    // 5. Click chip "Judge this play"
    await chipJudgePlay(page).click();
    const bodiesAfterJudge = await waitForBodies(page, 2);
    const judgeBody = bodiesAfterJudge[1];
    // expect: question starts with "Judge this play: "
    expect(judgeBody.question).toContain("Judge this play: ");
    // expect: gameContext present, format === "commander"
    const ctx = judgeBody.gameContext;
    expect(ctx).toBeDefined();
    expect(ctx?.format).toBe("commander");
    // expect: players length 2, each player has number life, color/counters/commanderDamage arrays
    expect(ctx?.players).toHaveLength(2);
    for (const player of ctx?.players ?? []) {
      expect(typeof player.life).toBe("number");
      expect(Array.isArray(player.color)).toBe(true);
      expect(Array.isArray(player.counters)).toBe(true);
      expect(Array.isArray(player.commanderDamage)).toBe(true);
    }
    // expect: user bubble with the judge-play prompt visible
    await expect(userBubbles(page).last()).toContainText("Judge this play: ");
  });

  test("TC-AJ-08: Offline — exact alert copy, input+chips disabled; online re-enables without reload", async ({
    page,
  }) => {
    // 1. Mock FULL first (addInitScript must precede navigation to take effect),
    //    then goto; attach page.on("load") counter after the initial load.
    await mockJudge(page, FIXTURE_FULL);
    await page.goto("/");
    let loads = 0;
    page.on("load", () => {
      loads++;
    });
    await page.getByLabel("Open Spellbook Menu").click();
    await expect(page.locator("#spellbook-toggle")).toBeChecked();
    await page.getByRole("button", { name: "AI Judge", exact: true }).click();
    await expect(modal(page)).toBeVisible();

    // expect: load counter === 0 (no reloads so far)
    expect(loads).toBe(0);

    // 2. context.setOffline(true)
    await page.context().setOffline(true);

    // expect: status element visible with exact copy
    await expect(status(page)).toBeVisible();
    await expect(status(page)).toHaveText(OFFLINE_COPY);
    // expect: status colors
    await expect(status(page)).toHaveCSS("background-color", SYSTEM_BG);
    await expect(status(page)).toHaveCSS("color", SYSTEM_TEXT);
    // expect: input disabled
    await expect(input(page)).toBeDisabled();
    // expect: all 3 chips disabled + opacity "0.25"
    for (const chip of chipButtons(page)) {
      await expect(chip).toBeDisabled();
      await expect(chip).toHaveCSS("opacity", "0.25");
    }
    // expect: no new page loads
    expect(loads).toBe(0);

    // 3. context.setOffline(false)
    await page.context().setOffline(false);

    // expect: status element not visible
    await expect(status(page)).toHaveCount(0);
    // expect: input enabled
    await expect(input(page)).toBeEnabled();
    // expect: chips enabled, opacity "1"
    for (const chip of chipButtons(page)) {
      await expect(chip).toBeEnabled();
      await expect(chip).toHaveCSS("opacity", "1");
    }
    // expect: no reload happened: URL unchanged, load counter === 0
    expect(page.url()).toBe("http://localhost:3000/");
    expect(loads).toBe(0);

    // 4. Post-online send: type "Back online" + Enter (FULL mock active)
    await sendQuestion(page, "Back online");
    await waitForBodies(page, 1);
    await expect(userBubbles(page)).toHaveText("Back online");
    await expect(systemBubbles(page)).toHaveText("When you gain life");
  });

  test("TC-AJ-09: Offline with history — bubbles stay visible + scrollable, read-only", async ({
    page,
  }) => {
    // 1. Mock the judge route → STREAM_LONG (600 answer chunks then done)
    const errors = errorCollectors(page);
    await mockJudge(page, FIXTURE_LONG);
    await openJudgeModal(page);

    // 2. Type "Long rules question" + Enter; wait for done (input re-enabled)
    await sendQuestion(page, "Long rules question");
    await expect(input(page)).toBeDisabled();
    await expect(input(page)).toBeEnabled();

    // expect: 1 user bubble + 1 system bubble (answer ~3600 chars) visible
    await expect(userBubbles(page)).toHaveCount(1);
    await expect(systemBubbles(page)).toHaveCount(1);
    const answerLength = (await systemBubbles(page).textContent())?.length ?? 0;
    expect(answerLength).toBeGreaterThan(3000);

    // 3. context.setOffline(true)
    await page.context().setOffline(true);

    // expect: offline status alert visible (exact copy)
    await expect(status(page)).toHaveText(OFFLINE_COPY);
    // expect: input disabled, chips disabled + opacity 0.25
    await expect(input(page)).toBeDisabled();
    for (const chip of chipButtons(page)) {
      await expect(chip).toBeDisabled();
      await expect(chip).toHaveCSS("opacity", "0.25");
    }
    // expect: user + system bubbles still visible (count 2, history preserved §6.4.0)
    await expect(userBubbles(page)).toHaveCount(1);
    await expect(systemBubbles(page)).toHaveCount(1);
    await expect(allBubbles(page)).toHaveCount(2);

    // 4. Evaluate SCROLL container
    // expect: scrollHeight > clientHeight (content overflows → scrollable)
    const metrics = await scroll(page).evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    // expect: computed overflow-y is scroll or auto
    const overflowY = await scroll(page).evaluate((el) =>
      getComputedStyle(el).overflowY,
    );
    expect(["scroll", "auto"]).toContain(overflowY);

    // 5. Cleanup: context.setOffline(false), close modal
    await page.context().setOffline(false);
    await closeButton(page).click();
    await expect(modal(page)).not.toBeVisible();
    await page.waitForTimeout(200);
    // expect: no console/page errors
    expect(errors.consoleErrors).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });

  test("TC-AJ-10: Escape closes; re-open = fresh session (new sessionId, empty history)", async ({
    page,
  }) => {
    // 1. Mock the judge route → FULL
    await mockJudge(page, FIXTURE_FULL);
    await openJudgeModal(page);

    // 2. Send "First question" (Enter); wait done; send "Second question"; wait done
    await sendQuestion(page, "First question");
    await expect(systemBubbles(page)).toHaveText("When you gain life");
    await sendQuestion(page, "Second question");
    const firstSessionBodies = await waitForBodies(page, 2);
    await expect(systemBubbles(page).last()).toHaveText("When you gain life");

    // expect: bodies[0].sessionId === bodies[1].sessionId (same open, one session)
    expect(firstSessionBodies[0].sessionId).toMatch(UUID_RE);
    expect(firstSessionBodies[1].sessionId).toMatch(UUID_RE);
    expect(firstSessionBodies[1].sessionId).toBe(firstSessionBodies[0].sessionId);
    // expect: 4 bubbles total (2 user + 2 system)
    await expect(userBubbles(page)).toHaveCount(2);
    await expect(systemBubbles(page)).toHaveCount(2);

    // 3. Press Escape — focus the input first: the send disables the input
    //    during streaming, which blurs it, and DialogShell only closes on
    //    Escape when the keydown originates inside the dialog.
    await input(page).click();
    await page.keyboard.press("Escape");
    await expect(modal(page)).not.toBeVisible();

    // 4. Re-open via belt → "AI Judge"
    await reopenJudgeModal(page);
    await expect(modal(page)).toBeVisible();
    // expect: 0 chat bubbles (history cleared, SPEC §9.9)
    await expect(allBubbles(page)).toHaveCount(0);
    // expect: input empty and enabled
    await expect(input(page)).toHaveValue("");
    await expect(input(page)).toBeEnabled();

    // 5. Send "Third question"; wait done
    await sendQuestion(page, "Third question");
    const allBodies = await waitForBodies(page, 3);
    await expect(systemBubbles(page)).toHaveText("When you gain life");

    // expect: bodies[2].sessionId differs from bodies[0].sessionId (fresh uuid per open)
    expect(allBodies[2].sessionId).toMatch(UUID_RE);
    expect(allBodies[2].sessionId).not.toBe(allBodies[0].sessionId);
    // expect: exactly 1 user bubble + 1 system bubble (no carryover)
    await expect(userBubbles(page)).toHaveCount(1);
    await expect(systemBubbles(page)).toHaveCount(1);
  });

  test("TC-AJ-11: Auto-scroll — long stream pins to bottom", async ({ page }) => {
    // 1. Mock the judge route → STREAM_MANY (300 tokens, 5ms apart, then done)
    await mockJudge(page, FIXTURE_MANY);
    await openJudgeModal(page);

    // 2. Send "Scroll test" + Enter
    await sendQuestion(page, "Scroll test");
    await expect(userBubbles(page)).toHaveText("Scroll test");

    // 3. While streaming (after ~100 tokens): evaluate SCROLL element
    await expect
      .poll(async () => (await systemBubbles(page).last().textContent())?.length ?? 0)
      .toBeGreaterThan(500);

    // expect: scrollTop + clientHeight >= scrollHeight - 2 (pinned to bottom, DESIGN §6.4)
    const pinned = async (): Promise<boolean> => {
      const { scrollTop, clientHeight, scrollHeight } = await scroll(page).evaluate(
        (el) => ({
          scrollTop: el.scrollTop,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
        }),
      );
      return scrollTop + clientHeight >= scrollHeight - 2;
    };
    expect(await pinned()).toBe(true);

    // 4. Wait done; verify tail token arrived (loose — stream timing varies under compile load)
    await expect(systemBubbles(page)).toContainText("token299");

    // expect: still pinned
    expect(await pinned()).toBe(true);
    // expect: single system bubble with full concatenated text (300 tokens)
    await expect(systemBubbles(page)).toHaveCount(1);
  });

  test("TC-AJ-12: Chips a11y — group + full-prompt aria-labels", async ({ page }) => {
    // 1. Open modal (prelude)
    await openJudgeModal(page);

    // expect: group role="group" with aria-label "Suggestions" present in #ai-judge-modal
    await expect(chips(page)).toBeVisible();
    await expect(chips(page)).toHaveAttribute("role", "group");
    await expect(chips(page)).toHaveAttribute("aria-label", "Suggestions");

    // 2. Inspect each chip button — aria-labels are full prompts, not short text
    await expect(chipJudgePlay(page)).toHaveAttribute(
      "aria-label",
      "Judge this play: <current game state>",
    );
    await expect(chipCardLegality(page)).toHaveAttribute(
      "aria-label",
      "Is <card> legal in Commander?",
    );
    await expect(chipCombatMath(page)).toHaveAttribute(
      "aria-label",
      "Explain combat damage here.",
    );

    // 3. Inspect input + close
    await expect(input(page)).toHaveAttribute("aria-label", "Ask about a card or rule");
    await expect(closeButton(page)).toHaveAttribute("aria-label", "Close AI Judge");
  });

  test("TC-AJ-13: Close mid-stream → abort, no crash, clean re-open", async ({ page }) => {
    // 1. Attach pageerror + console-error collectors. Mock STREAM_NEVER_ENDS.
    const errors = errorCollectors(page);
    await mockJudge(page, FIXTURE_NEVER_ENDS);
    await openJudgeModal(page);

    // 2. Send "Abort me" + Enter; wait for stream bubble "partial "
    await sendQuestion(page, "Abort me");
    await expect(userBubbles(page)).toHaveText("Abort me");
    await expect(systemBubbles(page).last()).toHaveText("partial");
    // expect: input disabled while streaming
    await expect(input(page)).toBeDisabled();

    // 3. Click CLOSE button while stream active
    await closeButton(page).click();
    await expect(modal(page)).not.toBeVisible();
    await page.waitForTimeout(200);
    // expect: no pageerror events, no error-level console messages (abort handled, SPEC §9.9)
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);

    // 4. Re-open modal
    await reopenJudgeModal(page);
    await expect(modal(page)).toBeVisible();
    // expect: 0 bubbles (history reset, partial answer dropped)
    await expect(allBubbles(page)).toHaveCount(0);
    // expect: input enabled, chips enabled opacity "1"
    await expect(input(page)).toBeEnabled();
    for (const chip of chipButtons(page)) {
      await expect(chip).toBeEnabled();
      await expect(chip).toHaveCSS("opacity", "1");
    }

    // 5. Send "After abort" (STREAM_NEVER_ENDS still active), then close via
    //    Escape. The stream disables the input → focus blurs to body, so move
    //    focus to a control inside the dialog (✕) for the Escape keydown.
    await sendQuestion(page, "After abort");
    await expect(systemBubbles(page).last()).toHaveText("partial");
    const allBodies = await waitForBodies(page, 2);
    // expect: request captured (new sessionId)
    expect(allBodies[1].sessionId).toMatch(UUID_RE);
    expect(allBodies[1].sessionId).not.toBe(allBodies[0].sessionId);
    await closeButton(page).focus();
    await page.keyboard.press("Escape");
    await expect(modal(page)).not.toBeVisible();
    await page.waitForTimeout(200);
    // expect: no pageerror/console errors
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("TC-AJ-14: A11y smoke — dialog semantics + sr-only title", async ({ page }) => {
    // 1. Open modal (prelude)
    await openJudgeModal(page);

    // expect: #ai-judge-modal has aria-modal="true"
    await expect(modal(page)).toHaveAttribute("aria-modal", "true");
    // expect: #ai-judge-modal has aria-labelledby="ai-judge-title"
    await expect(modal(page)).toHaveAttribute("aria-labelledby", "ai-judge-title");
    // expect: #ai-judge-title attached with text "AI Judge" (sr-only h2)
    await expect(page.locator("#ai-judge-title")).toHaveText("AI Judge");
    // expect: input is focused on open
    await expect(input(page)).toBeFocused();

    // 2. Keyboard: press Escape
    await page.keyboard.press("Escape");
    await expect(modal(page)).not.toBeVisible();
    // expect: re-open works: belt → "AI Judge" → modal visible again
    await reopenJudgeModal(page);
    await expect(modal(page)).toBeVisible();
  });
});
