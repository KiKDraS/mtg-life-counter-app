"use client";

import { ChatMessageList } from "@/features/ai-judge/components/ChatMessageList";
import { OfflineAlert } from "@/features/ai-judge/components/OfflineAlert";
import { useJudgeChat } from "@/features/ai-judge/hooks/use-judge-chat";
import { DialogShell } from "@/shared/components/DialogShell";
import { useCallback, useEffect } from "react";

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

  /* DESIGN §6.4 — mobile virtual keyboard: lift the input row above the OSK.
     Dialog keeps h-full (full-page black, canvas black via globals.css) so the
     board never shows through during the height transition. visualViewport
     ALWAYS shrinks when the keyboard shows — padding = keyboard inset,
     re-applied on open (MutationObserver on the `open` attribute; no native
     open event exists). */
  useEffect(() => {
    if (!window.visualViewport) return;
    const dialog = document.getElementById(id) as HTMLDialogElement | null;
    if (!dialog) return;
    // const paintCanvasBlack = (on: boolean) => {
    //   document.documentElement.style.background = on ? "#000" : "";
    // };
    const syncDialogToViewport = () => {
      if (!dialog.open) return;
      const vv = window.visualViewport!;
      /* DESIGN §6.4 — lift the input row above the OSK with padding; dialog
         keeps h-full (full-page black) so the board never shows through
         during the height transition (no white flash). */
      const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      dialog.style.paddingBottom = `${inset}px`;
    };
    // ponytail: also re-sync on open — modal mounts closed (SpellbookMenu
    // renders it always), so the mount-time sync runs before open and the
    // open attribute flip is the only event that applies the padding.
    const observer = new MutationObserver(() => {
      // paintCanvasBlack(dialog.open);
      syncDialogToViewport();
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    window.visualViewport.addEventListener("resize", syncDialogToViewport);
    window.visualViewport.addEventListener("scroll", syncDialogToViewport);
    syncDialogToViewport();
    // paintCanvasBlack(dialog.open);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener(
        "resize",
        syncDialogToViewport,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        syncDialogToViewport,
      );
      // paintCanvasBlack(false);
    };
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
          className="flex items-end gap-2 px-4 pb-4"
        >
          <textarea
            rows={1}
            value={chat.draft}
            onChange={(event) => chat.setDraft(event.target.value)}
            placeholder="Ask about a card or rule…"
            aria-label="Ask about a card or rule"
            autoFocus
            disabled={chat.inputDisabled}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                chat.submit();
              }
            }}
            className="w-full flex-1 resize-none rounded-lg border border-ui-textLight/40 bg-ui-overlay px-4 py-3 text-sm text-ui-textLight placeholder:text-white/50 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50 field-sizing-content max-h-40 overflow-y-auto"
          />
          <button
            type="submit"
            aria-label="Send question"
            disabled={chat.inputDisabled || chat.draft.trim() === ""}
            className="flex size-10 cursor-pointer items-center justify-center rounded-full text-xl leading-none text-ui-textLight transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-40"
          >
            ⏎
          </button>
        </form>
      </div>
    </DialogShell>
  );
}
