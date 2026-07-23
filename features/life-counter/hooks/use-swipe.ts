"use client";

import { useEffect, useRef, useLayoutEffect } from "react";

/* §4.2 — Minimum horizontal movement (in pixels) required to qualify as a swipe. */
const SWIPE_THRESHOLD_PX = 10;

/* §4.2 — Maximum elapsed time (in milliseconds) allowed for a gesture to be considered a swipe rather than a slow drag. */
const SWIPE_TIMEOUT_MS = 300;

interface UseSwipeOptions {
  readonly onSwipeLeft: () => void;
  readonly onSwipeRight: () => void;
}

/**
 * @description
 * Hook to detect horizontal swipe gestures on a given element.
 *
 * Context & Architecture:
 * - Uses the "Latest Callback" ref pattern to avoid re-binding event listeners on every render.
 * - Marks pointer events as `passive: true` to prevent main-thread blocking and allow native scroll (pan-y).
 * - Evaluates physical distance and time elapsed to distinguish intentional swipes from accidental touches.
 *
 * @param {React.RefObject<HTMLElement | null>} ref - Reference to the target DOM element.
 * @param {UseSwipeOptions} options - Callbacks for swipe directions.
 * @returns {void}
 *
 * Usage:
 * ```tsx
 * const zoneRef = useRef<HTMLDivElement>(null);
 * useSwipe(zoneRef, { onSwipeLeft: () => ..., onSwipeRight: () => ... });
 * ```
 *
 *  @see DESIGN.md §7.2
 */
export function useSwipe(
  ref: React.RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight }: UseSwipeOptions,
): void {
  /*
   * Latest Callback Pattern: Store callbacks in a mutable ref.
   * This prevents unnecessary teardown/setup of event listeners when callback references change.
   */
  const callbacksRef = useRef({ onSwipeLeft, onSwipeRight });

  useLayoutEffect(() => {
    callbacksRef.current = { onSwipeLeft, onSwipeRight };
  }, [onSwipeLeft, onSwipeRight]);

  /* Single ref object for gesture state to minimize useRef hook memory overhead. */
  const gestureRef = useRef<{ startX: number; startTime: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /*
     * Touch Action manipulation:
     * Instruct the browser to handle vertical scrolling ('pan-y') natively,
     * while allowing JS to intercept and handle horizontal gestures (swipe left/right).
     */
    const previousTouchAction = el.style.touchAction;
    el.style.touchAction = "pan-y";

    const handlePointerDown = (e: PointerEvent) => {
      const isPrimaryClick = e.button === 0;
      if (!isPrimaryClick) return;

      gestureRef.current = { startX: e.clientX, startTime: performance.now() };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;

      /* Immediately clear gesture state to prevent double-firing or stale state. */
      gestureRef.current = null;

      /* Calculate raw physical and temporal vectors. */
      const distanceX = e.clientX - gesture.startX;
      const elapsedMs = performance.now() - gesture.startTime;

      /*
       * Self-documenting variables:
       * Explicitly map raw math to human-readable boolean states and magnitudes.
       */
      const isSwipeLeft = distanceX < 0;
      const horizontalDistance = isSwipeLeft ? -distanceX : distanceX;

      const isHorizontalEnough = horizontalDistance >= SWIPE_THRESHOLD_PX;
      const isFastEnough = elapsedMs <= SWIPE_TIMEOUT_MS;

      /* Evaluate gesture validity: abort if the gesture was too slow or too short. */
      if (!isHorizontalEnough || !isFastEnough) return;

      /* Trigger appropriate callback using the latest reference. */
      if (isSwipeLeft) {
        callbacksRef.current.onSwipeLeft();
      } else {
        callbacksRef.current.onSwipeRight();
      }
    };

    /* Abort in-progress gestures safely if the pointer leaves the element or is canceled by the OS. */
    const handleCancel = () => {
      gestureRef.current = null;
    };

    /* Use passive listeners to ensure native scrolling performance is not degraded. */
    const eventOptions: AddEventListenerOptions = { passive: true };

    el.addEventListener("pointerdown", handlePointerDown, eventOptions);
    el.addEventListener("pointerup", handlePointerUp, eventOptions);
    el.addEventListener("pointercancel", handleCancel, eventOptions);
    el.addEventListener("pointerleave", handleCancel, eventOptions);

    return () => {
      /* Restore original touch action on cleanup to avoid style side-effects. */
      el.style.touchAction = previousTouchAction;

      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("pointercancel", handleCancel);
      el.removeEventListener("pointerleave", handleCancel);
    };
  }, [ref]); // Hook dependencies remain clean; callbacks are safely accessed via ref.
}
