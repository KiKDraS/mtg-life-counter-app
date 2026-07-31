import { PlayerProvider } from "@/features/player-zone/state/player-state-context";
import {
  PlayerId,
  PlayerZoneRotation,
} from "@/features/player-zone/types/player";
import { PlayerZone } from "@/features/player-zone/PlayerZone";
import { cn } from "@/shared/lib/cn";

interface PlayerSlot {
  readonly playerId: PlayerId;
  readonly rotation: PlayerZoneRotation;
}

interface PlayerRowProps {
  readonly slots: PlayerSlot[];
  readonly version: number;
  readonly isBottomSlot?: boolean;
}

type LayoutConfig = {
  readonly getContainerClass: (isBottom: boolean) => string;
  readonly getChildClass: (index: number, isBottom: boolean) => string;
};

const ROW_LAYOUT_MAP: Record<number, LayoutConfig> = {
  1: {
    getContainerClass: () => "flex h-full",
    getChildClass: () => "h-full w-full [container-type:size]",
  },
  2: {
    getContainerClass: () => "flex h-full",
    getChildClass: () => "h-full w-full [container-type:size]",
  },
  3: {
    getContainerClass: (isBottom) =>
      cn(
        "grid h-full w-full grid-cols-2",
        isBottom ? "grid-rows-[1.5fr_1fr]" : "grid-rows-[1fr_1.5fr]",
      ),
    getChildClass: (index, isBottom) => {
      const isBigSlot = isBottom ? index === 2 : index === 0;

      return cn(
        "relative h-full w-full [container-type:size]",
        isBigSlot && "col-span-2",
      );
    },
  },
};

/**
 * @description
 * Extracted rendering logic for a row of players.
 * Eliminates JSX duplication and keeps the orchestrator component clean.
 */
export function PlayerRow({
  slots,
  version,
  isBottomSlot = false,
}: PlayerRowProps) {
  const layout = ROW_LAYOUT_MAP[slots.length] ?? ROW_LAYOUT_MAP[1];

  return (
    <div className={layout.getContainerClass(isBottomSlot)}>
      {slots.map(({ playerId, rotation }, index) => (
        <div
          key={`${playerId}-${version}`}
          className={layout.getChildClass(index, isBottomSlot)}
          data-id={`player-${playerId}`}
        >
          <PlayerProvider
            playerIndex={playerId}
            playerZoneRotation={rotation}
            isOnBottomSlot={isBottomSlot}
          >
            <PlayerZone />
          </PlayerProvider>
        </div>
      ))}
    </div>
  );
}
