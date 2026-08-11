/**
 * OpenRouter model streaming for the AI Judge (SPEC §9.5, §9.6).
 *
 * `streamFromModel` streams one model call (first-token 30s, total 120s
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

/** Client disconnected mid-stream — abort, emit nothing. */
export class ClientDisconnectedError extends Error {}

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
export const failureKind = (err: unknown): FailureKind => {
  if (err instanceof StreamTimeoutError) return "timeout";
  if (err instanceof OpenRouterError)
    return err.statusCode >= 500 ? "retryable" : "permanent";
  if (err instanceof RequestTimeoutError || err instanceof ConnectionError)
    return "retryable";
  return "retryable";
};

/**
 * @description Stream one model call, emitting tokens. Timeouts: first token
 * 30s, total 120s (SPEC §9.5). AbortController tied to `clientSignal` — client
 * disconnect cancels the upstream stream immediately.
 * @param model Model id to call (e.g. `anthropic/claude-sonnet-4`).
 * @param messages System + history + context user messages.
 * @param clientSignal Request abort signal — abort cancels the stream.
 * @param onToken Callback per token delta (called in arrival order).
 * @returns The completed outcome (content, usage, served model).
 * @throws StreamTimeoutError, ClientDisconnectedError, OpenRouterError,
 * RequestTimeoutError, ConnectionError.
 */
export async function streamFromModel(
  model: string,
  messages: JudgeMessages,
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
    if (!isAsyncIterable<ChatStreamChunk>(result)) {
      throw new Error("unexpected non-stream response");
    }
    const stream = result;

    let content = "";
    let usage: Usage = { inputTokens: 0, outputTokens: 0, cost: 0 };
    let servedModel = model;

    const iterator = stream[Symbol.asyncIterator]();
    type FirstChunk = Awaited<ReturnType<typeof iterator.next>> | null;
    const firstPromise = iterator.next();
    const first = await Promise.race<FirstChunk>([
      firstPromise,
      sleep(FIRST_TOKEN_TIMEOUT_MS).then(() => null),
    ]);
    if (first === null) {
      // Timeout loser: the pending next() rejects when the stream aborts —
      // swallow so the SDK rejection can't surface as an unhandled rejection.
      firstPromise.catch(() => {});
      timedOut = true;
      controller.abort();
      throw new StreamTimeoutError("first token timeout");
    }

    let current = first;
    while (!current.done) {
      const chunk = current.value;
      if (chunk.error)
        throw new Error(chunk.error.message || "provider stream error");
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
  let outcome: StreamOutcome | null = null;
  let lastKind: FailureKind = "retryable";
  let streamedAnyToken = false;
  const trackToken = (token: string): void => {
    streamedAnyToken = true;
    onToken(token);
  };

  try {
    outcome = await streamFromModel(primaryModel, messages, clientSignal, trackToken);
  } catch (err) {
    if (err instanceof ClientDisconnectedError) {
      return { kind: "client_disconnected" };
    }
    lastKind = failureKind(err);
    console.error(
      "AI Judge primary model failed:",
      err instanceof Error ? err.message : err,
    );
    if (streamedAnyToken) {
      // Partial answer already sent — a fallback retry cannot be spliced in cleanly.
      return { kind: "mid_stream_failure" };
    }
    if (lastKind !== "permanent" && fallbackModel) {
      try {
        outcome = await streamFromModel(fallbackModel, messages, clientSignal, trackToken);
      } catch (fallbackErr) {
        if (fallbackErr instanceof ClientDisconnectedError) {
          return { kind: "client_disconnected" };
        }
        lastKind = failureKind(fallbackErr);
        console.error(
          "AI Judge fallback model failed:",
          fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
        );
      }
    }
  }

  if (outcome === null) return { kind: "failed", failure: lastKind };
  logUsage(outcome);
  return { kind: "done", outcome };
}
