"use client";

import { use } from "react";
import { PlayerContext } from "./context";
import type { PlayerContextValue } from "./types";

/**
 * Reads player state and dispatch from the nearest PlayerProvider.
 * Must be called within a component rendered inside PlayerProvider.
 */
export function usePlayerStateContext(): PlayerContextValue {
  const ctx = use(PlayerContext);
  if (!ctx)
    throw new Error(
      "usePlayerStateContext must be used within a <PlayerProvider>",
    );
  return ctx;
}
