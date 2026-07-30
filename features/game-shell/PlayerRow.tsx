import { PlayerProvider } from "@/features/player-zone/state/player-state-context";
import { PlayerId } from "@/features/player-zone/types/player";
import { PlayerZone } from "@/features/player-zone/PlayerZone";
import { cn } from "@/shared/lib/cn";

interface PlayerSlot {
  readonly playerId: PlayerId;
  readonly rotation: 0 | 90 | -90 | 180;
}

interface PlayerRowProps {
  readonly slots: PlayerSlot[];
  readonly version: number;
}

type LayoutConfig = {
  readonly container: string;
  readonly getChildClass: (index: number) => string;
};

const ROW_LAYOUT_MAP: Record<number, LayoutConfig> = {
  1: {
    container: "flex h-full",
    getChildClass: () => "h-full w-full [container-type:size]",
  },
  2: {
    container: "flex h-full",
    getChildClass: () => "h-full w-full [container-type:size]",
  },
  3: {
    container: "grid h-full w-full grid-cols-2 grid-rows-3",
    getChildClass: (index) =>
      cn(
        "relative h-full w-full [container-type:size]",
        index === 0 ? "col-span-2" : "row-span-2",
      ),
  },
};

/**
 * @description
 * Extracted rendering logic for a row of players.
 * Eliminates JSX duplication and keeps the orchestrator component clean.
 */
export function PlayerRow({ slots, version }: PlayerRowProps) {
  const layout = ROW_LAYOUT_MAP[slots.length] ?? ROW_LAYOUT_MAP[1];

  return (
    <div className={layout.container}>
      {slots.map(({ playerId, rotation }, index) => (
        <div
          key={`${playerId}-${version}`}
          className={layout.getChildClass(index)}
          data-id={`player-${playerId}`}
        >
          <PlayerProvider playerIndex={playerId}>
            <PlayerZone playerId={playerId} rotation={rotation} />
          </PlayerProvider>
        </div>
      ))}
    </div>
  );
}
