"use client";

import { type ReactNode } from "react";
import { MANA_LABELS } from "@/shared/lib/constants/labels";
import type { ManaColor } from "@/shared/lib/constants/colors";
import {
  usePlayerStateContext,
  setColor,
} from "@/features/life-counter/state/player-state-context";
import type { PlayerColor } from "@/features/life-counter/types/player";

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
 * Dispatches SET_COLOR and closes the dialog natively via DOM ID.
 *
 * aria-label is derived from MANA_LABELS for mana colors; "wubrg" falls back
 * to a hardcoded label.
 */
export function ManaActionButton({
  color,
  dialogId,
  children,
  className,
  style,
}: ManaActionButtonProps) {
  const { dispatch } = usePlayerStateContext();

  const label = isManaColor(color)
    ? MANA_LABELS[color]
    : "All five colors";

  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      style={style}
      onClick={() => {
        dispatch(setColor(color));
        (document.getElementById(dialogId) as HTMLDialogElement | null)?.close();
      }}
    >
      {children}
    </button>
  );
}
