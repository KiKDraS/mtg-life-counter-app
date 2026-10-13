"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { LifeSign } from "../types/life";

type AdjustCallback = (delta: number) => void;

export interface LifeAdjustmentHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

/* §7.1 — hold: first ±10 at the native long-press instant (`contextmenu`,
 * ~500ms on Android) when the platform reports it; this fallback timer
 * (iOS/desktop) covers platforms that never do. Then ±10 every 500ms held. */
const HOLD_DELAY_MS = 1000;
const REPEAT_INTERVAL_MS = 500;
const HOLD_STEP = 10;

/**
 * §7.1 life adjustment gestures — tap ±1, hold ±10.
 *
 * Taps fire ±1 via `click` (pointer release), NOT on `pointerdown` — this
 * lets a concurrent horizontal swipe (detected by `useSwipe`) take priority:
 * the browser naturally cancels `click` when the pointer moves far enough to
 * be a drag/swipe.
 *
 * Hold: the first ±10 commits at the native long-press instant — platform
 * `contextmenu` (~500ms; `preventDefault` suppresses the native menu) — or,
 * when no `contextmenu` arrives (iOS/desktop), via the 1s fallback timer.
 * First trigger wins; the other finds `holdFiredRef` set and no-ops. After
 * the first commit ±10 repeats every 500ms while the hold stays active.
 * Committed ±10s stay on release — no cancel window, no preview — and the
 * release `click` is suppressed (±10 only, never ±11).
 *
 * `onContextMenu` ALWAYS calls `preventDefault` (kills the native menu /
 * callout during holds). It commits only when a hold is active and hasn't
 * fired yet — right-click (non-primary pointerdown), Shift+F10 and stale
 * events are swallowed without committing.
 *
 * Keyboard activation (Enter/Space) fires a single ±1 via `click` since no
 * pointer events precede it.
 *
 * Returns a factory: pass a direction, spread the result onto a `<button>`.
 *
 * @param onAdjust Committed delta callback (tap ±1, every hold step ±10).
 * @see DESIGN.md §7.1
 */
export function useLifeAdjustment(
  onAdjust: AdjustCallback,
): (direction: LifeSign) => LifeAdjustmentHandlers {
  const onAdjustRef = useRef(onAdjust);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /* True between primary pointerdown and up/leave/cancel — gates repeats. */
  const holdActiveRef = useRef(false);
  /* True once the first ±10 of this hold committed — dedupes the contextmenu
   * and fallback triggers, suppresses the release click's ±1. */
  const holdFiredRef = useRef(false);

  useEffect(() => {
    onAdjustRef.current = onAdjust;
  }, [onAdjust]);

  const clearTimers = useCallback(() => {
    for (const timer of timerRef.current) clearTimeout(timer);
    timerRef.current = [];
  }, []);

  const stopHold = useCallback(() => {
    clearTimers();
    holdActiveRef.current = false;
  }, [clearTimers]);

  useEffect(() => {
    return () => stopHold();
  }, [stopHold]);

  /* Repeat chain: ±10 every REPEAT_INTERVAL_MS while the hold stays active.
   * Self-chaining via ref keeps it stable across renders. */
  const scheduleRepeatRef = useRef<(step: number) => void>(() => {});
  useEffect(() => {
    scheduleRepeatRef.current = (step: number) => {
      const repeatTimer = setTimeout(() => {
        if (!holdActiveRef.current) return;
        onAdjustRef.current(step);
        scheduleRepeatRef.current(step);
      }, REPEAT_INTERVAL_MS);
      timerRef.current.push(repeatTimer);
    };
  });

  /* First ±10 of a hold: commits immediately, then starts the repeat chain.
   * Whichever trigger arrives first wins — the fallback timer is cleared so
   * it can't double-fire after a contextmenu commit. */
  const firstCommit = useCallback(
    (step: number) => {
      if (holdFiredRef.current) return;
      holdFiredRef.current = true;
      clearTimers();
      onAdjustRef.current(step);
      scheduleRepeatRef.current(step);
    },
    [clearTimers],
  );

  const handlePointerDown = useCallback(
    (direction: LifeSign) => {
      stopHold();
      holdActiveRef.current = true;
      holdFiredRef.current = false;
      /* Fallback trigger — cleared if `contextmenu` fires first. */
      const fallbackTimer = setTimeout(
        () => firstCommit(direction * HOLD_STEP),
        HOLD_DELAY_MS,
      );
      timerRef.current.push(fallbackTimer);
    },
    [stopHold, firstCommit],
  );

  const handleClick = useCallback(
    (direction: LifeSign, event: ReactMouseEvent<HTMLButtonElement>) => {
      /* If the hold already committed (±10), suppress the click's ±1 (both
       * firing on release would be ±11) AND stop propagation so
       * CommanderDamage's background onClick doesn't close the dialog when a
       * layout shift (damage text widening) moves the button away from the
       * pointer's elementFromPoint. Keyboard activation (no pointerdown)
       * always fires ±1 since holdFiredRef is untouched. */
      if (holdFiredRef.current) {
        event.stopPropagation();
        return;
      }
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
      onContextMenu: (event) => {
        /* Suppress the native menu / callout on ± buttons (§4.2). */
        event.preventDefault();
        if (holdActiveRef.current && !holdFiredRef.current) {
          firstCommit(direction * HOLD_STEP);
        }
      },
    }),
    [handlePointerDown, stopHold, handleClick, firstCommit],
  );
}
