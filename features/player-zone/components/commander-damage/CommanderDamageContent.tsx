"use client";

import { useMemo } from "react";
import { zoneStylesFor } from "@/features/player-zone/utils/zone-styles";
import { DEFAULT_PLAYER_COLOR } from "@/features/player-zone/constants/player";
import { usePlayerStateContext } from "@/features/player-zone/state/hooks";
import { useGameStateContext } from "@/features/game-shell/state/hooks";
import { CommanderDamageColumn } from "./CommanderDamageColumn";
import type { PlayerId } from "@/features/player-zone/types/player";
import { COMMANDER_LETHAL_DAMAGE } from "../../constants/commander";
import { cn } from "@/shared/lib/cn";

/**
 * @description
 * Client leaf inside the Commander Damage overlay.
 * Renders one column per commander in play in a 2-column grid.
 *
 * Context & Architecture:
 * - Extracts data preparation (styles, thresholds) out of the JSX tree.
 * - Uses useMemo to prevent recalculating styles and maps on unrelated re-renders.
 *
 * @see DESIGN.md §7.3, SPEC.md §5–6
 */
export function CommanderDamageContent() {
  const { state } = usePlayerStateContext();
  const { state: gameState } = useGameStateContext();

  const { playerCount, playerColors } = gameState;
  const { commanderDamage } = state;

  /*
   * 1. Data Preparation (Derived State)
   */
  const damageColumns = useMemo(() => {
    const damageMap = new Map(
      commanderDamage.map((cd) => [cd.playerId, cd.value]),
    );

    return Array.from({ length: playerCount }, (_, index) => {
      const pid = index as PlayerId;
      const damage = damageMap.get(pid) ?? 0;

      const ownerColor = playerColors[pid] ?? DEFAULT_PLAYER_COLOR;
      const { background: pillBg, textColor: pillFg } =
        zoneStylesFor(ownerColor);

      return {
        pid,
        damage,
        isLethal: damage >= COMMANDER_LETHAL_DAMAGE,
        pillBg,
        pillFg,
      };
    });
  }, [playerCount, playerColors, commanderDamage]);

  const ITEM_WIDTH =
    (playerCount >= 4 && state.playerId === 0) || state.playerId === 5
      ? "w-[30%] min-w-[140px]"
      : "w-[45%] min-w-[140px]";

  const JUSTIFY_CLASS =
    playerCount <= 4 || (playerCount >= 4 && state.playerId === 0)
      ? "justify-start"
      : "justify-center";

  /*
   * 2. Pure Declarative UI
   */
  return (
    <>
      <h2 id="commander-damage-title" className="sr-only">
        Commander Damage
      </h2>

      <div
        className={cn(
          "flex w-full max-w-lg flex-wrap items-center",
          JUSTIFY_CLASS,
          "gap-[clamp(1rem,5cqmin,2rem)]",
          "overflow-auto scrollbar-none py-4",
        )}
      >
        {damageColumns.map((col) => (
          <div key={col.pid} className={cn("flex justify-center", ITEM_WIDTH)}>
            <CommanderDamageColumn
              commanderPlayerId={col.pid}
              damage={col.damage}
              isLethal={col.isLethal}
              pillBg={col.pillBg}
              pillFg={col.pillFg}
            />
          </div>
        ))}
      </div>
    </>
  );
}
