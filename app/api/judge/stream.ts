/**
 * OpenRouter model streaming for the AI Judge (SPEC §9.5, §9.6).
 *
 * `runModelAttempt` streams one model call (first-token 30s, total 120s
 * timeouts; abort tied to the client signal). `streamWithFallback` adds the
 * multi-model routing: fallback on 5xx/timeout/provider error, never 4xx.
 * Usage + cost extracted from the stream and logged per request.
 */

import { openRouter } from "./config";
import {
  ConnectionError,
  OpenRouterError,
  RequestTimeoutError,
} from "@openrouter/sdk/models/errors";
import type { ChatStreamChunk } from "@openrouter/sdk/models";
import type { Usage } from "@/features/ai-judge/lib/types";

const FIRST_TOKEN_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;

/** First-token or total-time budget exceeded (SPEC §9.5). */
export class StreamTimeoutError extends Error {}

/** One completed model call: full text, token usage, served model. */
export interface StreamOutcome {
  readonly content: string;
  readonly usage: Usage;
  readonly model: string;
}

/** Messages array shape the SDK accepts (buildMessages output). */
type JudgeMessages = Array<{
  role: "system" | "user" | "assistant";
  content: string;
}>;

/** Fallback routing classification (SPEC §9.6). */
export type FailureKind = "timeout" | "retryable" | "permanent";

/** One model attempt outcome (SPEC §9.5, §9.6). */
export type AttemptResult =
  | { readonly kind: "success"; readonly outcome: StreamOutcome }
  | { readonly kind: "client_disconnected" }
  | { readonly kind: "failed"; readonly failure: FailureKind; readonly error: unknown };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Runtime guard for the SDK's stream-vs-result union (SPEC §9.5). */
export const isAsyncIterable = <T>(value: unknown): value is AsyncIterable<T> =>
  value !== null && typeof value === "object" && Symbol.asyncIterator in value;

/**
 * @description Classify a model failure for fallback routing (SPEC §9.6):
 * timeout → "timeout"; 4xx → "permanent" (no fallback); 5xx, request timeout,
 * connection error, anything else → "retryable".
 * @param err The thrown error from a model call.
 * @returns The FailureKind for the error.
 */
export const classifyFailure = (err: unknown): FailureKind => {
  if (err instanceof StreamTimeoutError) return "timeout";
  if (err instanceof OpenRouterError)
    return err.statusCode >= 500 ? "retryable" : "permanent";
  if (err instanceof RequestTimeoutError || err instanceof ConnectionError)
    return "retryable";
  return "retryable";
};

/**
 * @description Pump the SDK chunk iterator (SPEC §9.5): concat token deltas
 * (emitting each via `onToken`), track served model + usage. Throws on
 * provider error chunks; abort surfaces as an iterator rejection.
 * @param iterator The chunk iterator (first chunk consumed by the first-token
 * race in {@link runModelAttempt}).
 * @param first The first `next()` result from the race.
 * @param model Model id for the attempt (initial served model).
 * @param onToken Callback per token delta (called in arrival order).
 * @returns The completed outcome (content, usage, served model).
 * @throws Error on provider stream error chunk or stream abort.
 */
async function pumpTokens(
  iterator: AsyncIterator<ChatStreamChunk>,
  first: IteratorResult<ChatStreamChunk>,
  model: string,
  onToken: (token: string) => void,
): Promise<StreamOutcome> {
  let content = "";
  let usage: Usage = { inputTokens: 0, outputTokens: 0, cost: 0 };
  let servedModel = model;
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
}

/**
 * @description Stream one model call (SPEC §9.5). Timeouts: first token 30s,
 * total 120s. AbortController tied to `clientSignal` — client disconnect
 * cancels the upstream stream immediately.
 * @param model Model id to call (e.g. `anthropic/claude-sonnet-4`).
 * @param messages System + history + context user messages.
 * @param clientSignal Request abort signal — abort cancels the stream.
 * @param onToken Callback per token delta (called in arrival order).
 * @returns success (content, usage, served model), client_disconnected, or
 * failed with the classified FailureKind + original error.
 */
export async function runModelAttempt(
  model: string,
  messages: JudgeMessages,
  clientSignal: AbortSignal,
  onToken: (token: string) => void,
): Promise<AttemptResult> {
  const controller = new AbortController();
  const onClientAbort = (): void => controller.abort();
  clientSignal.addEventListener("abort", onClientAbort, { once: true });
  const totalTimer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);

  try {
    const result = await openRouter.chat.send(
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
    if (!isAsyncIterable<ChatStreamChunk>(result)) throw new Error("unexpected non-stream response");

    const iterator = result[Symbol.asyncIterator]();
    const firstPromise = iterator.next();
    const first = await Promise.race([
      firstPromise,
      sleep(FIRST_TOKEN_TIMEOUT_MS).then(() => null),
    ]);
    if (first === null) {
      firstPromise.catch(() => {});
      controller.abort();
      throw new StreamTimeoutError("first token timeout");
    }
    return { kind: "success", outcome: await pumpTokens(iterator, first, model, onToken) };
  } catch (err) {
    if (clientSignal.aborted) return { kind: "client_disconnected" };
    if (controller.signal.aborted) return { kind: "failed", failure: "timeout", error: err };
    return { kind: "failed", failure: classifyFailure(err), error: err };
  } finally {
    clearTimeout(totalTimer);
    clientSignal.removeEventListener("abort", onClientAbort);
  }
}

/** Outcome of a routed model attempt with fallback (SPEC §9.6). */
export type StreamWithFallbackResult =
  | { readonly kind: "done"; readonly outcome: StreamOutcome }
  | { readonly kind: "client_disconnected" }
  | { readonly kind: "mid_stream_failure" }
  | { readonly kind: "failed"; readonly failure: FailureKind };

/** SPEC §9.6 — usage + cost logged per request. Never logs key/question. */
const logUsage = (outcome: StreamOutcome): void => {
  console.log(
    "[ai-judge] usage",
    JSON.stringify({
      model: outcome.model,
      inputTokens: outcome.usage.inputTokens,
      outputTokens: outcome.usage.outputTokens,
      cost: outcome.usage.cost,
    }),
  );
};

/** Log usage + wrap a successful attempt as the routed result. */
const done = (outcome: StreamOutcome): StreamWithFallbackResult => {
  logUsage(outcome);
  return { kind: "done", outcome };
};

/** SPEC §9.6 — model failure log (message only, never key/question). */
const logAttemptError = (
  label: string,
  attempt: { readonly failure: FailureKind; readonly error: unknown },
): void => {
  console.error(
    `AI Judge ${label} model failed:`,
    attempt.error instanceof Error ? attempt.error.message : attempt.error,
  );
};

/** Run the fallback model after a retryable primary failure (SPEC §9.6). */
async function runFallback(
  fallbackModel: string,
  messages: JudgeMessages,
  clientSignal: AbortSignal,
  onToken: (token: string) => void,
): Promise<StreamWithFallbackResult> {
  const attempt = await runModelAttempt(fallbackModel, messages, clientSignal, onToken);
  if (attempt.kind === "success") return done(attempt.outcome);
  if (attempt.kind === "client_disconnected") return { kind: "client_disconnected" };
  logAttemptError("fallback", attempt);
  return { kind: "failed", failure: attempt.failure };
}

/**
 * @description Route one answer through primary + fallback models (SPEC
 * §9.6). Fallback on 5xx/timeout/provider error only (never 4xx). Tokens
 * already sent before a failure → "mid_stream_failure" (a retry cannot be
 * spliced in cleanly); both models failed with no tokens → "failed" with the
 * last failure kind; client disconnect → "client_disconnected".
 * @param primaryModel Primary model id (OPEN_ROUTER_MODEL).
 * @param fallbackModel Fallback model id or null when unset.
 * @param messages System + history + context user messages.
 * @param clientSignal Request abort signal.
 * @param onToken Callback per token delta (called in arrival order).
 * @returns The routed result: done outcome, client_disconnected,
 * mid_stream_failure, or failed with the last failure kind.
 */
export async function streamWithFallback(
  primaryModel: string,
  fallbackModel: string | null,
  messages: JudgeMessages,
  clientSignal: AbortSignal,
  onToken: (token: string) => void,
): Promise<StreamWithFallbackResult> {
  let streamedAnyToken = false;
  const trackToken = (token: string): void => {
    streamedAnyToken = true;
    onToken(token);
  };

  const primary = await runModelAttempt(primaryModel, messages, clientSignal, trackToken);
  if (primary.kind === "success") return done(primary.outcome);
  if (primary.kind === "client_disconnected") return { kind: "client_disconnected" };
  logAttemptError("primary", primary);
  if (streamedAnyToken) return { kind: "mid_stream_failure" };
  if (primary.failure === "permanent" || !fallbackModel) return { kind: "failed", failure: primary.failure };
  return runFallback(fallbackModel, messages, clientSignal, trackToken);
}
