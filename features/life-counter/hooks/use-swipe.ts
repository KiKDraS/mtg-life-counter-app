"use client";

import { useEffect, useRef } from "react";

/* §4.2 — minimum horizontal movement to qualify as a swipe */
const SWIPE_THRESHOLD_PX = 10;

/* §4.2 — maximum elapsed time for a gesture to be a swipe (not a slow drag) */
const SWIPE_TIMEOUT_MS = 300;

interface UseSwipeOptions {
  readonly onSwipeLeft: () => void;
  readonly onSwipeRight: () => void;
}

/**
 * §7.2 — swipe gesture hook.
 *
 * Attaches pointer-event listeners to the given element ref and fires
 * `onSwipeLeft` or `onSwipeRight` when the user swipes horizontally
 * (≥10px within 300ms). Vertical movement is ignored so taps and vertical
 * drags on the +/- columns don't trigger overlays.
 *
 * Returns nothing — callbacks fire directly.
 *
 * Usage:
 * ```tsx
 * const zoneRef = useRef<HTMLDivElement>(null);
 * useSwipe(zoneRef, { onSwipeLeft: () => ..., onSwipeRight: () => ... });
 * ```
 */
export function useSwipe(
  ref: React.RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight }: UseSwipeOptions,
): void {
  /* ponytail: one ref object for gesture state instead of useRef per field */
  const gestureRef = useRef<{ startX: number; startTime: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handlePointerDown = (e: PointerEvent) => {
      const isPrimaryClick = e.button === 0;
      if (!isPrimaryClick) return;
      gestureRef.current = { startX: e.clientX, startTime: performance.now() };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;

      gestureRef.current = null;

      const dx = e.clientX - gesture.startX;
      const dt = performance.now() - gesture.startTime;
      const absDx = dx < 0 ? -dx : dx;

      if (absDx < SWIPE_THRESHOLD_PX || dt > SWIPE_TIMEOUT_MS) return;

      if (dx < 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    };

    /* Cancel on pointercancel / leave so in-progress gestures don't fire */
    const handleCancel = () => {
      gestureRef.current = null;
    };

    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("pointerup", handlePointerUp);
    el.addEventListener("pointercancel", handleCancel);
    el.addEventListener("pointerleave", handleCancel);

    return () => {
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("pointercancel", handleCancel);
      el.removeEventListener("pointerleave", handleCancel);
    };
  }, [ref, onSwipeLeft, onSwipeRight]);
}
