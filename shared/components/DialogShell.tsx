"use client";

import { useCallback } from "react";
import { cn } from "@/shared/lib/cn";

interface DialogShellProps {
  /** El ID único es crucial. Reemplaza por completo al useRef. */
  readonly id: string;
  readonly ariaLabelledBy: string;
  readonly children: React.ReactNode;
  readonly className?: string;
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
}: DialogShellProps) {
  // Se cierra de forma nativa sin afectar el estado de React
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
      // Si el clic fue exactamente en el <dialog> (el fondo) y no en sus hijos
      if (e.target === e.currentTarget) {
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
        // onCancel fires natively for showModal() — keep for that case
        e.preventDefault();
        closeDialog(e.currentTarget);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "absolute left-0 top-0 z-40 m-0 h-full w-full flex-col open:flex",
        "rounded-none border-0 text-ui-textLight backdrop:bg-transparent",
        className ?? "bg-black/80",
      )}
    >
      {children}
    </dialog>
  );
}
