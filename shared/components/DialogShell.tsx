"use client";

import { useCallback, useEffect, useRef } from "react";
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
 * All event handlers are attached via native `addEventListener` in a
 * `useEffect` rather than JSX props, to avoid jsx-a11y lint rules that do not
 * recognise `<dialog>` as an interactive element.
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

  /* ponytail: keep the latest onClose in a ref so the effect closure always
   * calls the current version without re-attaching listeners. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const handleClose = () => onCloseRef.current?.();

    const handleCancel = (e: Event) => {
      e.preventDefault();
      close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isEscape = e.key === "Escape";
      if (isEscape) {
        e.preventDefault();
        close();
      }
    };

    const handleClick = (e: MouseEvent) => {
      const isBackdropClick = e.target === e.currentTarget;
      if (isBackdropClick) close();
    };

    el.addEventListener("close", handleClose);
    el.addEventListener("cancel", handleCancel);
    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("click", handleClick);

    return () => {
      el.removeEventListener("close", handleClose);
      el.removeEventListener("cancel", handleCancel);
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("click", handleClick);
    };
  }, [dialogRef, close]);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "absolute top-0 left-0 m-0 w-full h-full open:flex flex-col",
        "border-0 rounded-none bg-black/80 text-ui-textLight",
      )}
    >
      {children}
    </dialog>
  );
}
