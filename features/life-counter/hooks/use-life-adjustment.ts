"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

export const INCREMENT = 1 as const;
export const DECREMENT = -1 as const;
type LifeSign = typeof INCREMENT | typeof DECREMENT;

type AdjustCallback = (delta: number) => void;

export interface LifeAdjustmentHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
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
): (direction: LifeSign) => LifeAdjustmentHandlers {
  const onAdjustRef = useRef(onAdjust);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onAdjustRef.current = onAdjust;
  }, [onAdjust]);

  const stopHold = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopHold();
  }, [stopHold]);

  const startRepeat = useCallback((direction: LifeSign) => {
    // single interval: skip the first N ticks to build the hold delay
    let ticks = 0;
    const skipTicks = HOLD_DELAY_MS / REPEAT_INTERVAL_MS;
    timerRef.current = setInterval(() => {
      if (++ticks >= skipTicks) {
        onAdjustRef.current(direction * HOLD_STEP);
      }
    }, REPEAT_INTERVAL_MS);
  }, []);

  const handlePointerDown = useCallback(
    (direction: LifeSign) => {
      stopHold();
      onAdjustRef.current(direction);
      startRepeat(direction);
    },
    [stopHold, startRepeat],
  );

  const handleClick = useCallback(
    (direction: LifeSign, event: ReactMouseEvent<HTMLButtonElement>) => {
      const isKeyboardClick = event.detail === 0;
      if (isKeyboardClick) {
        onAdjustRef.current(direction);
      }
    },
    [],
  );

  return useCallback(
    (direction: LifeSign): LifeAdjustmentHandlers => ({
      onPointerDown: (event) => {
        const isPrimaryClick = event.button === 0;
        if (isPrimaryClick) handlePointerDown(direction);
      },
      onPointerUp: stopHold,
      onPointerLeave: stopHold,
      onPointerCancel: stopHold,
      onClick: (event) => handleClick(direction, event),
    }),
    [handlePointerDown, stopHold, handleClick],
  );
}
