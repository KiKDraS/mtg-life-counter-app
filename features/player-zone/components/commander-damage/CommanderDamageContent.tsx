"use client";

import { zoneStylesFor } from "@/features/player-zone/utils/zone-styles";
import {
  usePlayerStateContext,
} from "@/features/player-zone/state/player-state-context";
import { useGameStateContext } from "@/features/game-shell/state/game-state-context";
import { CommanderDamageColumn } from "./CommanderDamageColumn";
import type { PlayerId } from "@/features/player-zone/types/player";
import type { CommanderDamage } from "@/features/player-zone/types/CommanderDamage";

/**
 * Client leaf inside the Commander Damage overlay.
 * Renders one column per commander in play in a 2-column grid.
 * Each column delegates to {@link CommanderDamageColumn} which owns its
 * own {@link useLifeAdjustment} hook.
 *
 * §6 — commanderPlayerId identifies which commander dealt the damage.
 * Life reduction always applies to the current player (this zone).
 *
 * @see DESIGN.md §7.3, SPEC.md §5–6
 */
export function CommanderDamageContent() {
  const { state } = usePlayerStateContext();
  const { state: gameState } = useGameStateContext();

  const damageMap: Record<number, CommanderDamage> = {};
  for (const cd of state.commanderDamage) {
    damageMap[cd.playerId] = cd;
  }

  const playerCount = gameState.playerCount;
  const colors = gameState.playerColors;

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-6">
      <h2
        id="commander-damage-title"
        className="text-heading font-bold text-ui-textLight"
      >
        Commander Damage
      </h2>

      {/*
       * Always 2-column grid. Rows wrap naturally as player count grows.
       */}
      <div className="grid w-full max-w-md grid-cols-2 gap-6 px-4">
        {Array.from({ length: playerCount }, (_, i) => {
          const pid = i as PlayerId;
          const entry = damageMap[pid];
          const damage = entry?.value ?? 0;
          const isLethal = damage >= 21;
          const ownerColor = colors[pid] ?? "r";
          const { background: pillBg, textColor: pillFg } =
            zoneStylesFor(ownerColor);

          return (
            <CommanderDamageColumn
              key={pid}
              commanderPlayerId={pid}
              damage={damage}
              isLethal={isLethal}
              pillBg={pillBg}
              pillFg={pillFg}
            />
          );
        })}
      </div>
    </div>
  );
}
