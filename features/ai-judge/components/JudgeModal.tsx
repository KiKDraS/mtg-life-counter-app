"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DialogShell } from "@/shared/components/DialogShell";
import {
  judgeChat,
  isOffline,
  type JudgeChatCallbacks,
} from "@/features/ai-judge/lib/client";
import type { GameContext } from "@/features/ai-judge/lib/types";
import { idbGet, STORE_STATE, type GameStateRecord } from "@/features/persistence/idb";

/* ── Constants ── */

const AI_JUDGE_TITLE_ID = "ai-judge-title";

/* SPEC §9.9 — 24k token cap, rough 4 chars/token, FIFO prune. */
const HISTORY_CHAR_CAP = 24_000 * 4;

const SUGGESTION_KIND = {
  JudgePlay: "judge-play",
  CardLegality: "card-legality",
  CombatMath: "combat-math",
} as const;
type SuggestionKind = (typeof SUGGESTION_KIND)[keyof typeof SUGGESTION_KIND];

const SUGGESTION_CHIPS: ReadonlyArray<{
  readonly kind: SuggestionKind;
  readonly label: string;
}> = [
  { kind: SUGGESTION_KIND.JudgePlay, label: "Judge this play" },
  { kind: SUGGESTION_KIND.CardLegality, label: "Card legality" },
  { kind: SUGGESTION_KIND.CombatMath, label: "Combat math" },
];

const OFFLINE_COPY = "You're offline — AI Judge needs internet.";

/* ── Local types ── */

interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

interface JudgeModalProps {
  readonly id: string;
}

/* ── Game context serialization (SPEC §9.8) ── */

/**
 * Reads the live board snapshot from IndexedDB (single-writer registry,
 * SPEC §4.2) and maps it to the shared GameContext shape. Best-effort:
 * returns undefined when the store is empty or unavailable — the chip then
 * sends the prompt without context.
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

/* ── Component ── */

/**
 * §6.4 AI Judge chat window — client leaf.
 *
 * Maximized native dialog over a solid black backdrop. Streams judge answers
 * via {@link judgeChat}, renders system/user bubbles, suggestion chips, and
 * the offline fallback state (§6.4.0 / SPEC §9.10). In-memory conversation
 * history (SPEC §9.9) is cleared when the dialog closes.
 *
 * Rendered from SpellbookMenu (client boundary already exists there).
 *
 * @see DESIGN.md §6.4, §6.4.0, §6.4.1
 * @see SPEC.md §9.8, §9.9, §9.10
 */
export function JudgeModal({ id }: JudgeModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOfflineState, setIsOfflineState] = useState(() => isOffline());
  const [errorBubble, setErrorBubble] = useState<{
    readonly code: string;
    readonly message: string;
  } | null>(null);
  const [draft, setDraft] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const streamTextRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const getDialog = useCallback(
    () => document.getElementById(id) as HTMLDialogElement | null,
    [id],
  );

  /* Auto-scroll to newest message on every change. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText, errorBubble, isStreaming]);

  /* SPEC §9.9 — history cleared on dialog close. Abort any mid-flight stream
     first so no callback writes into the reset state. ponytail: close during
     stream = partial answer dropped; deterministic abort beats invisible
     background streaming. */
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
          setErrorBubble({ code: event.code, message: event.message });
          setStreamText("");
          setIsStreaming(false);
          abortRef.current = null;
        },
      };

      try {
        await judgeChat({ question, gameContext }, callbacks, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return; // dialog closed mid-flight
        setIsStreaming(false);
        abortRef.current = null;
        if (error instanceof TypeError) {
          // SPEC §9.10 — fetch network failure → offline state.
          setIsOfflineState(true);
        } else {
          setErrorBubble({
            code: "unknown",
            message: "Something went wrong. Try again.",
          });
        }
      }
    },
    [isStreaming, isOfflineState, pushMessage],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void sendQuestion(draft);
    },
    [sendQuestion, draft],
  );

  const handleChip = useCallback(
    async (kind: SuggestionKind) => {
      if (isStreaming || isOfflineState) return;
      if (kind === SUGGESTION_KIND.JudgePlay) {
        /* SPEC §9.8 — serialized live state at send time. */
        const context = await buildGameContext();
        const prompt = context
          ? `Judge this play: ${JSON.stringify(context)}`
          : "Judge this play";
        await sendQuestion(prompt, context);
      } else if (kind === SUGGESTION_KIND.CardLegality) {
        /* ponytail: no card extraction yet — static placeholder prompt. */
        await sendQuestion("Is <card> legal in Commander?");
      } else {
        await sendQuestion("Explain combat damage here.");
      }
    },
    [isStreaming, isOfflineState, sendQuestion],
  );

  const closeDialog = useCallback(() => getDialog()?.close(), [getDialog]);

  /* SPEC §9.10 — misconfigured → "AI Judge unavailable", chips hidden. */
  const chipsHidden = errorBubble?.code === "misconfigured";
  const inputDisabled = isStreaming || isOfflineState;
  const chipsDisabled = inputDisabled || chipsHidden;

  return (
    <DialogShell
      id={id}
      ariaLabelledBy={AI_JUDGE_TITLE_ID}
      className="fixed z-50 bg-black"
    >
      <h2 id={AI_JUDGE_TITLE_ID} className="sr-only">
        AI Judge
      </h2>

      <div className="flex h-full flex-col">
        {/* Heading row — ✕ only (§6.4). */}
        <div className="flex items-center justify-end px-4 pt-4">
          <button
            type="button"
            aria-label="Close AI Judge"
            onClick={closeDialog}
            className="flex size-10 cursor-pointer items-center justify-center rounded-full text-xl leading-none text-ui-textLight transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
          >
            ✕
          </button>
        </div>

        {/* Chat message list — read-only history while offline (§6.4.0). */}
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4"
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "max-w-[75%] self-end rounded-lg rounded-tr-none bg-mana-c px-3 py-2 text-sm whitespace-pre-wrap text-ui-textDark"
                  : "max-w-[75%] self-start rounded-lg rounded-tl-none bg-mana-b px-3 py-2 text-sm whitespace-pre-wrap text-ui-textLight"
              }
            >
              {message.content}
            </div>
          ))}

          {/* Streaming system bubble — typing dots until first token. */}
          {isStreaming && (
            <div className="max-w-[75%] self-start rounded-lg rounded-tl-none bg-mana-b px-3 py-2">
              {streamText ? (
                <p className="text-sm whitespace-pre-wrap text-ui-textLight">
                  {streamText}
                </p>
              ) : (
                <span
                  aria-label="AI Judge is typing"
                  className="flex gap-1 text-ui-textLight"
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-ui-textLight/70" />
                  <span className="size-1.5 animate-pulse rounded-full bg-ui-textLight/70 [animation-delay:150ms]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-ui-textLight/70 [animation-delay:300ms]" />
                </span>
              )}
            </div>
          )}

          {/* Error bubble (SPEC §9.10). */}
          {errorBubble && (
            <div className="max-w-[75%] self-start rounded-lg rounded-tl-none bg-mana-b px-3 py-2 text-sm text-ui-textLight">
              {errorBubble.message}
            </div>
          )}
        </div>

        {/* Offline alert row — above chips (§6.4.0). */}
        {isOfflineState && (
          <div
            role="status"
            className="w-full bg-mana-b px-4 py-2 text-center text-sm text-ui-textLight"
          >
            {OFFLINE_COPY}
          </div>
        )}

        {/* Suggestion chips (§6.4.1). */}
        {!chipsHidden && (
          <div className="flex gap-2 px-4 pb-3">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip.kind}
                type="button"
                onClick={() => void handleChip(chip.kind)}
                disabled={chipsDisabled}
                className="h-11 cursor-pointer rounded-full border border-ui-textLight/40 bg-ui-overlay px-4 text-sm text-ui-textLight transition-opacity focus-visible:outline-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-25"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Docked input (§6.4). */}
        <form onSubmit={handleSubmit} className="px-4 pb-4">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about a card or rule…"
            aria-label="Ask about a card or rule"
            autoFocus
            disabled={inputDisabled}
            className="w-full cursor-text rounded-lg border border-ui-textLight/40 bg-ui-overlay px-4 py-3 text-sm text-ui-textLight placeholder:text-white/50 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
          />
        </form>
      </div>
    </DialogShell>
  );
}
