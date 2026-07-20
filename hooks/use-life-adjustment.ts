"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

type Direction = 1 | -1;

export type AdjustCallback = (delta: number) => void;

export interface LifeAdjustmentHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerLeave: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

/* §4.2 — tap = ±1; hold = repeat at ±10 after 1000ms. */
const HOLD_DELAY_MS = 1000;
const REPEAT_INTERVAL_MS = 100;
const HOLD_STEP = 10;

/**
 * §7.1 life adjustment gestures.
 *
 * Pointer taps fire ±1 on `pointerdown`; holding repeats at ±10 after 1000ms.
 * Keyboard activation (Enter/Space) fires a single ±1 via the click
 * handler, guarded by `event.detail === 0` so pointer taps never double-fire.
 *
 * Returns a factory: pass a direction, spread the result onto a `<button>`.
 */
export function useLifeAdjustment(
  onAdjust: AdjustCallback,
): (direction: Direction) => LifeAdjustmentHandlers {
  const onAdjustRef = useRef(onAdjust);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onAdjustRef.current = onAdjust;
  });

  const stopHold = useCallback(() => {
    if (delayTimerRef.current !== null) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (repeatTimerRef.current !== null) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopHold, [stopHold]);

  return useCallback(
    (direction: Direction): LifeAdjustmentHandlers => ({
      onPointerDown: () => {
        stopHold();
        onAdjustRef.current(direction);
        delayTimerRef.current = setTimeout(() => {
          repeatTimerRef.current = setInterval(() => {
            onAdjustRef.current(direction * HOLD_STEP);
          }, REPEAT_INTERVAL_MS);
        }, HOLD_DELAY_MS);
      },
      onPointerUp: stopHold,
      onPointerLeave: stopHold,
      onPointerCancel: stopHold,
      onClick: (event) => {
        // detail === 0 → keyboard-originated click; pointer taps already
        // fired on pointerdown, so only keyboard fires here.
        if (event.detail === 0) {
          onAdjustRef.current(direction);
        }
      },
    }),
    [stopHold],
  );
}
