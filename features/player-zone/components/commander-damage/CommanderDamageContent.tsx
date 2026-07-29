"use client";

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
import type { PlayerColor } from "@/features/player-zone/types/player";

interface CommanderDamageContentProps {
  readonly playerId: number;
}

/**
 * Returns opponent colors for a player. All Red until Color Picker syncs to
 * GameState via SET_PLAYER_COLOR.
 */
function opponentColors(playerId: number, playerCount: number): PlayerColor[] {
  return Array.from({ length: playerCount - 1 }, () => "r" as PlayerColor);
}

/**
 * Client leaf inside the Commander Damage overlay.
 * Reads damage from PlayerStateContext, opponent colors from GameStateContext.
 */
export function CommanderDamageContent({
  playerId,
}: CommanderDamageContentProps) {
  const { state, dispatch } = usePlayerStateContext();
  const { state: gameState } = useGameStateContext();

  const colors = opponentColors(playerId, gameState.playerCount);
  /* ponytail: single opponent column; map over `colors` when multi-player */
  const opponentColor = colors[0] ?? "r";
  const damage = state.commanderDamage;

  const adjustment = useLifeAdjustment((delta) =>
    dispatch(adjustCommanderDamage(delta)),
  );

  const isLethal = damage >= 21;
  const { background: pillBg, textColor: pillFg } =
    zoneStylesFor(opponentColor);

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-8">
      <h2
        id="commander-damage-title"
        className="text-heading font-bold text-ui-textLight"
      >
        Commander Damage
      </h2>

      {/*
       * ponytail: single column for 2-player.
       * Convert to CSS grid with auto-fill columns when multi-player lands.
       */}
      <ul className="flex flex-col items-center gap-4">
        <li className="flex items-center gap-4">
          {/* Pill — opponent's mana color with PlaneswalkerSymbol */}
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

          {/*
           * Damage total — sits on #1A1A1A overlay bg, NOT on the pill,
           * so always use UI.textLight (not pillFg).
           */}
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
        </li>
      </ul>

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
}
