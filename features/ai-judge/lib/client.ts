import type { JudgeEvent, JudgeRequest } from "./types";

/** SPEC §9.5 — stream callbacks. One call per SSE event. */
export interface JudgeChatCallbacks {
  readonly onToken: (content: string) => void;
  readonly onDone: (event: Extract<JudgeEvent, { type: "done" }>) => void;
  readonly onError: (event: Extract<JudgeEvent, { type: "error" }>) => void;
}

/** Loose runtime guard — stream we own, keep parsing defensive. */
const isJudgeEvent = (value: unknown): value is JudgeEvent => {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as { readonly type?: unknown }).type;
  return type === "token" || type === "done" || type === "error";
};

/**
 * Parses one SSE block (may contain `data: ` prefix lines or bare JSON).
 * Returns null for empty/malformed blocks — caller skips them.
 */
const parseEvent = (chunk: string): JudgeEvent | null => {
  const dataLines = chunk
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());
  const payload = (dataLines.length > 0 ? dataLines.join("\n") : chunk.trim()) || "";
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    return isJudgeEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Reads an SSE body, dispatching each event to the matching callback.
 * Stops reading after an error event (server ends the stream there).
 */
async function readSseStream(
  response: Response,
  callbacks: JudgeChatCallbacks,
): Promise<void> {
  if (!response.body) throw new Error("AI Judge response has no body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let stopped = false;

  const dispatch = (event: JudgeEvent): void => {
    if (event.type === "token") callbacks.onToken(event.content);
    else if (event.type === "done") callbacks.onDone(event);
    else {
      callbacks.onError(event);
      stopped = true;
    }
  };

  const handleCompleteBlocks = (text: string): void => {
    for (const block of text.split("\n\n")) {
      if (stopped) return;
      const event = parseEvent(block);
      if (event) dispatch(event);
    }
  };

  while (!stopped) {
    const { done, value } = await reader.read();
    if (done) break;
    // Normalize CRLF (SSE spec) so "\n\n" is the separator.
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    // Emit only complete blocks; keep the trailing partial block buffered.
    const lastSeparator = buffer.lastIndexOf("\n\n");
    if (lastSeparator !== -1) {
      handleCompleteBlocks(buffer.slice(0, lastSeparator));
      buffer = buffer.slice(lastSeparator + 2);
    }
  }

  // Trailing block without a closing separator (e.g. final done event).
  buffer += decoder.decode();
  if (buffer.trim()) handleCompleteBlocks(buffer);
}

/**
 * @description
 * SPEC §9.11 — single client call site for the AI Judge. All UI questions
 * route through here. POSTs to `/api/judge` and parses the SSE event stream
 * (SPEC §9.5): `token` events stream incrementally, `done` carries the final
 * answer metadata, `error` carries a user-facing message.
 *
 * Network failures (e.g. `TypeError: fetch failed` while offline) propagate
 * as thrown errors — the UI treats them as the offline state (SPEC §9.10).
 *
 * @param request — `{sessionId, question, gameContext?}`. sessionId scopes
 *   server history to this modal open (SPEC §9.9). gameContext is an
 *   optional server capability (SPEC §9.8) — the client currently sends
 *   questions without it.
 * @param callbacks — onToken per token event, onDone per done event,
 *   onError per error event.
 * @param signal — optional AbortSignal; aborts the fetch. AbortError
 *   propagates to the caller.
 * @returns Promise resolving when the stream ends (done/error/connection close).
 *
 * @example
 * judgeChat({ question: "When can I cast instants?" }, {
 *   onToken: (t) => append(t),
 *   onDone: (e) => finish(e.citations),
 *   onError: (e) => fail(e.message),
 * });
 *
 * @see SPEC.md §9.5, §9.10, §9.11
 */
export async function judgeChat(
  request: JudgeRequest,
  callbacks: JudgeChatCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/judge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    // Error statuses may still carry an SSE error event (e.g. 429 rate_limited).
    const body = await response.text();
    const event = parseEvent(body);
    if (event?.type === "error") {
      callbacks.onError(event);
      return;
    }
    throw new Error(`AI Judge request failed with status ${response.status}`);
  }

  await readSseStream(response, callbacks);
}

/**
 * @description
 * SPEC §9.10 — offline detection. `navigator.onLine === false` marks the
 * offline UI state. Also flipped by network fetch failures in `judgeChat`.
 *
 * @returns true when the browser reports no network connectivity.
 *
 * @see SPEC.md §9.10
 */
export function isOffline(): boolean {
  return navigator.onLine === false;
}
