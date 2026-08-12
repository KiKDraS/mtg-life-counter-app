"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface OverlaySurfaceProps {
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
      const dialog = document.getElementById(
        dialogId,
      ) as HTMLDialogElement | null;
      dialog?.close();
    }
  }, [dialogId]);

  return (
    <div
      className={cn(
        "relative z-30 flex flex-1 flex-col items-center justify-center gap-8 bg-ui-overlay px-6",
        className,
      )}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}
