"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { judgeChat, isOffline, type JudgeChatCallbacks } from "@/features/ai-judge/lib/client";
import {
  SUGGESTION_CHIPS,
  SUGGESTION_KIND,
  type SuggestionKind,
} from "@/features/ai-judge/constants/suggestions";
import type { GameContext, JudgeEvent } from "@/features/ai-judge/lib/types";
import { idbGet, STORE_STATE, type GameStateRecord } from "@/features/persistence/idb";

/* SPEC §9.9 — 24k token cap, rough 4 chars/token, FIFO prune. */
const HISTORY_CHAR_CAP = 24_000 * 4;

/** One chat bubble in the in-memory conversation history (SPEC §9.9). */
export interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
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
  /** Sends a question through the same path as chips. Trimmed; empty no-ops. */
  readonly sendQuestion: (text: string, gameContext?: GameContext) => Promise<void>;
  /** Sends the DESIGN §6.4.1 chip prompt for `kind`. */
  readonly sendSuggestion: (kind: SuggestionKind) => void;
  /** Sends the current draft. */
  readonly submit: () => void;
  /** Clears history + aborts mid-flight stream on dialog close (SPEC §9.9). */
  readonly reset: () => void;
  readonly inputDisabled: boolean;
  readonly chipsDisabled: boolean;
  /** SPEC §9.10 — misconfigured → chips hidden entirely. */
  readonly chipsHidden: boolean;
}

/**
 * SPEC §9.8 — reads the live board snapshot from IndexedDB (single-writer
 * registry, SPEC §4.2) and maps it to the shared GameContext shape.
 * Best-effort: returns undefined when the store is empty or unavailable —
 * the chip then sends the prompt without context.
 */
async function buildGameContext(): Promise<GameContext | undefined> {
  try {
    const record = await idbGet<GameStateRecord>(STORE_STATE, "state");
    if (!record?.playerStates?.length) return undefined;
    return {
      format: "commander",
      players: record.playerStates.map((player) => ({
        playerId: player.playerId,
        life: player.life,
        color: player.color,
        counters: player.counters,
        commanderDamage: player.commanderDamage,
      })),
    };
  } catch {
    return undefined;
  }
}

/**
 * @description
 * SPEC §9.11 — AI Judge chat state machine, consumed by JudgeModal.
 *
 * Owns: SSE streaming (send/token/done/error/abort via {@link judgeChat}),
 * in-memory conversation history with FIFO prune (SPEC §9.9), offline
 * detection (SPEC §9.10: navigator.onLine + window online/offline events +
 * fetch TypeError → offline), and input/chip disabled logic. History clears
 * and a fresh `sessionId` (SPEC §9.9) is minted on every dialog close —
 * each open starts with empty server history.
 *
 * @param modalId — id of the owning dialog element. The hook listens for its
 *   `close` event to reset state; without it, state leaks across opens.
 * @returns {@link JudgeChatResult} — render everything, call nothing else.
 *
 * @example
 * const chat = useJudgeChat("ai-judge-modal");
 * // render chat.messages via ChatMessageList, chat.draft input, etc.
 *
 * @see DESIGN.md §6.4, §6.4.0, §6.4.1
 * @see SPEC.md §9.8, §9.9, §9.10
 */
export function useJudgeChat(modalId: string): JudgeChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOfflineState, setIsOfflineState] = useState(() => isOffline());
  const [errorBubble, setErrorBubble] = useState<JudgeErrorEvent | null>(null);
  const [draft, setDraft] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const streamTextRef = useRef("");
  /* SPEC §9.9 — fresh id per open. Re-minted on dialog close. */
  const sessionIdRef = useRef(crypto.randomUUID());
  const getDialog = useCallback(
    () => document.getElementById(modalId) as HTMLDialogElement | null,
    [modalId],
  );

  /* SPEC §9.9 — history cleared on dialog close. Abort any mid-flight stream
     first so no callback writes into the reset state. ponytail: close during
     stream = partial answer dropped; deterministic abort beats invisible
     background streaming. New open mints a fresh sessionId. */
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
      setMessages([]);
      setIsOfflineState(isOffline()); // re-check on next open
      sessionIdRef.current = crypto.randomUUID();
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
   * @param gameContext — optional SPEC §9.8 snapshot (JudgePlay chip only).
   * @returns Promise resolving when the stream ends. Resolves immediately
   *   (no send) when guarded by disabled/empty checks.
   */
  const sendQuestion = useCallback(
    async (text: string, gameContext?: GameContext) => {
      const question = text.trim();
      if (!question || isStreaming || isOfflineState) return;

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
        onDone: () => {
          pushMessage({ role: "assistant", content: streamTextRef.current });
          setStreamText("");
          setIsStreaming(false);
          abortRef.current = null;
        },
        onError: (event) => {
          setErrorBubble(event);
          setStreamText("");
          setIsStreaming(false);
          abortRef.current = null;
        },
      };

      try {
        await judgeChat(
          { sessionId: sessionIdRef.current, question, gameContext },
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
    [isStreaming, isOfflineState, pushMessage],
  );

  /**
   * @description Sends the DESIGN §6.4.1 chip prompt for `kind` through the
   *   same path as typed input. JudgePlay serializes live board state
   *   (SPEC §9.8) at send time.
   *
   * @param kind — SUGGESTION_KIND member.
   * @returns void; the underlying send is fire-and-forget.
   */
  const sendSuggestion = useCallback(
    (kind: SuggestionKind) => {
      const chip = SUGGESTION_CHIPS.find((c) => c.kind === kind);
      if (!chip) return;
      if (kind === SUGGESTION_KIND.JudgePlay) {
        void buildGameContext().then((context) => {
          const prompt = context
            ? `${chip.prompt}: ${JSON.stringify(context)}`
            : chip.prompt;
          void sendQuestion(prompt, context);
        });
      } else {
        void sendQuestion(chip.prompt);
      }
    },
    [sendQuestion],
  );

  /** @description Sends the current draft through the submit path. */
  const submit = useCallback(() => {
    void sendQuestion(draft);
  }, [sendQuestion, draft]);

  /**
   * @description Clears the in-memory history, aborts any mid-flight stream,
   *   and mints a fresh sessionId — called on dialog close (SPEC §9.9).
   * @returns void.
   */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStreamText("");
    streamTextRef.current = "";
    setErrorBubble(null);
    setMessages([]);
    setIsOfflineState(isOffline());
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  /* SPEC §9.10 — misconfigured → "AI Judge unavailable", chips hidden. */
  const chipsHidden = errorBubble?.code === "misconfigured";
  const inputDisabled = isStreaming || isOfflineState;
  const chipsDisabled = inputDisabled || chipsHidden;

  return {
    messages,
    streamText,
    isStreaming,
    isOffline: isOfflineState,
    errorBubble,
    draft,
    setDraft,
    sendQuestion,
    sendSuggestion,
    submit,
    reset,
    inputDisabled,
    chipsDisabled,
    chipsHidden,
  };
}
