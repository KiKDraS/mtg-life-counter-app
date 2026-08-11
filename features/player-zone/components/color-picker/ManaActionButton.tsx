"use client";

import { type ReactNode } from "react";
import { MANA_LABELS } from "@/shared/lib/constants/labels";
import type { ManaColor } from "@/shared/lib/constants/colors";
import { cn } from "@/shared/lib/cn";
import {
  usePlayerStateContext,
} from "@/features/player-zone/state/hooks";
import { setColor } from "@/features/player-zone/state/actions";
import {
  useGameStateContext,
} from "@/features/game-shell/state/hooks";
import { setGamePlayerColor } from "@/features/game-shell/state/actions";
import { DEFAULT_PLAYER_COLOR } from "@/features/player-zone/constants/player";
import { MANA_BTN_SIZE } from "../../constants/color";

interface ManaActionButtonProps {
  readonly color: ManaColor;
  readonly dialogId: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

/**
 * §6.5 / §8.5.1 — WYSIWYG multi-select toggle for a real mana color
 * (w/u/b/r/g). Computes `nextColors` locally and dispatches `setColor`
 * (replace) to PlayerState + `setGamePlayerColor` to GameState (commander
 * damage lookup). Does NOT close the dialog — only ✓ / Colorless / backdrop /
 * Escape close.
 *
 * Toggle rule (SPEC §8.5.1):
 * - Tap unselected: current = default `["r"]` → REPLACE `[color]`; otherwise ADD.
 * - Tap selected: single → NO-OP (keep last); multi → REMOVE.
 *
 * @see DESIGN.md §6.5, SPEC.md §8.5.1
 */
export function ManaActionButton({
  color,
  dialogId,
  children,
  className,
  style,
}: Readonly<ManaActionButtonProps>) {
  const { state, dispatch: playerDispatch } = usePlayerStateContext();
  const { dispatch: gameDispatch } = useGameStateContext();

  const isSelected = state.color.includes(color);

  const handleClick = () => {
    const current = state.color;
    const isPresent = current.includes(color);
    const isColorless = current.length === 1 && current[0] === "c";

    let nextColors: ManaColor[];
    if (isPresent) {
      // ponytail: single-color NO-OP ties to the §8.5.1 "can't remove last" rule.
      if (current.length === 1) return;
      nextColors = current.filter((c) => c !== color);
    } else if (isColorless) {
      // ponytail: replace colorless with the new color.
      nextColors = [color];
    } else {
      // ponytail: replace only when escaping default ["r"] (§3), else accumulate.
      const isDefault =
        current.length === 1 && current[0] === DEFAULT_PLAYER_COLOR[0];
      nextColors = isDefault ? [color] : [...current, color];
    }
    playerDispatch(setColor(nextColors));
    gameDispatch(setGamePlayerColor(state.playerId, nextColors));
  };

  return (
    <button
      type="button"
      aria-label={MANA_LABELS[color]}
      aria-pressed={isSelected}
      // dialogId consumed on the client; kept on element for testability/ID.
      data-dialog-id={dialogId}
      className={cn(
        className,
        MANA_BTN_SIZE,
        isSelected && "ring-4 ring-white/60",
      )}
      style={style}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
