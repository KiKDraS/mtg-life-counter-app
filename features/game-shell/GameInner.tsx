"use client";

import { PropsWithChildren, useMemo } from "react";
import { PlayerRow } from "./PlayerRow";
import { useGameStateContext } from "@/features/game-shell/state/hooks";
import { PlayerStatesRegistry } from "@/features/persistence/player-states-registry";
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
  const { playerCount, version, isHydrated } = state;
  /* version: bumped on RESTART, SET_INITIAL_LIFE, SET_PLAYER_COUNT only (not
     HYDRATE — §9.9 chat key must stay stable across reload) → keyed
     PlayerProviders remount with fresh defaults. isHydrated: flips false→true
     when HYDRATE lands → remount re-runs lazy init so restored persisted state
     is read via hydratedPlayerStates. SET_GAME_PLAYER_COLOR re-renders in
     place without destroying Provider state. */

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
    <PlayerStatesRegistry>
      {/* §4.6 — rows gate on hydration: SSR = belt + empty zone area; rows
          mount once with restored values (no wrong-value frame, no jump). */}
      {state.isHydrated && (
        <PlayerRow slots={topSlots} version={version} isHydrated={isHydrated} />
      )}

      {/* §5 — Spellbook belt divider (RSC passed via children) */}
      {children}

      {state.isHydrated && (
        <PlayerRow
          slots={bottomSlots}
          version={version}
          isHydrated={isHydrated}
          isBottomSlot
        />
      )}
    </PlayerStatesRegistry>
  );
}
