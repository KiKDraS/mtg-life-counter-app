"use client";

import { PropsWithChildren } from "react";
import { PlayerRow } from "./PlayerRow";
import {
  GameProvider,
  useGameStateContext,
} from "@/features/game-shell/state/game-state-context";
import { PlayerId } from "@/features/player-zone/types/player";
import { getPlayerRotation } from "@/features/player-zone/hooks/use-player-config";

/**
 * @description
 * Reads GameState and renders the full player grid.
 *
 * Context & Architecture:
 * - Uses the Donut Hole pattern: the belt (`children`) is a ReactNode from
 *   the RSC parent, preventing Server Components from becoming Client Components.
 * - Slices players into top and bottom rows via derived state.
 */
function GameInner({ children }: Readonly<PropsWithChildren>) {
  const { state } = useGameStateContext();
  const { playerCount, version } = state;
  /* version: bumped on RESTART → keyed PlayerProviders remount with fresh defaults.
     Only version changes trigger remount; SET_PLAYER_COUNT/INITIAL_LIFE/COLOR
     re-render in place without destroying Provider state. */

  /*
   * Pre-compute the data structure before rendering.
   * This keeps the JSX purely declarative.
   */
  const playerSlots = Array.from({ length: playerCount }, (_, i) => ({
    playerId: i as PlayerId,
    rotation: getPlayerRotation(i, playerCount),
  }));

  const mid = Math.ceil(playerCount / 2);
  const topSlots = playerSlots.slice(0, mid);
  const bottomSlots = playerSlots.slice(mid);

  return (
    <>
      <PlayerRow slots={topSlots} version={version} />

      {/* §5 — Spellbook belt divider (RSC passed via children) */}
      {children}

      <PlayerRow slots={bottomSlots} version={version} />
    </>
  );
}

/**
 * @description
 * Game shell — outermost client boundary.
 * Wraps the game tree in a GameProvider while preserving the Donut Hole pattern.
 */
export function GameShell({ children }: Readonly<PropsWithChildren>) {
  return (
    <GameProvider>
      <GameInner>{children}</GameInner>
    </GameProvider>
  );
}
