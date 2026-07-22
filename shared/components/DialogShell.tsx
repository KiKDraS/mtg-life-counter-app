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
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      /* When the click lands directly on the <dialog> element (not a child),
       * the user tapped the empty backdrop area. Close the dialog — the native
       * close event fires, which triggers onClose for cleanup. */
      const isBackdropClick = e.target === e.currentTarget;
      if (isBackdropClick) {
        dialogRef.current?.close();
      }
    },
    [dialogRef],
  );

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClose={onClose}
      onClick={handleBackdropClick}
      className={cn(
        "absolute top-0 left-0 m-0 w-full h-full open:flex flex-col",
        "border-0 rounded-none bg-black/80 text-ui-textLight"
      )}
    >
      {children}
    </dialog>
  );
}
