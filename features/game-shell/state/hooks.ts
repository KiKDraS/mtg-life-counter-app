"use client";

import { use } from "react";
import { GameContext } from "./context";
import type { GameContextValue } from "./types";

/**
 * Reads game state and dispatch from the nearest GameProvider.
 * Throws if called outside a <GameProvider>.
 */
export function useGameStateContext(): GameContextValue {
  const ctx = use(GameContext);
  if (!ctx)
    throw new Error("useGameStateContext must be used within a <GameProvider>");
  return ctx;
}

/**
 * Non-throwing variant — returns null when called outside a <GameProvider>.
 * Always call this at the top level (Rules of Hooks compliant).
 */
export function useOptionalGameStateContext(): GameContextValue | null {
  return use(GameContext);
}
