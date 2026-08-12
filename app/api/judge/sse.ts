/**
 * SSE helpers for the AI Judge route (SPEC §9.5).
 *
 * Shared wire format: every response is `text/event-stream` carrying a single
 * `data:` line per `JudgeEvent`. Errors are SSE bodies with a status code.
 */

import type { JudgeEvent } from "@/features/ai-judge/lib/types";

/** SSE response headers — streaming, no buffering, no caching. */
export const SSE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/** Error codes carried by `{type:"error"}` events (SPEC §9.5). */
export type ErrorCode = Extract<JudgeEvent, { type: "error" }>["code"];

/** Client-facing error messages per code (SPEC §9.5). */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  bad_request:
    "Invalid question. Please ask a question between 1 and 500 characters.",
  rate_limited: "The AI Judge is busy. Please wait a moment.",
  misconfigured: "The AI Judge is not configured. Please try again later.",
  model_unavailable: "The AI Judge is temporarily offline. Try again shortly.",
  timeout: "The AI Judge took too long to respond. Please try again.",
};

/**
 * @description Serialize a JudgeEvent as one SSE `data:` frame.
 * @param event The event to serialize.
 * @returns The `data: <json>\n\n` string to write to the stream.
 */
export const encodeEvent = (event: JudgeEvent): string =>
  `data: ${JSON.stringify(event)}\n\n`;

/**
 * @description Build a full SSE error response (status + SSE error body).
 * @param status HTTP status to return (e.g. 400, 429, 503).
 * @param code Error code for the SSE body (SPEC §9.5).
 * @param message Client-facing error message.
 * @returns A Response with SSE_HEADERS and the error event body.
 */
export const errorResponse = (
  status: number,
  code: ErrorCode,
  message: string,
): Response =>
  new Response(encodeEvent({ type: "error", code, message }), {
    status,
    headers: SSE_HEADERS,
  });
