"use client";

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
 * @see DESIGN.md §6.1 — Dialog Pattern
 */
export function DialogShell({
  dialogRef,
  ariaLabelledBy,
  children,
  onClose,
}: DialogShellProps) {
  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClose={onClose}
      className={cn(
        "absolute top-0 left-0 m-0 w-full h-full open:flex flex-col",
        "border-0 rounded-none bg-black/80 text-ui-textLight"
      )}
    >
      {children}
    </dialog>
  );
}
