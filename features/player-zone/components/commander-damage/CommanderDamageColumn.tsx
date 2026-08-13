"use client";

import { useCallback } from "react";
import { useLifeAdjustment } from "@/features/player-zone/hooks/use-life-adjustment";
import { INCREMENT_LIFE } from "@/features/player-zone/constants/life";
import { UI } from "@/shared/lib/constants/colors";
import PlaneswalkerSymbol from "@/shared/components/icons/PlaneswalkerSymbol";
import { usePlayerStateContext } from "@/features/player-zone/state/hooks";
import { adjustCommanderDamage } from "@/features/player-zone/state/actions";
import type { PlayerId } from "@/features/player-zone/types/player";
import { cn } from "@/shared/lib/cn";
import { COMMANDER_BTN_SIZE } from "../../constants/commander";

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
    <div className="flex items-center justify-center gap-[clamp(0.25rem,4cqmin,1.5rem)]">
      {/* Pill — commander owner's mana color + PlaneswalkerSymbol */}
      <span
        className={cn(
          COMMANDER_BTN_SIZE,
          "flex items-center justify-items-center rounded-full",
          "inline-block",
        )}
        style={{ background: pillBg }}
      >
        <PlaneswalkerSymbol className={COMMANDER_BTN_SIZE} fill={pillFg} />
      </span>

      {/* Damage total */}
      <span
        className={cn(
          "text-heading font-black tabular-nums",
          "inline-block text-center leading-tight",
        )}
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
        className={cn(
          "text-heading font-black tabular-nums focus-visible:outline-0 select-none touch-manipulation",
          "inline-flex min-w-11 min-h-11 items-center justify-center leading-tight",
        )}
        style={{ color: UI.textLight }}
        {...adjustment(INCREMENT_LIFE)}
      >
        +
      </button>
    </div>
  );
}
