"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { judgeChat, isOffline, type JudgeChatCallbacks } from "@/features/ai-judge/lib/client";
import type { Citation, JudgeEvent } from "@/features/ai-judge/lib/types";
import {
  loadChat,
  pruneChats,
  saveChat,
} from "@/features/ai-judge/lib/chat-store";
import { useOptionalGameStateContext } from "@/features/game-shell/state/hooks";

/* SPEC §9.9 — 24k token cap, rough 4 chars/token, FIFO prune. */
const HISTORY_CHAR_CAP = 24_000 * 4;
/* SPEC §9.10 — 503 misconfigured renders this exact copy, not the server message. */
const MISCONFIGURED_COPY = "AI Judge unavailable";

/** One chat bubble in the in-memory conversation history (SPEC §9.9). */
export interface ChatMessage {
  readonly role: "user" | "system";
  readonly content: string;
  /** DESIGN §6.4.2 — footnote pills under the answer, from the `done` event. */
  readonly citations?: Citation[];
}

/** SPEC §9.5 — error SSE event shape surfaced as the error bubble. */
export type JudgeErrorEvent = Extract<JudgeEvent, { type: "error" }>;

/** Full streaming + offline state machine exposed to JudgeModal. */
export interface JudgeChatResult {
  readonly messages: ChatMessage[];
  readonly streamText: string;
  readonly isStreaming: boolean;
  /** SPEC §9.10 — navigator.onLine + fetch failure flipped state. */
  readonly isOffline: boolean;
  readonly errorBubble: JudgeErrorEvent | null;
  readonly draft: string;
  readonly setDraft: (draft: string) => void;
  /** Sends a trimmed question through the same path as submit. Empty no-ops. */
  readonly sendQuestion: (text: string) => Promise<void>;
  /** Sends the current draft. */
  readonly submit: () => void;
  /** Aborts mid-flight stream + resets transient state. History persists (SPEC §9.9). */
  readonly reset: () => void;
  readonly inputDisabled: boolean;
}

/**
 * @description
 * SPEC §9.11 — AI Judge chat state machine, consumed by JudgeModal.
 *
 * Owns: SSE streaming (send/token/done/error/abort via {@link judgeChat}),
 * conversation history persisted to IndexedDB per game version (SPEC §9.9 —
 * survives modal close + page reload; old versions pruned, keep 5), offline
 * detection (SPEC §9.10: navigator.onLine + window online/offline events +
 * fetch TypeError → offline), and input disabled logic. `sessionId` is
 * version-derived (`aijudge-${version}`) so server history follows the
 * persisted client thread.
 *
 * @param modalId — id of the owning dialog element. The hook listens for its
 *   `close` event to abort mid-flight streams and reset transient state;
 *   history is intentionally NOT cleared on close.
 * @returns {@link JudgeChatResult} — render everything, call nothing else.
 *
 * @example
 * const chat = useJudgeChat("ai-judge-modal");
 * // render chat.messages via ChatMessageList, chat.draft input, etc.
 *
 * @see DESIGN.md §6.4, §6.4.0
 * @see SPEC.md §9.9, §9.10
 */
export function useJudgeChat(modalId: string): JudgeChatResult {
  /* §9.9 — chat identity: game version. Bumped on restart/setup changes
     (not color changes); each version gets its own persisted thread. */
  const gameCtx = useOptionalGameStateContext();
  const version = gameCtx?.state.version ?? 0;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOfflineState, setIsOfflineState] = useState(() => isOffline());
  const [errorBubble, setErrorBubble] = useState<JudgeErrorEvent | null>(null);
  const [draft, setDraft] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const streamTextRef = useRef("");
  /* §9.9 — stable per game version: `aijudge-${version}` in-game, random
     fallback outside one. Overridden by the persisted entry's id on load. */
  const sessionIdRef = useRef<string | null>(null);
  if (sessionIdRef.current === null) {
    sessionIdRef.current = gameCtx
      ? `aijudge-${version}`
      : crypto.randomUUID();
  }
  /* Version the load resolved for; null while a load is in flight so the save
     effect skips (an empty save would overwrite persisted history). */
  const loadedVersionRef = useRef<number | null>(null);
  /* Sends since the current load started — a slow load must not wipe
     user-visible messages mid-session. */
  const sendsSinceLoadRef = useRef(0);
  const getDialog = useCallback(
    () => document.getElementById(modalId) as HTMLDialogElement | null,
    [modalId],
  );

  /* §9.9 — modal close aborts any mid-flight stream and resets transient
     state. History + sessionId persist: chat survives reopen and reload.
     ponytail: close during stream = partial answer dropped; deterministic
     abort beats invisible background streaming. */
  useEffect(() => {
    const dialog = getDialog();
    if (!dialog) return;
    const handleClose = () => {
      abortRef.current?.abort();
      abortRef.current = null;
      setIsStreaming(false);
      setStreamText("");
      streamTextRef.current = "";
      setErrorBubble(null);
      setIsOfflineState(isOffline()); // re-check on next open
    };
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      abortRef.current?.abort();
    };
  }, [getDialog]);

  /* SPEC §9.10 — online/offline window events. No polling. */
  useEffect(() => {
    const handleOnline = () => setIsOfflineState(false);
    const handleOffline = () => setIsOfflineState(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  /* §9.9 — hydrate persisted chat for the current game version. Runs once
     per version change (bumped on restart/setup changes, not color). A send
     while the load is in flight skips the swap so user-visible messages are
     never wiped mid-session; the send itself marks the version loaded, so
     the save effect resumes persisting from that point. */
  useEffect(() => {
    if (loadedVersionRef.current === version) return;
    loadedVersionRef.current = null; // load in flight → save effect skips
    sendsSinceLoadRef.current = 0;
    sessionIdRef.current = gameCtx ? `aijudge-${version}` : crypto.randomUUID();

    let cancelled = false;
    void loadChat(version).then((entry) => {
      if (cancelled || sendsSinceLoadRef.current > 0) return;
      loadedVersionRef.current = version;
      setMessages(entry?.messages ?? []);
      if (entry) sessionIdRef.current = entry.sessionId;
    });
    return () => {
      cancelled = true;
    };
  }, [version, gameCtx]);

  /* §9.9 — persist on every message change, keyed by game version. Skipped
     while the load for this version is still in flight (an empty save would
     overwrite persisted history). Prune old versions after each save. */
  useEffect(() => {
    if (loadedVersionRef.current !== version) return;
    void saveChat({
      version,
      /* Non-null: lazy init above guarantees a value by first effect run. */
      sessionId: sessionIdRef.current!,
      updatedAt: Date.now(),
      messages,
    }).then(() => {
      void pruneChats();
    });
  }, [messages, version]);

  /* SPEC §9.9 — append with FIFO prune past the char cap. */
  const pushMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, message];
      let total = 0;
      for (const m of next) total += m.content.length;
      let drop = 0;
      while (drop < next.length && total > HISTORY_CHAR_CAP) {
        total -= next[drop].content.length;
        drop++;
      }
      return drop > 0 ? next.slice(drop) : next;
    });
  }, []);

  /**
   * @description Sends a trimmed question through the SSE stream, appending
   *   the user bubble first. No-ops when empty, streaming, or offline.
   *   Network `TypeError` (fetch failed) flips the offline state (SPEC §9.10).
   *
   * @param text — question text; whitespace-trimmed.
   * @returns Promise resolving when the stream ends. Resolves immediately
   *   (no send) when guarded by disabled/empty checks.
   */
  const sendQuestion = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || isStreaming || isOfflineState) return;

      /* §9.9 — a send during a pending load owns the session from here on:
         mark loaded (save resumes) and tell the load to skip its swap. */
      sendsSinceLoadRef.current += 1;
      if (loadedVersionRef.current === null)
        loadedVersionRef.current = version;

      pushMessage({ role: "user", content: question });
      setDraft("");
      setErrorBubble(null);
      setStreamText("");
      streamTextRef.current = "";
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const callbacks: JudgeChatCallbacks = {
        onToken: (content) => {
          streamTextRef.current += content;
          setStreamText(streamTextRef.current);
        },
        onDone: (event) => {
          pushMessage({
            role: "system",
            content: streamTextRef.current,
            citations: event.citations,
          });
          setStreamText("");
          setIsStreaming(false);
          abortRef.current = null;
        },
        onError: (event) => {
          /* SPEC §9.10 — misconfigured → exact copy. */
          setErrorBubble(
            event.code === "misconfigured"
              ? { ...event, message: MISCONFIGURED_COPY }
              : event,
          );
          setStreamText("");
          setIsStreaming(false);
          abortRef.current = null;
        },
      };

      try {
        await judgeChat(
          { sessionId: sessionIdRef.current!, question },
          callbacks,
          controller.signal,
        );
      } catch (error) {
        if (controller.signal.aborted) return; // dialog closed mid-flight
        setIsStreaming(false);
        abortRef.current = null;
        if (error instanceof TypeError) {
          // SPEC §9.10 — fetch network failure → offline state.
          setIsOfflineState(true);
        } else {
          /* ponytail: no SSE error body on thrown fetch errors — code is
             inert except "misconfigured"; message is what renders. */
          setErrorBubble({
            type: "error",
            code: "bad_request",
            message: "Something went wrong. Try again.",
          });
        }
      }
    },
    [isStreaming, isOfflineState, pushMessage, version],
  );

  /** @description Sends the current draft through the submit path. */
  const submit = useCallback(() => {
    void sendQuestion(draft);
  }, [sendQuestion, draft]);

  /**
   * @description Aborts any mid-flight stream and resets transient state
   *   (streaming text, error bubble, offline re-check). History + sessionId
   *   persist — chat survives dialog close and reload (SPEC §9.9).
   * @returns void.
   */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStreamText("");
    streamTextRef.current = "";
    setErrorBubble(null);
    setIsOfflineState(isOffline());
  }, []);

  /* SPEC §9.10 — streaming or offline blocks sending. */
  const inputDisabled = isStreaming || isOfflineState;

  return {
    messages,
    streamText,
    isStreaming,
    isOffline: isOfflineState,
    errorBubble,
    draft,
    setDraft,
    sendQuestion,
    submit,
    reset,
    inputDisabled,
  };
}
