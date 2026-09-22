"use client";

import { useEffect } from "react";
import { DialogShell } from "@/shared/components/DialogShell";
import { MODAL_CLASSNAMES } from "../constants/modal";
import { cn } from "@/shared/lib/cn";

interface InstallHintModalProps {
  readonly id: string;
}

/**
 * §8.6 iOS Install Hint Modal.
 *
 * Safari has no native PWA install prompt — instructions dialog instead.
 *
 * Close via:
 * - Tap backdrop (content box is content-sized; taps outside land on the
 *   dialog itself → DialogShell backdrop handler fires)
 * - Escape (document-level capture listener — WebKit's show() never moves
 *   focus into the dialog, so DialogShell's onKeyDown can't fire)
 *
 * No ✕ close button per §6.1.
 *
 * @see DESIGN.md §5.2
 * @see SPEC.md §8.6
 */
export function InstallHintModal({ id }: InstallHintModalProps) {
  /* WebKit: show() does not focus the dialog → keydown bubbles from nowhere.
     Document capture catches Escape anywhere; dialog.open guard keeps it
     inert while closed. (Same pattern as JudgeModal §6.4.) */
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
      ariaLabelledBy="install-hint-title"
      className={cn(MODAL_CLASSNAMES, "items-center justify-center")}
    >
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <h2 id="install-hint-title" className="sr-only">
          Install App
        </h2>
        {/* iOS share glyph — box with up arrow. */}
        <svg
          className="size-14 text-ui-textLight"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="M8 7l4-4 4 4" />
          <path d="M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8" />
        </svg>
        <p className="text-body-sm text-ui-textLight">
          Tap Share, then Add to Home Screen.
        </p>
      </div>
    </DialogShell>
  );
}