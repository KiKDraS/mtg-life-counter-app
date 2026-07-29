"use client";

import { useMemo } from "react";
import { zoneStylesFor } from "@/features/player-zone/utils/zone-styles";
import { DEFAULT_PLAYER_COLOR } from "@/features/player-zone/constants/player";
import { usePlayerStateContext } from "@/features/player-zone/state/player-state-context";
import { useGameStateContext } from "@/features/game-shell/state/game-state-context";
import { CommanderDamageColumn } from "./CommanderDamageColumn";
import type { PlayerId } from "@/features/player-zone/types/player";
import { COMMANDER_LETHAL_DAMAGE } from "../../constants/commander";

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

  /*
   * 2. Pure Declarative UI
   */
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-6">
      <h2
        id="commander-damage-title"
        className="text-ui-textLight text-heading font-bold"
      >
        Commander Damage
      </h2>

      <div className="grid w-full max-w-md grid-cols-2 gap-6 px-4">
        {damageColumns.map((col) => (
          <CommanderDamageColumn
            key={col.pid}
            commanderPlayerId={col.pid}
            damage={col.damage}
            isLethal={col.isLethal}
            pillBg={col.pillBg}
            pillFg={col.pillFg}
          />
        ))}
      </div>
    </div>
  );
}
