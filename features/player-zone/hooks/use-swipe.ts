"use client";

import { useEffect, useRef } from "react";
import { PlayerZoneRotation } from "../types/player";

/* §4.2 — Minimum horizontal movement (in pixels) required to qualify as a swipe. */
const SWIPE_THRESHOLD_PX = 10;

/* §4.2 — Maximum elapsed time (in milliseconds) allowed for a gesture to be considered a swipe rather than a slow drag. */
const SWIPE_TIMEOUT_MS = 300;

interface UseSwipeOptions {
  readonly onSwipeLeft: () => void;
  readonly onSwipeRight: () => void;
  /** §4.3 — Screen rotation angle for the player slot. Determines gesture mapping. */
  readonly rotation?: PlayerZoneRotation;
}

/**
 * @description
 * Hook to detect horizontal swipe gestures on a given element.
 *
 * Context & Architecture:
 * - Translates raw screen coordinates (e.clientX/Y) into the player's visual coordinate system based on their rotation.
 * - Dynamically adjusts `touch-action` to allow native vertical scrolling from the player's perspective.
 */
export function useSwipe(
  ref: React.RefObject<HTMLElement | null>,
  { onSwipeLeft, onSwipeRight, rotation = 0 }: UseSwipeOptions,
): void {
  const stateRef = useRef({
    callbacks: { onSwipeLeft, onSwipeRight },
    gesture: null as {
      startX: number;
      startY: number;
      startTime: number;
    } | null,
  });

  useEffect(() => {
    stateRef.current.callbacks = { onSwipeLeft, onSwipeRight };
  }, [onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /*
     * Touch Action manipulation:
     * Native vertical scroll ('pan-y') for normal/upside-down players.
     * Native horizontal scroll ('pan-x') for sideways players, because their
     * vertical visual axis aligns with the screen's horizontal axis.
     */
    const isSideways = rotation === 90 || rotation === -90;
    const previousTouchAction = el.style.touchAction;
    el.style.touchAction = isSideways ? "pan-x" : "pan-y";

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // Now tracking both X and Y to calculate rotation vectors
      stateRef.current.gesture = {
        startX: e.clientX,
        startY: e.clientY,
        startTime: performance.now(),
      };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const gesture = stateRef.current.gesture;
      if (!gesture) return;

      stateRef.current.gesture = null;

      // Raw physical vectors on the screen
      const rawDistanceX = e.clientX - gesture.startX;
      const rawDistanceY = e.clientY - gesture.startY;
      const elapsedMs = performance.now() - gesture.startTime;

      // Translate physical vectors to the player's logical point of view
      let logicalDeltaX = 0;
      let logicalDeltaY = 0;

      switch (rotation) {
        case 0: // Normal
          logicalDeltaX = rawDistanceX;
          logicalDeltaY = rawDistanceY;
          break;
        case 180: // Upside down
          logicalDeltaX = -rawDistanceX;
          logicalDeltaY = -rawDistanceY;
          break;
        case 90: // Player on the right side, looking left
          logicalDeltaX = rawDistanceY;
          logicalDeltaY = -rawDistanceX;
          break;
        case -90: // Player on the left side, looking right
          logicalDeltaX = -rawDistanceY;
          logicalDeltaY = rawDistanceX;
          break;
      }

      /*
       * Gesture Validation:
       * Abort if the movement was mostly vertical from the player's perspective,
       * preventing false positives while they scroll their life up/down.
       */
      if (Math.abs(logicalDeltaX) <= Math.abs(logicalDeltaY)) return;

      const isSwipeLeft = logicalDeltaX < 0;
      const horizontalDistance = Math.abs(logicalDeltaX);

      const isHorizontalEnough = horizontalDistance >= SWIPE_THRESHOLD_PX;
      const isFastEnough = elapsedMs <= SWIPE_TIMEOUT_MS;

      if (!isHorizontalEnough || !isFastEnough) return;

      if (isSwipeLeft) {
        stateRef.current.callbacks.onSwipeLeft();
      } else {
        stateRef.current.callbacks.onSwipeRight();
      }
    };

    const handleCancel = () => {
      stateRef.current.gesture = null;
    };

    const eventOptions: AddEventListenerOptions = { passive: true };

    el.addEventListener("pointerdown", handlePointerDown, eventOptions);
    el.addEventListener("pointerup", handlePointerUp, eventOptions);
    el.addEventListener("pointercancel", handleCancel, eventOptions);
    el.addEventListener("pointerleave", handleCancel, eventOptions);

    return () => {
      el.style.touchAction = previousTouchAction;
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("pointercancel", handleCancel);
      el.removeEventListener("pointerleave", handleCancel);
    };
  }, [ref, rotation]); // Re-binds physics if the player slot orientation changes
}
