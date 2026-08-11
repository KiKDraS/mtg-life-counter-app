/**
 * POST /api/judge — AI Judge SSE route (SPEC §9.5, §9.6).
 *
 * Env validation at module load (§9.2) → 503 `misconfigured` on every request
 * when OPENROUTER_API_KEY or OPENROUTER_MODEL is missing/malformed.
 * Rate limit 10 req/min/IP sliding window → 429 `rate_limited`.
 * Multi-model: primary OPENROUTER_MODEL, fallback OPENROUTER_FALLBACK_MODEL
 * on 5xx/timeout/provider error only (never 4xx) (§9.6).
 * AbortController tied to request.signal — client disconnect cancels the
 * OpenRouter stream immediately (§9.5).
 */

import { OpenRouter } from "@openrouter/sdk";
import {
  ConnectionError,
  OpenRouterError,
  RequestTimeoutError,
} from "@openrouter/sdk/models/errors";

import type { JudgeEvent, JudgeRequest, Usage } from "@/features/ai-judge/lib/types";
import type { ChatStreamChunk } from "@openrouter/sdk/models";
import { parseCitations } from "@/features/ai-judge/lib/citations";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/features/ai-judge/lib/prompts";
import { buildMessages } from "@/features/ai-judge/lib/history";
import type { JudgeHistory } from "@/features/ai-judge/lib/history";
import {
  getRulesArtifact,
  getStaleRulesArtifact,
  putRulesArtifact,
} from "@/features/ai-judge/lib/cache";
import { RULES_URL, parseRulesHtml } from "@/features/ai-judge/lib/rag/rules-source";
import { retrieveRules } from "@/features/ai-judge/lib/rag/retrieval";
import type { RetrievedRule } from "@/features/ai-judge/lib/rag/retrieval";
import { extractCardName } from "@/features/ai-judge/lib/rag/cards-source";
import type { CardRuling } from "@/features/ai-judge/lib/rag/cards-source";
import { getRulings, resolveCard } from "@/features/ai-judge/lib/scryfall";

/* ------------------------------------------------------------------ */
/* Env validation — module load (SPEC §9.2)                            */
/* ------------------------------------------------------------------ */

const env = {
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  model: (process.env.OPENROUTER_MODEL ?? "").trim(),
  fallbackModel: (process.env.OPENROUTER_FALLBACK_MODEL ?? "").trim(),
};

/** `vendor/model` format per SPEC §9.2. */
const MODEL_FORMAT_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:\/-]*$/i;

const ENV_OK =
  env.apiKey.length > 0 && MODEL_FORMAT_RE.test(env.model);

// Never constructed/used when ENV_OK is false → no fetch without a key.
const openrouter = new OpenRouter({ apiKey: env.apiKey });

/* ------------------------------------------------------------------ */
/* SSE helpers                                                         */
/* ------------------------------------------------------------------ */

const SSE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

const encoder = new TextEncoder();

const encodeEvent = (event: JudgeEvent): string =>
  `data: ${JSON.stringify(event)}\n\n`;

type ErrorCode = Extract<JudgeEvent, { type: "error" }>["code"];

const errorResponse = (status: number, code: ErrorCode, message: string): Response =>
  new Response(encodeEvent({ type: "error", code, message }), {
    status,
    headers: SSE_HEADERS,
  });

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  bad_request: "Invalid question. Please ask a question between 1 and 500 characters.",
  rate_limited: "The AI Judge is busy. Please wait a moment.",
  misconfigured: "The AI Judge is not configured. Please try again later.",
  model_unavailable: "The AI Judge is temporarily offline. Try again shortly.",
  timeout: "The AI Judge took too long to respond. Please try again.",
};

/* ------------------------------------------------------------------ */
/* Rate limit — 10 req/min/IP sliding window (SPEC §9.5)               */
/* ------------------------------------------------------------------ */

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const ipRequests = new Map<string, number[]>();

/** Sliding window check + record. O(n) per call, n ≤ rate limit. */
function isRateLimited(ip: string): boolean {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  const times = (ipRequests.get(ip) ?? []).filter((t) => t > cutoff);
  if (times.length >= RATE_LIMIT) {
    ipRequests.set(ip, times);
    return true;
  }
  times.push(Date.now());
  ipRequests.set(ip, times);
  return false;
}

const clientIp = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/* ------------------------------------------------------------------ */
/* Session history — in-memory, per IP (SPEC §9.9)                     */
/* ------------------------------------------------------------------ */

const MAX_SESSIONS = 100;

const sessions = new Map<string, JudgeHistory>();

function getSession(ip: string): JudgeHistory {
  let history = sessions.get(ip);
  if (!history) {
    history = { system: SYSTEM_PROMPT, turns: [] };
    sessions.set(ip, history);
    if (sessions.size > MAX_SESSIONS) {
      const oldest = sessions.keys().next().value;
      if (oldest !== undefined) sessions.delete(oldest);
    }
  }
  return history;
}

/* ------------------------------------------------------------------ */
/* Context: Scryfall (best-effort) + rules RAG (degradable)            */
/* ------------------------------------------------------------------ */

const RULES_FETCH_TIMEOUT_MS = 10_000;

interface JudgeContext {
  readonly contextText: string;
  readonly sourcesUsed: string[];
}

/**
 * Build the user-message context (SPEC §9.7): card rulings + top-k rules.
 * Every external dependency is best-effort and null-safe:
 * - Card missing/ambiguous/error → rulings skipped, no error (§9.3.1).
 * - Rules fetch fail → degraded mode, answer on card rulings only (§9.3.2).
 */
async function buildContext(question: string): Promise<JudgeContext> {
  const sourcesUsed: string[] = [];
  const rulings: CardRuling[] = [];

  const cardName = extractCardName(question);
  if (cardName) {
    const card = await resolveCard(cardName);
    if (card) {
      sourcesUsed.push("scryfall");
      const cardRulings = await getRulings(card.id);
      if (cardRulings) {
        for (const ruling of cardRulings) {
          rulings.push({
            name: card.name,
            source: ruling.source,
            published_at: ruling.published_at,
            comment: ruling.comment,
          });
        }
      }
    }
  }

  let rules: RetrievedRule[] = [];
  let rulesSourceOk = false;
  try {
    let artifact = getRulesArtifact();
    if (!artifact) {
      const response = await fetch(RULES_URL, {
        signal: AbortSignal.timeout(RULES_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`mtg.wtf returned ${response.status}`);
      const parsed = parseRulesHtml(await response.text());
      putRulesArtifact(parsed);
      artifact = parsed;
    }
    rules = retrieveRules(question, artifact);
    rulesSourceOk = true;
  } catch (err) {
    // 24h TTL fallback: serve last known artifact; else degraded mode.
    const stale = getStaleRulesArtifact();
    if (stale) {
      rules = retrieveRules(question, stale);
      rulesSourceOk = true;
    } else {
      console.error("Rules fetch failed, degraded mode:", err instanceof Error ? err.message : err);
    }
  }
  if (rulesSourceOk) sourcesUsed.push("mtg.wtf");
  else if (sourcesUsed.length === 0) sourcesUsed.push("scryfall");

  return { contextText: buildUserPrompt(question, rules, rulings), sourcesUsed };
}

/* ------------------------------------------------------------------ */
/* OpenRouter streaming (SPEC §9.5, §9.6)                              */
/* ------------------------------------------------------------------ */

const FIRST_TOKEN_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;

class StreamTimeoutError extends Error {}
class ClientDisconnectedError extends Error {}

interface StreamOutcome {
  readonly content: string;
  readonly usage: Usage;
  readonly model: string;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Runtime guard for the SDK's stream-vs-result union (SPEC §9.5). */
const isAsyncIterable = <T>(value: unknown): value is AsyncIterable<T> =>
  value !== null && typeof value === "object" && Symbol.asyncIterator in value;

/**
 * Stream one model call, emitting tokens. Timeouts: first token 30s, total
 * 120s (SPEC §9.5). AbortController tied to request.signal — client
 * disconnect cancels the upstream stream immediately.
 *
 * Throws: StreamTimeoutError, ClientDisconnectedError, OpenRouterError,
 * RequestTimeoutError, ConnectionError.
 */
async function streamFromModel(
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  clientSignal: AbortSignal,
  onToken: (token: string) => void,
): Promise<StreamOutcome> {
  const controller = new AbortController();
  let timedOut = false;
  let clientAborted = false;

  const onClientAbort = (): void => {
    clientAborted = true;
    controller.abort();
  };
  clientSignal.addEventListener("abort", onClientAbort, { once: true });
  const totalTimer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TOTAL_TIMEOUT_MS);

  try {
    const result = await openrouter.chat.send(
      {
        chatRequest: {
          model,
          messages,
          stream: true,
          streamOptions: { includeUsage: true },
          provider: { zdr: true, sort: "price" },
        },
      },
      { signal: controller.signal },
    );
    if (!isAsyncIterable<ChatStreamChunk>(result)) {
      throw new Error("unexpected non-stream response");
    }
    const stream = result;

    let content = "";
    let usage: Usage = { inputTokens: 0, outputTokens: 0, cost: 0 };
    let servedModel = model;

    const iterator = stream[Symbol.asyncIterator]();
    type FirstChunk = Awaited<ReturnType<typeof iterator.next>> | null;
    const first = await Promise.race<FirstChunk>([
      iterator.next(),
      sleep(FIRST_TOKEN_TIMEOUT_MS).then(() => null),
    ]);
    if (first === null) {
      timedOut = true;
      controller.abort();
      throw new StreamTimeoutError("first token timeout");
    }

    let current = first;
    while (!current.done) {
      const chunk = current.value;
      if (chunk.error) throw new Error(chunk.error.message || "provider stream error");
      servedModel = chunk.model || servedModel;
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        content += token;
        onToken(token);
      }
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.promptTokens,
          outputTokens: chunk.usage.completionTokens,
          cost: chunk.usage.cost ?? 0,
        };
      }
      current = await iterator.next();
    }
    return { content, usage, model: servedModel };
  } catch (err) {
    if (clientAborted) throw new ClientDisconnectedError();
    if (timedOut) throw new StreamTimeoutError("total timeout");
    throw err;
  } finally {
    clearTimeout(totalTimer);
    clientSignal.removeEventListener("abort", onClientAbort);
  }
}

type FailureKind = "timeout" | "retryable" | "permanent";

/** Classify a model failure for fallback routing (SPEC §9.6). */
const failureKind = (err: unknown): FailureKind => {
  if (err instanceof StreamTimeoutError) return "timeout";
  if (err instanceof OpenRouterError) return err.statusCode >= 500 ? "retryable" : "permanent";
  if (err instanceof RequestTimeoutError || err instanceof ConnectionError) return "retryable";
  return "retryable";
};

/* ------------------------------------------------------------------ */
/* POST handler                                                        */
/* ------------------------------------------------------------------ */

export async function POST(request: Request): Promise<Response> {
  if (!ENV_OK) {
    return errorResponse(503, "misconfigured", ERROR_MESSAGES.misconfigured);
  }

  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return errorResponse(429, "rate_limited", ERROR_MESSAGES.rate_limited);
  }

  let body: JudgeRequest;
  try {
    body = (await request.json()) as JudgeRequest;
  } catch {
    return errorResponse(400, "bad_request", ERROR_MESSAGES.bad_request);
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 1 || question.length > 500) {
    return errorResponse(400, "bad_request", ERROR_MESSAGES.bad_request);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: JudgeEvent): void => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      try {
        const { contextText, sourcesUsed } = await buildContext(question);
        const history = getSession(ip);
        const messages = buildMessages(history, question, contextText);

        let outcome: StreamOutcome | null = null;
        let lastKind: FailureKind = "retryable";
        let streamedAnyToken = false;
        const onToken = (token: string): void => {
          streamedAnyToken = true;
          enqueue({ type: "token", content: token });
        };

        try {
          outcome = await streamFromModel(env.model, messages, request.signal, onToken);
        } catch (err) {
          if (err instanceof ClientDisconnectedError) return;
          lastKind = failureKind(err);
          console.error("AI Judge primary model failed:", err instanceof Error ? err.message : err);

          if (streamedAnyToken) {
            // Partial answer already sent — a fallback retry cannot be spliced in cleanly.
            enqueue({ type: "error", code: "model_unavailable", message: ERROR_MESSAGES.model_unavailable });
            return;
          }
          if (lastKind !== "permanent" && env.fallbackModel) {
            try {
              outcome = await streamFromModel(env.fallbackModel, messages, request.signal, onToken);
            } catch (fallbackErr) {
              if (fallbackErr instanceof ClientDisconnectedError) return;
              lastKind = failureKind(fallbackErr);
              console.error("AI Judge fallback model failed:", fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
            }
          }
        }

        if (outcome === null) {
          const code = lastKind === "timeout" ? "timeout" : "model_unavailable";
          enqueue({ type: "error", code, message: ERROR_MESSAGES[code] });
          return;
        }

        const citations = parseCitations(outcome.content);
        history.turns.push({ user: question, assistant: outcome.content });
        enqueue({
          type: "done",
          citations,
          usage: outcome.usage,
          model: outcome.model,
          sourcesUsed,
        });
      } catch (err) {
        console.error("AI Judge route error:", err);
        enqueue({ type: "error", code: "model_unavailable", message: ERROR_MESSAGES.model_unavailable });
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
