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
import { buildMessages } from "@/features/ai-judge/lib/history";
import { parseCitations } from "@/features/ai-judge/lib/citations";
import type { JudgeEvent, JudgeRequest } from "@/features/ai-judge/lib/types";

const encoder = new TextEncoder();

export async function POST(request: Request): Promise<Response> {
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
      try {
        const { contextText, sourcesUsed } = await buildContext(question);
        const history = getSession(sessionKey(body.sessionId, ip));
        const messages = buildMessages(history, question, contextText);
        const onToken = (token: string): void =>
          enqueue({ type: "token", content: token });
        const result = await streamWithFallback(
          models,
          messages,
          request.signal,
          onToken,
        );

        if (result.kind === "client_disconnected") return;
        if (result.kind === "mid_stream_failure") {
          enqueue({ type: "error", code: "model_unavailable", message: ERROR_MESSAGES.model_unavailable });
          return;
        }
        if (result.kind === "failed") {
          const code = result.failure === "timeout" ? "timeout" : "model_unavailable";
          enqueue({ type: "error", code, message: ERROR_MESSAGES[code] });
          return;
        }

        const citations = parseCitations(result.outcome.content);
        history.turns.push({ user: question, assistant: result.outcome.content });
        enqueue({ type: "done", citations, usage: result.outcome.usage, model: result.outcome.model, sourcesUsed });
      } catch (err) {
        console.error("AI Judge route error:", err);
        enqueue({ type: "error", code: "model_unavailable", message: ERROR_MESSAGES.model_unavailable });
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
