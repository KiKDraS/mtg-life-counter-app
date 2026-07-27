"use client";

import { useCallback } from "react";
import { cn } from "@/shared/lib/cn";

interface DialogShellProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly ariaLabelledBy: string;
  readonly children: React.ReactNode;
  readonly onClose?: () => void;
  readonly className?: string;
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
  className,
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

  /* §6.1 — Escape key dismisses the dialog */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDialogElement>) => {
      const isEscape = e.key === "Escape";
      if (isEscape) {
        e.preventDefault();
        close();
      }
    },
    [close],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClose={onClose}
      /* The jsx-a11y plugin does not list <dialog> as interactive, but the
       * HTML spec defines it as such — it is the correct host for these
       * handlers. Disabled the rule above for this element. */
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className={cn(
        "absolute top-0 left-0 m-0 w-full h-full open:flex flex-col",
        "border-0 rounded-none text-ui-textLight",
        className ?? "bg-black/80",
      )}
    >
      {children}
    </dialog>
  );
}
