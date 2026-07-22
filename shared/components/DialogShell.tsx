"use client";

import { useCallback } from "react";
import { cn } from "@/shared/lib/cn";

interface DialogShellProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly ariaLabelledBy: string;
  readonly children: React.ReactNode;
  readonly onClose?: () => void;
}

/**
 * Shared full-screen dialog shell.
 *
 * Encapsulates the native `<dialog>` wrapper with aria-modal, aria-labelledby,
 * and the common Tailwind shell classes. Every overlay modal in the app
 * (ColorPicker, LifeNumpad, Commander Damage, Counters, etc.) uses this as
 * its outer container.
 *
 * Tapping the backdrop (outside children) dismisses the dialog, just like
 * pressing Escape.
 *
 * @see DESIGN.md §6.1 — Dialog Pattern
 */
export function DialogShell({
  dialogRef,
  ariaLabelledBy,
  children,
  onClose,
}: DialogShellProps) {
  const close = useCallback(() => {
    dialogRef.current?.close();
  }, [dialogRef]);

  /* §6.1 — backdrop tap dismisses the dialog */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      const isBackdropClick = e.target === e.currentTarget;
      if (isBackdropClick) close();
    },
    [close],
  );

  /* §6.1 — Escape key dismisses the dialog.
   * React shims the native `cancel` event but it may not fire reliably across
   * all React versions. An explicit `onKeyDown` ensures Escape always closes. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDialogElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [close],
  );

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClose={onClose}
      onCancel={(e) => {
        /* Intercept the cancel event so we control the close ourselves.
         * The native close then fires `onClose` for cleanup. */
        e.preventDefault();
        close();
      }}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className={cn(
        "absolute top-0 left-0 m-0 w-full h-full open:flex flex-col",
        "border-0 rounded-none bg-black/80 text-ui-textLight",
      )}
    >
      {children}
    </dialog>
  );
}
