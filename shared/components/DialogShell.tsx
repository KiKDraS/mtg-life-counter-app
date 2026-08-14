"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/cn";

interface DialogShellProps {
  readonly id: string;
  readonly ariaLabelledBy: string;
  readonly children: React.ReactNode;
  readonly className?: string;
  /**
   * Render the <dialog> into document.body via createPortal.
   * Escapes transformed/positioned ancestors (e.g. rotated player zones)
   * that would otherwise become the dialog's containing block and shrink
   * or rotate the full-screen overlay.
   */
  readonly portalToBody?: boolean;
}

/**
 * @description
 * Shared full-screen native dialog shell.
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
  portalToBody = false,
}: DialogShellProps) {
  /* Portal renders client-side only (no DOM node on the server). The dialog
     starts closed, so the one-frame mount delay is invisible. */
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount gate: render null on SSR/first paint, portal after
  useEffect(() => setMounted(true), []);

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

  const dialog = (
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
        "absolute left-0 top-0 z-40 m-0 h-full w-full flex-col open:flex",
        "rounded-none border-0 text-ui-textLight backdrop:bg-transparent",
        "bg-black/80",
        // Portal lands in the root stacking context — must beat the belt (z-50)
        portalToBody && "z-[60]",
        className,
      )}
    >
      {children}
    </dialog>
  );

  if (!portalToBody) return dialog;
  return mounted ? createPortal(dialog, document.body) : null;
}
