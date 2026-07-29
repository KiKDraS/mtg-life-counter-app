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

/* ── Per-commander column (owns its own useLifeAdjustment hook) ── */

interface CommanderDamageColumnProps {
  readonly commanderPlayerId: PlayerId;
  readonly damage: number;
  readonly isLethal: boolean;
  readonly pillBg: string;
  readonly pillFg: string;
}

function CommanderDamageColumn({
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

/* ── Content shell ── */

interface CommanderDamageContentProps {
  readonly playerId: number;
}

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
export function CommanderDamageContent({
  playerId,
}: CommanderDamageContentProps) {
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
