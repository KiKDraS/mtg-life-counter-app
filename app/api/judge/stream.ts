/**
 * OpenRouter model streaming for the AI Judge (SPEC §9.5, §9.6).
 *
 * One `chat.send` per answer with the full model list — the SDK/API performs
 * multi-model auto-fallback internally (5xx/timeout/provider overload, never
 * 4xx). First-token 30s + total 120s timeouts; abort tied to the client
 * signal. Usage + cost extracted from the stream and logged per request.
 */

import { AnswerExtractor } from "./answer-extract";
import { openRouter, zdrEnabled } from "./config";
import {
  ConnectionError,
  EdgeNetworkTimeoutResponseError,
  OpenRouterError,
  ProviderOverloadedResponseError,
  RequestTimeoutError,
  RequestTimeoutResponseError,
  ResponseValidationError,
  SDKValidationError,
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

/** Failure classification for the route's error event mapping (SPEC §9.6). */
export type FailureKind = "timeout" | "retryable" | "permanent";

/** One model call outcome (SPEC §9.5, §9.6). */
export type AttemptResult =
  | { readonly kind: "success"; readonly outcome: StreamOutcome }
  | { readonly kind: "client_disconnected" }
  | { readonly kind: "failed"; readonly failure: FailureKind; readonly error: unknown };

/** Outcome of a routed model call with SDK auto-fallback (SPEC §9.6). */
export type StreamWithFallbackResult =
  | { readonly kind: "done"; readonly outcome: StreamOutcome }
  | { readonly kind: "client_disconnected" }
  | { readonly kind: "mid_stream_failure" }
  | { readonly kind: "failed"; readonly failure: FailureKind };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Runtime guard for the SDK's stream-vs-result union (SPEC §9.5). */
export const isAsyncIterable = <T>(value: unknown): value is AsyncIterable<T> =>
  value !== null && typeof value === "object" && Symbol.asyncIterator in value;

/** SDK error class in the {@link classifyFailure} tables. */
type ErrorClass = new (...args: never[]) => Error;

/** Retryable: provider-side timeout/overload or connection loss (SPEC §9.6). */
const RETRYABLE_ERRORS: readonly ErrorClass[] = [
  RequestTimeoutResponseError,
  EdgeNetworkTimeoutResponseError,
  ProviderOverloadedResponseError,
  ConnectionError,
];

/** Permanent: malformed request/output — retrying reproduces the failure. */
const PERMANENT_ERRORS: readonly ErrorClass[] = [
  SDKValidationError,
  ResponseValidationError,
];

/**
 * @description Classify a model failure (SPEC §9.6): first-token or total
 * timeout → "timeout"; 4xx → "permanent" (no fallback); 5xx, provider
 * timeout/overload, connection error, anything else → "retryable" (SDK
 * auto-fallback covers it). SDK validation errors → "permanent".
 * @param err The thrown error from the model call.
 * @returns The FailureKind for the error.
 */
export const classifyFailure = (err: unknown): FailureKind => {
  if (err instanceof StreamTimeoutError || err instanceof RequestTimeoutError) return "timeout";
  if (RETRYABLE_ERRORS.some((Ctor) => err instanceof Ctor)) return "retryable";
  if (PERMANENT_ERRORS.some((Ctor) => err instanceof Ctor)) return "permanent";
  if (err instanceof OpenRouterError)
    return err.statusCode >= 500 ? "retryable" : "permanent";
  return "retryable";
};

/**
 * @description Apply one chunk's token delta (SPEC §9.5): accumulate raw JSON
 * into `content` (downstream citation parse) while emitting only the extracted
 * `answer` characters via `onToken`. No `answer` value after the fallback
 * thresholds → raw mode: emit the model output as-is (degraded path).
 * @param chunk The stream chunk.
 * @param content Raw JSON text accumulated so far.
 * @param extractor Incremental answer extractor (per-pump instance).
 * @param rawMode True once fallback raw streaming is active.
 * @param onToken Callback per emitted char group.
 * @returns The new raw content.
 */
const applyToken = (
  chunk: ChatStreamChunk,
  content: string,
  extractor: AnswerExtractor,
  rawMode: boolean,
  onToken: (token: string) => void,
): { readonly content: string; readonly rawMode: boolean } => {
  const token = chunk.choices[0]?.delta?.content;
  if (!token) return { content, rawMode };
  const next = content + token;
  if (rawMode) {
    onToken(token);
    return { content: next, rawMode };
  }
  const extracted = extractor.push(token);
  if (extracted) {
    onToken(extracted);
    return { content: next, rawMode };
  }
  if (extractor.shouldFallback()) {
    onToken(extractor.flushRaw());
    return { content: next, rawMode: true };
  }
  return { content: next, rawMode };
};

/** Chunk usage → our Usage shape, or the current usage when absent. */
const applyUsage = (chunk: ChatStreamChunk, usage: Usage): Usage => {
  if (!chunk.usage) return usage;
  return {
    inputTokens: chunk.usage.promptTokens,
    outputTokens: chunk.usage.completionTokens,
    cost: chunk.usage.cost ?? 0,
  };
};

/**
 * @description Pump the SDK chunk iterator (SPEC §9.5): concat raw token
 * deltas (full JSON kept for citation parse), emit only the extracted `answer`
 * characters via `onToken` (fallback: raw text when no `answer` key appears —
 * degraded mode), track served model + usage. Throws on provider error
 * chunks; abort surfaces as an iterator rejection.
 * @param iterator The chunk iterator (first chunk consumed by the first-token
 * race in {@link streamWithFallback}).
 * @param first The first `next()` result from the race.
 * @param model Initial served model id (primary; chunk.model wins when set).
 * @param onToken Callback per emitted answer-text group (arrival order).
 * @returns The completed outcome (full raw content, usage, served model).
 * @throws Error on provider stream error chunk or stream abort.
 */
async function pumpTokens(
  iterator: AsyncIterator<ChatStreamChunk>,
  first: IteratorResult<ChatStreamChunk>,
  model: string,
  onToken: (token: string) => void,
): Promise<StreamOutcome> {
  let content = "";
  let rawMode = false;
  const extractor = new AnswerExtractor();
  let usage: Usage = { inputTokens: 0, outputTokens: 0, cost: 0 };
  let servedModel = model;
  let current = first;
  while (!current.done) {
    const chunk = current.value;
    if (chunk.error) throw new Error(chunk.error.message || "provider stream error");
    servedModel = chunk.model || servedModel;
    ({ content, rawMode } = applyToken(chunk, content, extractor, rawMode, onToken));
    usage = applyUsage(chunk, usage);
    current = await iterator.next();
  }
  return { content, usage, model: servedModel };
}

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

/** SPEC §9.6 — model failure log (message only, never key/question). */
const logFailure = (failure: FailureKind, err: unknown): void => {
  console.error(
    `AI Judge model failed (${failure}):`,
    err instanceof Error ? err.message : err,
  );
};

/**
 * @description Stream one answer (SPEC §9.5, §9.6): a single `chat.send` with
 * the full model list — the SDK/API auto-falls back across models on
 * 5xx/timeout/provider overload, never 4xx. First token 30s, total 120s
 * (`timeoutMs`), abort tied to `clientSignal`. Tokens already sent before a
 * failure → "mid_stream_failure" (a fallback cannot be spliced in cleanly);
 * client disconnect → "client_disconnected"; otherwise "failed" with the
 * classified failure kind.
 * @param models Model ids in preference order (primary first).
 * @param messages System + history + context user messages.
 * @param clientSignal Request abort signal — abort cancels the stream.
 * @param onToken Callback per emitted answer-text group (arrival order;
 * raw JSON fallback text if the model skips the JSON schema).
 * @returns The routed result: done outcome, client_disconnected,
 * mid_stream_failure, or failed with the classified failure kind.
 */
export async function streamWithFallback(
  models: readonly string[],
  messages: JudgeMessages,
  clientSignal: AbortSignal,
  onToken: (token: string) => void,
): Promise<StreamWithFallbackResult> {
  let streamedAnyToken = false;
  const trackToken = (token: string): void => {
    streamedAnyToken = true;
    onToken(token);
  };

  try {
    const result = await openRouter.chat.send(
      {
        chatRequest: {
          models: [...models],
          messages,
          stream: true,
          streamOptions: { includeUsage: true },
          provider: { zdr: zdrEnabled },
        },
      },
      { timeoutMs: TOTAL_TIMEOUT_MS, signal: clientSignal },
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
      throw new StreamTimeoutError("first token timeout");
    }
    const outcome = await pumpTokens(iterator, first, models[0] ?? "", trackToken);
    logUsage(outcome);
    return { kind: "done", outcome };
  } catch (err) {
    if (clientSignal.aborted) return { kind: "client_disconnected" };
    const failure = classifyFailure(err);
    logFailure(failure, err);
    if (streamedAnyToken) return { kind: "mid_stream_failure" };
    return { kind: "failed", failure };
  }
}
