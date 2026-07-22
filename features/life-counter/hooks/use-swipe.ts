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

    /* Prevent the mobile browser from intercepting horizontal swipes for
     * back/forward navigation. pan-y = "the browser owns vertical panning;
     * we own horizontal gestures like swipe left/right." */
    const previousTouchAction = el.style.touchAction;
    el.style.touchAction = "pan-y";

    const handlePointerDown = (e: PointerEvent) => {
      const isPrimaryClick = e.button === 0;
      if (!isPrimaryClick) return;

      /* §4.2: ignore pointerdown that originated inside a +/- button, so
       * starting a horizontal drag on them doesn't fire ±1 (from
       * use-life-adjustment's pointerdown handler) AND open an overlay.
       * Swipes still work on the life total area and zone background. */
      const isLifeButton = (e.target as HTMLElement).closest(
        '[aria-label="-1 life"], [aria-label="+1 life"]',
      );
      if (isLifeButton) return;

      gestureRef.current = { startX: e.clientX, startTime: performance.now() };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;

      gestureRef.current = null;

      const distanceX = e.clientX - gesture.startX;
      const elapsedMs = performance.now() - gesture.startTime;
      const isSwipeLeft = distanceX < 0;
      const horizontalDistance = isSwipeLeft ? -distanceX : distanceX;

      const isHorizontalEnough = horizontalDistance >= SWIPE_THRESHOLD_PX;
      const isFastEnough = elapsedMs <= SWIPE_TIMEOUT_MS;

      if (!isHorizontalEnough || !isFastEnough) return;

      if (isSwipeLeft) {
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
      el.style.touchAction = previousTouchAction;
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("pointercancel", handleCancel);
      el.removeEventListener("pointerleave", handleCancel);
    };
  }, [ref, onSwipeLeft, onSwipeRight]);
}
