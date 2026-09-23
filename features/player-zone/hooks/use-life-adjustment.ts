"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { LifeSign } from "../types/life";

type AdjustCallback = (delta: number) => void;
type StageCallback = (delta: number) => void;

export interface LifeAdjustmentHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

/* §7.1 — tap = ±1; hold = staged ±10: stage at 1000ms, commit after 400ms more. */
const HOLD_DELAY_MS = 1000;
const COMMIT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 100;
const HOLD_STEP = 10;

/**
 * §7.1 life adjustment gestures — staged-commit hold.
 *
 * Taps fire ±1 via `click` (pointer release), NOT on `pointerdown` — this
 * lets a concurrent horizontal swipe (detected by `useSwipe`) take priority:
 * the browser naturally cancels `click` when the pointer moves far enough to
 * be a drag/swipe.
 *
 * Holding stages ±10 at 1000ms via `onStage` (preview) and commits only
 * after 400ms more holding (`onAdjust`). Release before commit cancels —
 * no ±10, no ±1. After each commit the next ±10 stages 100ms later with the
 * same 400ms commit window (setTimeout chain, per-step staging).
 *
 * `onStage` is called with the CUMULATIVE total (committed steps + staged
 * step) when a ±10 stages — the preview shows the whole amount the hold will
 * apply (holding to +20 previews "+20"), not the per-step ±10 — and with `0`
 * when it commits or cancels (clears preview). Optional — consumers that omit
 * it (commander/counters) still get the cancel window, just no preview.
 *
 * `holdFiredRef` is set at STAGE time (not commit), so release during the
 * staging window suppresses the pending ±1 on `click` too. Keyboard
 * activation (Enter/Space) fires a single ±1 via `click` since no pointer
 * events precede it.
 *
 * Returns a factory: pass a direction, spread the result onto a `<button>`.
 *
 * @param onAdjust  committed delta callback (fires only on commit).
 * @param onStage   preview callback — cumulative hold total when staged, 0 clears.
 * @see DESIGN.md §7.1
 */
export function useLifeAdjustment(
  onAdjust: AdjustCallback,
  onStage?: StageCallback,
): (direction: LifeSign) => LifeAdjustmentHandlers {
  const onAdjustRef = useRef(onAdjust);
  const onStageRef = useRef(onStage);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const holdFiredRef = useRef(false);
  /* §7.1 — committed steps during current hold, for cumulative preview. */
  const holdTotalRef = useRef(0);

  useEffect(() => {
    onAdjustRef.current = onAdjust;
  }, [onAdjust]);

  useEffect(() => {
    onStageRef.current = onStage;
  }, [onStage]);

  const clearTimers = useCallback(() => {
    for (const timer of timerRef.current) clearTimeout(timer);
    timerRef.current = [];
  }, []);

  const stopHold = useCallback(() => {
    clearTimers();
    /* 0 clears any staged preview (safe no-op when nothing staged). */
    onStageRef.current?.(0);
  }, [clearTimers]);

  useEffect(() => {
    return () => stopHold();
  }, [stopHold]);

  /* Commit timer (B): stage → 400ms → clear preview, commit, schedule next
   * stage (C) 100ms later, which re-enters the commit window. Loop B→C.
   * Self-reference via ref keeps the chain stable across renders. */
  const scheduleCommitRef = useRef<(step: number) => void>(() => {});
  useEffect(() => {
    scheduleCommitRef.current = (step: number) => {
      const commitTimer = setTimeout(() => {
        holdTotalRef.current += step;
        onStageRef.current?.(0);
        onAdjustRef.current(step);
        const nextStageTimer = setTimeout(() => {
          /* Preview = committed total + staged step (cumulative, not per-step). */
          onStageRef.current?.(holdTotalRef.current + step);
          scheduleCommitRef.current(step);
        }, REPEAT_INTERVAL_MS);
        timerRef.current.push(nextStageTimer);
      }, COMMIT_DELAY_MS);
      timerRef.current.push(commitTimer);
    };
  });

  const handlePointerDown = useCallback(
    (direction: LifeSign) => {
      stopHold();
      holdFiredRef.current = false;
      holdTotalRef.current = 0;
      const step = direction * HOLD_STEP;
      /* Stage timer (A): 1000ms → mark hold fired, show preview, arm commit. */
      const stageTimer = setTimeout(() => {
        holdFiredRef.current = true;
        onStageRef.current?.(holdTotalRef.current + step);
        scheduleCommitRef.current(step);
      }, HOLD_DELAY_MS);
      timerRef.current.push(stageTimer);
    },
    [stopHold],
  );

  const handleClick = useCallback(
    (direction: LifeSign, event: ReactMouseEvent<HTMLButtonElement>) => {
      /* If the hold already STAGED (±10), suppress the click's ±1 (both
       * firing on release would be ±11, confusing UX) AND stop propagation
       * so CommanderDamage's background onClick doesn't close the dialog
       * when a layout shift (damage text widening) moves the button away
       * from the pointer's elementFromPoint. Keyboard activation (no
       * pointerdown) always fires ±1 since holdFiredRef is untouched. */
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
    }),
    [handlePointerDown, stopHold, handleClick],
  );
}
