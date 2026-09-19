"use client";

import { useCallback, useEffect } from "react";
import { DialogShell } from "@/shared/components/DialogShell";
import { useJudgeChat } from "@/features/ai-judge/hooks/use-judge-chat";
import { ChatMessageList } from "@/features/ai-judge/components/ChatMessageList";
import { OfflineAlert } from "@/features/ai-judge/components/OfflineAlert";

const AI_JUDGE_TITLE_ID = "ai-judge-title";

interface JudgeModalProps {
  readonly id: string;
}

/**
 * @description
 * §6.4 AI Judge chat window — thin composition shell.
 *
 * All logic (streaming state machine, in-memory history, offline detection,
 * disabled states) lives in {@link useJudgeChat}; this component only lays
 * out DialogShell, the ✕ header, and the chat children. Maximized native
 * dialog over a solid black backdrop (§6.1).
 *
 * Rendered from SpellbookMenu (client boundary already exists there).
 *
 * @see DESIGN.md §6.4, §6.4.0, §6.4.1
 * @see SPEC.md §9.8, §9.9, §9.10
 */
export function JudgeModal({ id }: JudgeModalProps) {
  const chat = useJudgeChat(id);

  const closeDialog = useCallback(() => {
    (document.getElementById(id) as HTMLDialogElement | null)?.close();
  }, [id]);

  /* DESIGN §6.4 — Escape closes regardless of focus. Capture phase on
     document: streaming disables the input → browser blurs it → focus lands
     on <body>, so DialogShell's onKeyDown (bubbled from a focused child)
     never fires. Document capture catches the keydown anywhere; the
     dialog.open guard keeps it inert while closed. close() fires the dialog
     close event → useJudgeChat aborts mid-flight stream + resets (SPEC §9.9). */
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const dialog = document.getElementById(id) as HTMLDialogElement | null;
      if (!dialog?.open) return;
      event.preventDefault();
      dialog.close();
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [id]);

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
        <ChatMessageList
          messages={chat.messages}
          streamText={chat.streamText}
          isStreaming={chat.isStreaming}
          errorBubble={chat.errorBubble}
        />

        {/* Offline alert row (§6.4.0). */}
        {chat.isOffline && <OfflineAlert />}

        {/* Docked input (§6.4). */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            chat.submit();
          }}
          className="px-4 pb-4"
        >
          <input
            type="text"
            value={chat.draft}
            onChange={(event) => chat.setDraft(event.target.value)}
            placeholder="Ask about a card or rule…"
            aria-label="Ask about a card or rule"
            autoFocus
            disabled={chat.inputDisabled}
            className="w-full cursor-text rounded-lg border border-ui-textLight/40 bg-ui-overlay px-4 py-3 text-sm text-ui-textLight placeholder:text-white/50 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
          />
        </form>
      </div>
    </DialogShell>
  );
}
