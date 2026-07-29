"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface OverlaySurfaceProps {
  /**
   * Reemplaza a dialogRef.
   * Permite que los Server Components pasen un simple string.
   */
  readonly dialogId: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * @description
 * §7.3 / §7.4 — Reusable overlay surface with tap-to-close.
 *
 * Context & Architecture:
 * - Operates as a Client Leaf wrapper for interactions.
 * - Replaces `dialogRef` with `dialogId` to decouple from React's ref tree,
 *   allowing pure Server Components to compose this layout without serialization errors.
 * - Tracks pointerdown targets to survive layout shifts during hold acceleration
 *   (e.g., when damage text widens and shifts the click target).
 *
 * @see DESIGN.md §7.3, §7.4
 */
export function OverlaySurface({
  dialogId,
  children,
  className,
}: OverlaySurfaceProps) {
  /*
   * Tap-to-close logic:
   * We track if the interaction started on a button. If the user holds a button
   * (to accelerate life total), the number grows, the layout shifts, and the
   * 'pointerup' or 'click' might register on the background instead of the button.
   * This ref ensures the dialog doesn't accidentally close in that scenario.
   */
  const pointerDownOnButtonRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownOnButtonRef.current = !!(e.target as HTMLElement).closest(
      "button",
    );
  }, []);

  const handleClick = useCallback(() => {
    if (!pointerDownOnButtonRef.current) {
      // Llamada directa al DOM en lugar de dialogRef.current?.close()
      const dialog = document.getElementById(
        dialogId,
      ) as HTMLDialogElement | null;
      dialog?.close();
    }
  }, [dialogId]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      className={cn(
        "relative z-30 flex flex-1 flex-col items-center justify-center gap-8 bg-ui-overlay px-6",
        className,
      )}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {/*
       * El servidor inyectará el contenido aquí.
       * React procesa esto sin problemas a través del boundary de RSC.
       */}
      {children}
    </div>
  );
}
