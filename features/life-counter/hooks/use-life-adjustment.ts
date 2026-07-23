"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  INCREMENT_LIFE,
  DECREMENT_LIFE,
} from "@/features/life-counter/constants/life";

type LifeSign = typeof INCREMENT_LIFE | typeof DECREMENT_LIFE;

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
 * Taps fire ±1 via `click` (pointer release), NOT on `pointerdown` — this
 * lets a concurrent horizontal swipe (detected by `useSwipe`) take priority:
 * the browser naturally cancels `click` when the pointer moves far enough to
 * be a drag/swipe.
 *
 * Holding accelerates to ±10 after 1000ms via the interval timer. Once hold
 * fires, the pending ±1 on `click` is suppressed so the user doesn't get
 * both ±10 (from hold) AND ±1 (from click) on release.
 *
 * Keyboard activation (Enter/Space) fires a single ±1 via `click` since
 * no pointer events precede it.
 *
 * Returns a factory: pass a direction, spread the result onto a `<button>`.
 *
 * @see DESIGN.md §7.1
 */
export function useLifeAdjustment(
  onAdjust: AdjustCallback,
): (direction: LifeSign) => LifeAdjustmentHandlers {
  const onAdjustRef = useRef(onAdjust);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdFiredRef = useRef(false);

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
    holdFiredRef.current = false;
    let ticks = 0;
    const skipTicks = HOLD_DELAY_MS / REPEAT_INTERVAL_MS;
    timerRef.current = setInterval(() => {
      if (++ticks >= skipTicks) {
        holdFiredRef.current = true;
        onAdjustRef.current(direction * HOLD_STEP);
      }
    }, REPEAT_INTERVAL_MS);
  }, []);

  const handlePointerDown = useCallback(
    (direction: LifeSign) => {
      stopHold();
      /* ±1 does NOT fire here — let click (pointerup) handle it, so swipe
       * gestures starting on the button don't cause unwanted life changes. */
      startRepeat(direction);
    },
    [stopHold, startRepeat],
  );

  const handleClick = useCallback(
    (direction: LifeSign, _event: ReactMouseEvent<HTMLButtonElement>) => {
      /* If the hold timer already fired ±10, suppress the click's ±1 (both
       * firing on release would be ±11, confusing UX). Keyboard activation
       * (no pointerdown) always fires ±1 since holdFiredRef is untouched. */
      if (holdFiredRef.current) return;
      onAdjustRef.current(direction);
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
