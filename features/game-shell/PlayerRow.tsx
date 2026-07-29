import { PlayerProvider } from "@/features/player-zone/state/player-state-context";
import { PlayerId } from "@/features/player-zone/types/player";
import { PlayerZone } from "@/features/player-zone/PlayerZone";

interface PlayerSlot {
  readonly playerId: PlayerId;
  readonly rotation: 0 | 90 | -90 | 180;
}

interface PlayerRowProps {
  readonly slots: PlayerSlot[];
  readonly version: number;
}

/**
 * @description
 * Extracted rendering logic for a row of players.
 * Eliminates JSX duplication and keeps the orchestrator component clean.
 */
export function PlayerRow({ slots, version }: PlayerRowProps) {
  return (
    <>
      {slots.map(({ playerId, rotation }) => (
        <div className="flex-1" key={`${playerId}-${version}`}>
          <PlayerProvider playerIndex={playerId}>
            <PlayerZone playerId={playerId} rotation={rotation} />
          </PlayerProvider>
        </div>
      ))}
    </>
  );
}
