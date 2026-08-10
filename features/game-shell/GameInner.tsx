"use client";

import { PropsWithChildren, useMemo } from "react";
import { PlayerRow } from "./PlayerRow";
import { useGameStateContext } from "@/features/game-shell/state/game-state-context";
import { PlayerId } from "@/features/player-zone/types/player";
import { getPlayerRotation } from "@/features/player-zone/hooks/use-player-config";

const TOP_ROW_COUNT_MAP: Record<number, number> = {
  2: 1, // 1 up, 1 down
  3: 1, // 1 up, 2 down
  4: 2, // 2 up, 2 down
  5: 3, // 3 up, 2 down
  6: 3, // 3 up, 3 down
};

/**
 * @description
 * Client boundary for the player grid. Reads GameState and renders rows.
 *
 * Context & Architecture:
 * - Donut Hole pattern: the belt (`children`) is a ReactNode from the RSC
 *   parent, preventing Server Components from becoming Client Components.
 * - Slices players into top and bottom rows via derived state.
 */
export function GameInner({ children }: Readonly<PropsWithChildren>) {
  const { state } = useGameStateContext();
  const { playerCount, version } = state;
  /* version: bumped on RESTART → keyed PlayerProviders remount with fresh defaults.
     Only version changes trigger remount; SET_PLAYER_COUNT/INITIAL_LIFE/COLOR
     re-render in place without destroying Provider state. */

  /*
   * Pre-compute the data structure before rendering.
   * This keeps the JSX purely declarative.
   */
  const { topSlots, bottomSlots } = useMemo(() => {
    const slots = Array.from({ length: playerCount }, (_, i) => ({
      playerId: i as PlayerId,
      rotation: getPlayerRotation(i, playerCount),
    }));

    const splitIndex =
      TOP_ROW_COUNT_MAP[playerCount] ?? Math.ceil(playerCount / 2);

    return {
      topSlots: slots.slice(0, splitIndex),
      bottomSlots: slots.slice(splitIndex),
    };
  }, [playerCount]);

  return (
    <>
      <PlayerRow slots={topSlots} version={version} />

      {/* §5 — Spellbook belt divider (RSC passed via children) */}
      {children}

      <PlayerRow slots={bottomSlots} version={version} isBottomSlot />
    </>
  );
}
