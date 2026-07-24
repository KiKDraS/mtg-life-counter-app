"use client";

import { useCallback, useRef, type ReactNode } from "react";

interface OverlaySurfaceProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * §7.3 / §7.4 — Reusable overlay surface with tap-to-close.
 *
 * Tapping anywhere on the surface that is NOT a button closes the dialog.
 * Uses pointerdown target tracking to survive layout shifts during hold
 * acceleration (e.g. damage text widening).
 *
 * Relies on the parent's `closeOverlays()` for swipe-to-close — this wrapper
 * only handles tap-to-close on the overlay background.
 *
 * @see DESIGN.md §7.3, §7.4
 */
export function OverlaySurface({
  dialogRef,
  children,
  className = "",
}: OverlaySurfaceProps) {
  /*
   * Tap-to-close: close when tapping background, not when tapping [+] or
   * other interactive elements.
   * Swipe-to-close is handled by the parent zone's useSwipe + closeOverlays().
   *
   * We use the pointerdown target (not click target) to determine whether the
   * tap started on a button. This prevents layout shifts during hold&release
   * (e.g. damage text widening) from closing the dialog when the click target
   * has shifted away from the button.
   */
  const pointerDownOnButtonRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownOnButtonRef.current = !!(e.target as HTMLElement).closest(
      "button",
    );
  }, []);

  const handleClick = useCallback(() => {
    if (!pointerDownOnButtonRef.current) {
      dialogRef.current?.close();
    }
  }, [dialogRef]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions — ponytail: intentional tap-to-close on the overlay background. Keyboard users can close via Escape (DialogShell).
    <div
      className={`relative z-30 flex flex-1 flex-col items-center justify-center gap-8 px-6 bg-ui-overlay ${className}`}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}
