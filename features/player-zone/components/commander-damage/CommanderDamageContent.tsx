"use client";

import { useCallback } from "react";
import { useLifeAdjustment } from "@/features/player-zone/hooks/use-life-adjustment";
import { INCREMENT_LIFE } from "@/features/player-zone/constants/life";
import { zoneStylesFor } from "@/features/player-zone/utils/zone-styles";
import { UI } from "@/shared/lib/constants/colors";
import PlaneswalkerSymbol from "@/shared/components/icons/PlaneswalkerSymbol";
import {
  usePlayerStateContext,
  adjustCommanderDamage,
} from "@/features/player-zone/state/player-state-context";
import { useGameStateContext } from "@/features/game-shell/state/game-state-context";
import type { PlayerId } from "@/features/player-zone/types/player";
import type { CommanderDamage } from "@/features/player-zone/types/CommanderDamage";

interface CommanderDamageContentProps {
  readonly playerId: number;
}

/**
 * Client leaf inside the Commander Damage overlay.
 * Renders one column per commander in play.
 * Each column shows the commander owner's color pill, total damage,
 * and a [+] button.
 *
 * §6 — commanderPlayerId identifies which commander dealt the damage.
 * Life reduction always applies to the current player (this zone).
 *
 * @see DESIGN.md §7.3, SPEC.md §5–6
 */
export function CommanderDamageContent({
  playerId,
}: CommanderDamageContentProps) {
  const { state, dispatch } = usePlayerStateContext();
  const { state: gameState } = useGameStateContext();

  const damageMap: Record<number, CommanderDamage> = {};
  for (const cd of state.commanderDamage) {
    damageMap[cd.playerId] = cd;
  }

  const playerCount = gameState.playerCount;
  const colors = gameState.playerColors;

  /*
   * ponytail: one useLifeAdjustment hook per commander column, hardcoded
   * for 2p. Refactor to dynamic array when 3p+ lands (rules of hooks
   * prevent calling hooks in a loop).
   */
  const adj0 = useLifeAdjustment(
    useCallback(
      (delta: number) => dispatch(adjustCommanderDamage(0 as PlayerId, delta)),
      [dispatch],
    ),
  );
  const adj1 = useLifeAdjustment(
    useCallback(
      (delta: number) => dispatch(adjustCommanderDamage(1 as PlayerId, delta)),
      [dispatch],
    ),
  );

  const columns: { commanderPlayerId: PlayerId; adjustment: ReturnType<typeof useLifeAdjustment> }[] = [
    { commanderPlayerId: 0 as PlayerId, adjustment: adj0 },
    { commanderPlayerId: 1 as PlayerId, adjustment: adj1 },
  ];

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-6">
      <h2
        id="commander-damage-title"
        className="text-heading font-bold text-ui-textLight"
      >
        Commander Damage
      </h2>

      {/*
       * ponytail: 2-column grid for 2p. Convert to auto-fill when multi-player lands.
       */}
      <div className="grid w-full max-w-md grid-cols-2 gap-4 px-4">
        {columns.map(({ commanderPlayerId, adjustment }) => {
          const entry = damageMap[commanderPlayerId];
          const damage = entry?.value ?? 0;
          const isLethal = damage >= 21;
          const ownerColor = colors[commanderPlayerId] ?? "r";
          const { background: pillBg, textColor: pillFg } =
            zoneStylesFor(ownerColor);

          return (
            <div
              key={commanderPlayerId}
              className="flex flex-col items-center gap-3"
            >
              {/* Pill — commander owner's mana color + PlaneswalkerSymbol */}
              <span
                className="flex size-14 items-center justify-center rounded-full"
                style={{ backgroundColor: pillBg }}
              >
                <PlaneswalkerSymbol
                  size={28}
                  fill={pillFg}
                  className="flex items-center justify-center"
                />
              </span>

              {/* Damage total */}
              <span
                className="text-display font-black tabular-nums leading-tight"
                style={{ color: isLethal ? UI.danger : UI.textLight }}
                aria-live="polite"
                aria-atomic="true"
              >
                {damage}
              </span>

              {/* [+] button */}
              <button
                type="button"
                aria-label="+1 commander damage"
                className="flex size-14 items-center justify-center text-4xl font-bold leading-none focus-visible:outline-0 select-none touch-manipulation"
                style={{ color: UI.textLight }}
                {...adjustment(INCREMENT_LIFE)}
              >
                +
              </button>

              {/* Lethal badge */}
              {isLethal && (
                <p
                  className="text-body font-bold uppercase tracking-wider"
                  style={{ color: UI.danger }}
                >
                  Lethal — Game Over
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
