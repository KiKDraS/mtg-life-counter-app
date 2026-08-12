"use client";

import { useOptionalGameStateContext } from "@/features/game-shell/state/hooks";
import { useEffect } from "react";

export const HideSplashScreenHandler = () => {
  const gameCtx = useOptionalGameStateContext();

  useEffect(() => {
    const splashScreen = document.getElementById("extended-splash-screen");

    if (splashScreen) {
      splashScreen.classList.add("pointer-events-none");
      splashScreen.classList.replace("opacity-100", "opacity-0");

      setTimeout(() => {
        splashScreen.remove();
      }, 310);
    }
  }, [gameCtx?.state.isHydrated]);
  return null;
};
