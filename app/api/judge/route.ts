/**
 * POST /api/judge — AI Judge SSE route (SPEC §9.5, §9.6).
 * Thin orchestration shell: env guard, rate limit, body validation, SSE wiring,
 * token streaming, abort on client disconnect. Logic in ./config ./rate-limit
 * ./sessions ./sse ./context ./stream. See SPEC.md §9.
 */

import { ENV_OK, models } from "./config";
import { isRateLimited, clientIp } from "./rate-limit";
import { SSE_HEADERS, encodeEvent, errorResponse, ERROR_MESSAGES } from "./sse";
import { sessionKey, getSession } from "./sessions";
import { buildContext } from "./context";
import { streamWithFallback } from "./stream";
import { sendTiming } from "./telemetry";
import { buildMessages } from "@/features/ai-judge/lib/history";
import { parseCitations } from "@/features/ai-judge/lib/citations";
import type { JudgeEvent, JudgeRequest, JudgeTimings, Usage } from "@/features/ai-judge/lib/types";
import { after } from "next/server";

const encoder = new TextEncoder();

/** Fire telemetry after the response flushes (SPEC §9.5). Unknown → 0. */
const fireTelemetry = (
  timings: JudgeTimings,
  model: string,
  usage?: Usage,
  error?: string,
): void => {
  after(() => {
    sendTiming({
      model,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      cost: usage?.cost ?? 0,
      ...(error ? { error } : {}),
      timings,
    });
  });
};

export async function POST(request: Request): Promise<Response> {
  const t0 = performance.now();
  if (!ENV_OK) return errorResponse(503, "misconfigured", ERROR_MESSAGES.misconfigured);

  const ip = clientIp(request);
  if (isRateLimited(ip)) return errorResponse(429, "rate_limited", ERROR_MESSAGES.rate_limited);

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
      let contextMs = 0;
      let contextTimings = { scryfallMs: 0, rulesMs: 0 };
      let firstTokenAt = t0;
      let firstCharAt = t0;
      const knownTimings = (): JudgeTimings => ({
        contextMs,
        scryfallMs: contextTimings.scryfallMs,
        rulesMs: contextTimings.rulesMs,
        firstTokenMs: Math.round(firstTokenAt - t0),
        firstCharMs: Math.round(firstCharAt - t0),
        totalMs: Math.round(performance.now() - t0),
      });
      try {
        const { contextText, sourcesUsed, timings: buildTimings } = await buildContext(question);
        contextMs = Math.round(performance.now() - t0);
        contextTimings = buildTimings;
        const history = getSession(sessionKey(body.sessionId, ip));
        const messages = buildMessages(history, question, contextText);
        const onToken = (token: string): void =>
          enqueue({ type: "token", content: token });
        const result = await streamWithFallback(
          models,
          messages,
          request.signal,
          onToken,
          (phase, atMs) => {
            if (phase === "first_token") firstTokenAt = atMs;
            else firstCharAt = atMs;
          },
        );

        if (result.kind === "client_disconnected") return;
        if (result.kind === "mid_stream_failure") {
          enqueue({ type: "error", code: "model_unavailable", message: ERROR_MESSAGES.model_unavailable });
          fireTelemetry(knownTimings(), models[0], undefined, "model_unavailable");
          return;
        }
        if (result.kind === "failed") {
          const code = result.failure === "timeout" ? "timeout" : "model_unavailable";
          enqueue({ type: "error", code, message: ERROR_MESSAGES[code] });
          fireTelemetry(knownTimings(), models[0], undefined, code);
          return;
        }

        const citations = parseCitations(result.outcome.content);
        history.turns.push({ user: question, assistant: result.outcome.content });
        const totalMs = Math.round(performance.now() - t0);
        const timings: JudgeTimings = {
          contextMs,
          scryfallMs: contextTimings.scryfallMs,
          rulesMs: contextTimings.rulesMs,
          firstTokenMs: Math.round(firstTokenAt - t0),
          firstCharMs: Math.round(firstCharAt - t0),
          totalMs,
        };
        enqueue({ type: "done", citations, usage: result.outcome.usage, model: result.outcome.model, sourcesUsed, timings });
        console.log("[ai-judge] timing", JSON.stringify({ ...timings, model: result.outcome.model, inputTokens: result.outcome.usage.inputTokens, outputTokens: result.outcome.usage.outputTokens }));
        fireTelemetry(timings, result.outcome.model, result.outcome.usage);
      } catch (err) {
        console.error("AI Judge route error:", err);
        enqueue({ type: "error", code: "model_unavailable", message: ERROR_MESSAGES.model_unavailable });
        fireTelemetry(knownTimings(), models[0], undefined, "model_unavailable");
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
