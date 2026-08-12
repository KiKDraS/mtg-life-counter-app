"use client";

import { useEffect, useRef } from "react";
import { PlayerZoneRotation } from "../types/player";

/* §4.2 — Minimum horizontal movement (in pixels) required to qualify as a swipe. */
const SWIPE_THRESHOLD_PX = 10;

/* §4.2 — Maximum elapsed time (in milliseconds) allowed for a gesture to be considered a swipe rather than a slow drag. */
const SWIPE_TIMEOUT_MS = 300;

/*
 * §4.3 — Rotation matrix mapping raw screen deltas to the player's logical
 * deltas. `x`/`y` hold the coefficients (from raw X, from raw Y) for each
 * logical axis. 90/-90 swap axes with sign flips; 180 inverts both.
 */
interface RotationTransform {
  readonly x: { readonly fromX: number; readonly fromY: number };
  readonly y: { readonly fromX: number; readonly fromY: number };
}

const ROTATION_MAP: Record<PlayerZoneRotation, RotationTransform> = {
  0: { x: { fromX: 1, fromY: 0 }, y: { fromX: 0, fromY: 1 } },
  90: { x: { fromX: 0, fromY: 1 }, y: { fromX: -1, fromY: 0 } },
  180: { x: { fromX: -1, fromY: 0 }, y: { fromX: 0, fromY: -1 } },
  "-90": { x: { fromX: 0, fromY: -1 }, y: { fromX: 1, fromY: 0 } },
};

/**
 * @description
 * Translates raw screen distances into player-logical distances per §4.3.
 * Lookup-based (O(1)); replaces the old inline switch on `rotation`.
 *
 * @param rotation Player slot screen rotation angle.
 * @param rawDistanceX Physical horizontal distance on screen (px).
 * @param rawDistanceY Physical vertical distance on screen (px).
 * @returns Logical deltas `{ x, y }` from the player's perspective.
 */
function rotateDeltas(
  rotation: PlayerZoneRotation,
  rawDistanceX: number,
  rawDistanceY: number,
): { x: number; y: number } {
  const { x, y } = ROTATION_MAP[rotation];
  return {
    x: x.fromX * rawDistanceX + x.fromY * rawDistanceY,
    y: y.fromX * rawDistanceX + y.fromY * rawDistanceY,
  };
}

/**
 * @description
 * §4.2 — True when the gesture is a valid swipe: horizontal-dominant from the
 * player's perspective, at least SWIPE_THRESHOLD_PX, within SWIPE_TIMEOUT_MS.
 *
 * @param logicalDeltaX Player-logical horizontal distance (px).
 * @param logicalDeltaY Player-logical vertical distance (px).
 * @param elapsedMs Gesture duration.
 * @returns Whether the gesture qualifies as a swipe.
 */
function isValidSwipe(logicalDeltaX: number, logicalDeltaY: number, elapsedMs: number): boolean {
  const isHorizontalDominant = Math.abs(logicalDeltaX) > Math.abs(logicalDeltaY);
  const isHorizontalEnough = Math.abs(logicalDeltaX) >= SWIPE_THRESHOLD_PX;
  const isFastEnough = elapsedMs <= SWIPE_TIMEOUT_MS;
  return isHorizontalDominant && isHorizontalEnough && isFastEnough;
}

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
     * Overlay dialogs set their own rotation-matched touch-action so the
     * close-axis swipe is never swallowed (see CountersContent).
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

    /*
     * Gesture end — shared by pointerup AND pointercancel.
     *
     * The browser fires pointercancel when it claims or aborts the drag for
     * native panning (scroll containers, touch-action pans). On rotated slots
     * the swipe-close axis can align with a native-pan axis, so a claimed
     * gesture would otherwise be swallowed.
     *
     * Chromium quirk: aborted drags fire pointercancel with (0,0) coordinates
     * (no final position) — evaluating from the start point would produce a
     * huge, direction-random delta. Those cancels carry no gesture data, so
     * skip them. Legit swipes always end in pointerup: the close axis is
     * never a claimable pan on its slot (CountersContent matches the dialog
     * touch-action to the rotation).
     */
    const handleGestureEnd = (e: PointerEvent) => {
      const gesture = stateRef.current.gesture;
      if (!gesture) return;

      stateRef.current.gesture = null;

      if (e.type === "pointercancel" && e.clientX === 0 && e.clientY === 0) {
        return;
      }

      // Raw physical vectors on the screen
      const rawDistanceX = e.clientX - gesture.startX;
      const rawDistanceY = e.clientY - gesture.startY;
      const elapsedMs = performance.now() - gesture.startTime;

      // Translate physical vectors to the player's logical point of view (§4.3)
      const { x: logicalDeltaX, y: logicalDeltaY } = rotateDeltas(rotation, rawDistanceX, rawDistanceY);

      if (!isValidSwipe(logicalDeltaX, logicalDeltaY, elapsedMs)) return;

      const isSwipeLeft = logicalDeltaX < 0;
      if (isSwipeLeft) {
        stateRef.current.callbacks.onSwipeLeft();
      } else {
        stateRef.current.callbacks.onSwipeRight();
      }
    };

    const handleLeave = () => {
      stateRef.current.gesture = null;
    };

    const eventOptions: AddEventListenerOptions = { passive: true };

    el.addEventListener("pointerdown", handlePointerDown, eventOptions);
    el.addEventListener("pointerup", handleGestureEnd, eventOptions);
    el.addEventListener("pointercancel", handleGestureEnd, eventOptions);
    el.addEventListener("pointerleave", handleLeave, eventOptions);

    return () => {
      el.style.touchAction = previousTouchAction;
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointerup", handleGestureEnd);
      el.removeEventListener("pointercancel", handleGestureEnd);
      el.removeEventListener("pointerleave", handleLeave);
    };
  }, [ref, rotation]); // Re-binds physics if the player slot orientation changes
}
