"use client";

import { useOptionalGameStateContext } from "@/features/game-shell/state/hooks";
import { useEffect } from "react";

/**
 * @description
 * Client leaf that hides the extended splash on hydration (SPEC §4.6).
 *
 * First-flush semantics: effect runs on mount with `isHydrated=false` and
 * on every subsequent flip. Mount run IS the first hydration flush — hides
 * the overlay when the client tree hydrates. `isHydrated=true` flip before
 * the 310ms removal re-schedules it (single timer via cleanup); after
 * removal the guard makes it a no-op.
 *
 * Direct DOM side effects (no state, no refs): flips
 * `pointer-events-none` + `opacity-100`→`opacity-0` (300ms CSS transition),
 * then removes the element at 310ms — 300ms fade + 10ms removal buffer.
 *
 * 310ms removal is cleared in the effect cleanup, so a re-run
 * (isHydrated flip mid-fade) can't stack/re-schedule a stale removal, and
 * the element-exists guard skips scheduling once the overlay is gone.
 *
 * @see SPEC.md §4.6
 * @see DESIGN.md §9
 */
export const HideSplashScreenHandler = () => {
  const gameCtx = useOptionalGameStateContext();

  useEffect(() => {
    const splashScreen = document.getElementById("extended-splash-screen");

    if (!splashScreen) return;

    splashScreen.classList.add("pointer-events-none");
    splashScreen.classList.replace("opacity-100", "opacity-0");

    const removalTimer = setTimeout(() => {
      splashScreen.remove();
    }, 310);

    return () => clearTimeout(removalTimer);
  }, [gameCtx?.state.isHydrated]);
  return null;
};
