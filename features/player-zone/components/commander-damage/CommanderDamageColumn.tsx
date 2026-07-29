"use client";

import { useCallback } from "react";
import { useLifeAdjustment } from "@/features/player-zone/hooks/use-life-adjustment";
import { INCREMENT_LIFE } from "@/features/player-zone/constants/life";
import { UI } from "@/shared/lib/constants/colors";
import PlaneswalkerSymbol from "@/shared/components/icons/PlaneswalkerSymbol";
import {
  usePlayerStateContext,
  adjustCommanderDamage,
} from "@/features/player-zone/state/player-state-context";
import type { PlayerId } from "@/features/player-zone/types/player";

interface CommanderDamageColumnProps {
  readonly commanderPlayerId: PlayerId;
  readonly damage: number;
  readonly isLethal: boolean;
  readonly pillBg: string;
  readonly pillFg: string;
}

/**
 * One commander damage column inside the 2-column grid.
 *
 * Owns its own {@link useLifeAdjustment} hook so CommanderDamageContent
 * can render one per commander without violating Rules of Hooks.
 *
 * §6 — commanderPlayerId identifies which commander dealt the damage.
 * Life reduction always applies to the current player (this zone).
 *
 * @see DESIGN.md §7.3, SPEC.md §5–6
 */
export function CommanderDamageColumn({
  commanderPlayerId,
  damage,
  isLethal,
  pillBg,
  pillFg,
}: CommanderDamageColumnProps) {
  const { dispatch } = usePlayerStateContext();
  const adjustment = useLifeAdjustment(
    useCallback(
      (delta: number) =>
        dispatch(adjustCommanderDamage(commanderPlayerId, delta)),
      [dispatch, commanderPlayerId],
    ),
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        {/* Pill — commander owner's mana color + PlaneswalkerSymbol */}
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-full"
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
          className="flex size-14 shrink-0 items-center justify-center text-4xl font-bold leading-none focus-visible:outline-0 select-none touch-manipulation"
          style={{ color: UI.textLight }}
          {...adjustment(INCREMENT_LIFE)}
        >
          +
        </button>
      </div>

      {/* Lethal badge — sits below the row */}
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
