"use client";

import { type ReactNode } from "react";
import { GameProvider, useGameStateContext } from "@/features/life-counter/state/game-state-context";
import { PlayerProvider } from "@/features/life-counter/state/player-state-context";
import { PlayerZone } from "@/features/life-counter/components/PlayerZone";
import { getPlayerRotation } from "@/features/life-counter/hooks/use-player-config";

/**
 * Reads GameState and renders the full player grid.
 *
 * Donut Hole client boundary: GameProvider wraps all player Providers.
 * The belt (`children`) is rendered between top and bottom rows — passed
 * as a ReactNode from the RSC parent so server components aren't imported
 * inside the client boundary.
 */
function GameInner({ children }: { readonly children: ReactNode }) {
  const { state } = useGameStateContext();
  const { playerCount, version } = state;
  /* version: bumped on RESTART → keyed PlayerProviders remount with fresh defaults.
     Only version changes trigger remount; SET_PLAYER_COUNT/INITIAL_LIFE/COLOR
     re-render in place without destroying Provider state. */

  const playerSlots = Array.from({ length: playerCount }, (_, i) => ({
    playerId: i as 0 | 1 | 2 | 3 | 4 | 5,
    rotation: getPlayerRotation(i, playerCount),
  }));

  const mid = Math.ceil(playerSlots.length / 2);
  const topSlots = playerSlots.slice(0, mid);
  const bottomSlots = playerSlots.slice(mid);

  return (
    <>
      {topSlots.map((slot) => (
        <div className="flex-1" key={`${slot.playerId}-${version}`}>
          <PlayerProvider playerIndex={slot.playerId}>
            <PlayerZone
              playerId={slot.playerId}
              rotation={slot.rotation}
            />
          </PlayerProvider>
        </div>
      ))}

      {/* §5 — Spellbook belt divider (RSC, passed from page.tsx) */}
      {children}

      {bottomSlots.map((slot) => (
        <div className="flex-1" key={`${slot.playerId}-${version}`}>
          <PlayerProvider playerIndex={slot.playerId}>
            <PlayerZone
              playerId={slot.playerId}
              rotation={slot.rotation}
            />
          </PlayerProvider>
        </div>
      ))}
    </>
  );
}

/**
 * Game shell — outermost client boundary.
 *
 * Wraps the entire game tree in a GameProvider so all children (PlayerProvider,
 * SpellbookMenu actions) can read and dispatch game-level state.
 * The belt (SpellbookMenu) is passed from the RSC parent as `children` to
 * preserve the Donut Hole pattern.
 */
export function GameShell({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <GameProvider>
      <GameInner>{children}</GameInner>
    </GameProvider>
  );
}
