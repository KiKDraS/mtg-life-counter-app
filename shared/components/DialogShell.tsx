"use client";

import { useCallback } from "react";
import { cn } from "@/shared/lib/cn";

interface DialogShellProps {
  readonly id: string;
  readonly ariaLabelledBy: string;
  readonly children: React.ReactNode;
  readonly className?: string;
  /**
   * §6.1 light-modal variant: fit-content box, no box background — the
   * native `::backdrop` (`rgba(0,0,0,0.35)`) dims the rest. Requires the
   * opener to use showModal(). Default: full-box overlay (show()).
   */
  readonly fitContent?: boolean;
}

/**
 * @description
 * Shared native dialog shell.
 * Uses strict DOM ID matching to avoid React state re-renders and prop-drilling.
 *
 * Escape handling: onCancel fires for showModal(), onKeyDown catches bubbled
 * events from focused children for show().  No auto-focus — elements with
 * autoFocus keep their focus when the dialog opens.
 */
export function DialogShell({
  id,
  ariaLabelledBy,
  children,
  className,
  fitContent = false,
}: DialogShellProps) {
  const closeDialog = useCallback((dialogElement: HTMLDialogElement) => {
    dialogElement.close();
  }, []);

  /* Handle Escape for show()-opened dialogs. onCancel only fires for showModal(). */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDialogElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialog(e.currentTarget);
      }
    },
    [closeDialog],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      const isBackdropClick = e.target === e.currentTarget;
      if (isBackdropClick) {
        closeDialog(e.currentTarget);
      }
    },
    [closeDialog],
  );

  return (
    <dialog
      id={id}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClick={handleBackdropClick}
      onCancel={(e) => {
        e.preventDefault();
        closeDialog(e.currentTarget);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "absolute left-0 top-0 z-40 m-0 flex-col open:flex",
        "rounded-none border-0 text-ui-textLight",
        fitContent
          ? "h-fit w-fit backdrop:bg-black/35"
          : "h-full w-full bg-black/80 backdrop:bg-transparent",
        className,
      )}
    >
      {children}
    </dialog>
  );
}
