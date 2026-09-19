"use client";

import { useOptionalGameStateContext } from "@/features/game-shell/state/hooks";
import { useEffect } from "react";

/**
 * @description
 * Client leaf that hides the extended splash after IndexedDB hydration
 * lands (SPEC §4.6). Purpose: suppress the SSR §3-defaults frame vs the
 * hydrated-IndexedDB swap — the overlay must stay up for as long as the
 * hydrator is pending, not just until React mounts.
 *
 * Gate: while `isHydrated=false` the effect is a no-op — the cover stays
 * over the SSR defaults. HYDRATE always snaps `isHydrated=true` (reducer
 * sets it even on no-data / blocked-IDB fallback), so the gate can never
 * deadlock the splash. On the first `isHydrated=true` flush: flips
 * `pointer-events-none` + `opacity-100`→`opacity-0` (300ms CSS transition),
 * then removes the element at 310ms — 300ms fade + 10ms removal buffer.
 *
 * 310ms removal is cleared in the effect cleanup, so a re-run can't
 * stack/re-schedule a stale removal; the element-exists guard skips
 * scheduling once the overlay is gone.
 *
 * @see SPEC.md §4.6
 * @see DESIGN.md §9
 */
export const HideSplashScreenHandler = () => {
  const gameCtx = useOptionalGameStateContext();

  useEffect(() => {
    if (!gameCtx?.state.isHydrated) return;

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
