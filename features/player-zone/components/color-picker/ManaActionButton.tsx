"use client";

import { type ReactNode } from "react";
import { MANA_LABELS } from "@/shared/lib/constants/labels";
import type { ManaColor } from "@/shared/lib/constants/colors";
import {
  usePlayerStateContext,
  setColor,
} from "@/features/player-zone/state/player-state-context";
import {
  useGameStateContext,
  setGamePlayerColor,
} from "@/features/game-shell/state/game-state-context";
import type { PlayerColor } from "@/features/player-zone/types/player";

interface ManaActionButtonProps {
  readonly color: PlayerColor;
  readonly dialogId: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

function isManaColor(c: PlayerColor): c is ManaColor {
  return c !== "wubrg";
}

/**
 * Client leaf for the color picker mana wheel.
 * Dispatches SET_COLOR to PlayerState and SET_GAME_PLAYER_COLOR to
 * GameState (for cross-player color lookup in CommanderDamage),
 * then closes the dialog natively via DOM ID.
 *
 * @see DESIGN.md §6.5
 */
export function ManaActionButton({
  color,
  dialogId,
  children,
  className,
  style,
}: ManaActionButtonProps) {
  const { state: playerState, dispatch: playerDispatch } =
    usePlayerStateContext();
  const { dispatch: gameDispatch } = useGameStateContext();

  const label = isManaColor(color) ? MANA_LABELS[color] : "WUBRG colors";

  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      style={style}
      onClick={() => {
        playerDispatch(setColor(color));
        gameDispatch(setGamePlayerColor(playerState.playerId, color));
        (
          document.getElementById(dialogId) as HTMLDialogElement | null
        )?.close();
      }}
    >
      {children}
    </button>
  );
}
