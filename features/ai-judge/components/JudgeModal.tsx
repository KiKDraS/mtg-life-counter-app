"use client";

import { ChatMessageList } from "@/features/ai-judge/components/ChatMessageList";
import { OfflineAlert } from "@/features/ai-judge/components/OfflineAlert";
import { useJudgeChat } from "@/features/ai-judge/hooks/use-judge-chat";
import { DialogShell } from "@/shared/components/DialogShell";
import { useCallback, useEffect, useRef } from "react";

const AI_JUDGE_TITLE_ID = "ai-judge-title";

const KEYBOARD_TOOLBAR_MARGIN = 48; // ponytail: physical calibration — Gboard toolbar row ~40dp not reflected in visualViewport; tune per device/keyboard.
// ponytail: physical calibration knob — vv shrink beyond this = keyboard; URL-bar jitter ~13px must stay below.
const KEYBOARD_DETECT_THRESHOLD = 60;

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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
     board never shows through during the height transition. Self-calibrating
     lift: measure the input row's overflow past the visible edge rather than
     trusting reported heights, re-applied on open (MutationObserver on the
     `open` attribute; no native open event exists).

     Multi-source triggers + 500ms poll (no settle timer): EVERY event source
     (VirtualKeyboard API geometrychange, visualViewport resize/scroll, window
     resize, focusin) plus a guaranteed poll re-applies the lift — Chrome
     doesn't reliably fire geometrychange on the SECOND keyboard show, so the
     poll is the backstop. The self-calibrating measurement makes redundant
     ticks no-ops at overflow 0.

     Two measurement paths, Chrome Android primary:
     1. VirtualKeyboard API (navigator.virtualKeyboard.boundingRect) — exact
        OSK geometry incl. Gboard toolbar row; opt into overlayContent so the
        layout viewport never resizes.
     2. visualViewport fallback — height + offsetTop, minus a tunable toolbar
        margin (KEYBOARD_TOOLBAR_MARGIN) only while the keyboard is up. */
  useEffect(() => {
    const vk = (
      navigator as Navigator & {
        virtualKeyboard?: {
          overlayContent: boolean;
          boundingRect: { top: number; height: number };
          addEventListener: (type: "geometrychange", cb: () => void) => void;
          removeEventListener: (type: "geometrychange", cb: () => void) => void;
        };
      }
    ).virtualKeyboard;
    const vv = window.visualViewport;
    if (!vk && !vv) return;
    const dialog = document.getElementById(id) as HTMLDialogElement | null;
    if (!dialog) return;
    /* iOS Safari: vv bottom = keyboard top — no toolbar row to subtract; the
       48px margin is a Gboard/Android thing. Evaluated once. */
    const isIos =
      "standalone" in navigator ||
      /iPhone|iPad|iPod/.test(navigator.userAgent);
    // const paintCanvasBlack = (on: boolean) => {
    //   document.documentElement.style.background = on ? "#000" : "";
    // };

    /* DESIGN §6.4 — one place catches ✕ / Escape / backdrop close: clear the
       lift, drop focus, reset any focus-scroll offset. */
    const handleClose = () => {
      dialog.style.paddingBottom = "";
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    };
    dialog.addEventListener("close", handleClose);

    const applyLift = (visibleBottom: number): number => {
      if (!dialog.open) return 0;
      const form = dialog.querySelector("form");
      if (!form) return 0;
      const overflow = form.getBoundingClientRect().bottom - visibleBottom;
      const current = parseFloat(dialog.style.paddingBottom) || 0;
      dialog.style.paddingBottom = `${Math.max(0, current + overflow)}px`;
      return overflow;
    };

    const syncViaKeyboardApi = () => {
      if (!dialog.open || !vk || vk.boundingRect.height <= 0) return;
      /* Degenerate geometry (height <= 0) = no keyboard; sync() routes to the
         visualViewport path instead (clears lift on close). */
      /* boundingRect.top = exact keyboard top edge (toolbar included). */
      applyLift(vk.boundingRect.top);
    };

    const syncViaViewport = () => {
      if (!dialog.open || !vv) return;
      /* iOS Safari shrinks innerHeight with the keyboard; the layout viewport
         (clientHeight) stays stable — detect against it. */
      const keyboardUp =
        vv.height + vv.offsetTop <
        document.documentElement.clientHeight - KEYBOARD_DETECT_THRESHOLD;
      const visibleBottom =
        vv.height +
        vv.offsetTop -
        (keyboardUp && !isIos ? KEYBOARD_TOOLBAR_MARGIN : 0);
      applyLift(visibleBottom);
    };

    const sync = () => {
      if (!dialog.open) return;
      if (vk && vk.boundingRect.height > 0) syncViaKeyboardApi();
      else syncViaViewport();
    };

    if (vk) {
      try {
        vk.overlayContent = true; /* opt into overlay mode: keyboard does not
                                     resize the layout viewport */
      } catch {
        /* older Chrome — ignore, geometry events still fire */
      }
      vk.addEventListener("geometrychange", sync);
    }
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    dialog.addEventListener("focusin", sync);

    /* 500ms poll: the guarantee — even with zero events (Chrome's unreliable
       second geometrychange), the self-calibrating measurement re-applies. */
    const poll = setInterval(sync, 500);

    /* re-sync on open — modal mounts closed, open attr flip is the trigger */
    const observer = new MutationObserver(() => {
      // paintCanvasBlack(dialog.open); — kept as user left it
      /* DESIGN §6.4 — focus input on open. preventScroll: iOS Safari otherwise
         scrolls the page to reveal the focused textarea (offset never resets —
         board sits shifted). */
      if (dialog.open) inputRef.current?.focus({ preventScroll: true });
      sync();
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    sync();

    return () => {
      clearInterval(poll);
      observer.disconnect();
      dialog.removeEventListener("close", handleClose);
      if (vk) vk.removeEventListener("geometrychange", sync);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      dialog.removeEventListener("focusin", sync);
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
            ref={inputRef}
            rows={1}
            value={chat.draft}
            onChange={(event) => chat.setDraft(event.target.value)}
            placeholder="Ask about a card or rule…"
            aria-label="Ask about a card or rule"
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
