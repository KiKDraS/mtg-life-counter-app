"use client";

import { type ReactNode } from "react";
import type { ManaColor } from "@/shared/lib/constants/colors";
import { MANA_LABELS } from "@/shared/lib/constants/labels";
import {
  usePlayerStateContext,
} from "@/features/player-zone/state/hooks";
import { setColor } from "@/features/player-zone/state/actions";
import {
  useGameStateContext,
} from "@/features/game-shell/state/hooks";
import { setGamePlayerColor } from "@/features/game-shell/state/actions";

interface ColorlessButtonProps {
  readonly dialogId: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

/** §8.5.1 — Colorless single-tap colors. Dispatch, then close. */
const COLORLESS: ManaColor[] = ["c"];

/**
 * §8.5.1 — Colorless = single-tap-apply-and-close.
 * Dispatches `setColor(["c"])` + `setGamePlayerColor(playerId, ["c"])` then
 * closes the dialog by DOM id. Mirrors the close pattern of the original
 * ManaActionButton.
 *
 * @see DESIGN.md §6.5, SPEC.md §8.5.1
 */
export function ColorlessButton({
  dialogId,
  children,
  className,
  style,
}: Readonly<ColorlessButtonProps>) {
  const { state, dispatch: playerDispatch } = usePlayerStateContext();
  const { dispatch: gameDispatch } = useGameStateContext();

  const handleClick = () => {
    playerDispatch(setColor(COLORLESS));
    gameDispatch(setGamePlayerColor(state.playerId, COLORLESS));
    (document.getElementById(dialogId) as HTMLDialogElement | null)?.close();
  };

  return (
    <button
      type="button"
      aria-label={MANA_LABELS.c}
      data-dialog-id={dialogId}
      className={className}
      style={style}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}