"use client";

import { useRef, useCallback } from "react";
import { DialogShell } from "@/shared/components/DialogShell";
import {
  useLifeAdjustment,
} from "@/features/life-counter/hooks/use-life-adjustment";
import { INCREMENT_LIFE } from "@/features/life-counter/constants/life";
import { useSwipe } from "@/features/life-counter/hooks/use-swipe";
import { zoneStylesFor } from "@/features/life-counter/utils/zone-styles";
import { UI } from "@/shared/lib/constants/colors";
import PlaneswalkerSymbol from "@/shared/components/icons/PlaneswalkerSymbol";
import type { PlayerColor } from "@/features/life-counter/types/player";

interface CommanderDamageProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onClose: () => void;
  readonly opponentColor: PlayerColor;
  readonly damage: number;
  readonly onAdjust: (delta: number) => void;
}

/**
 * §7.3 — Commander Damage overlay.
 *
 * Full-screen dialog showing commander damage from each opponent.
 * For 2-player, a single column with opponent's color pill + damage + [+].
 * Swipe, backdrop click, or Escape dismisses.
 *
 * @see DESIGN.md §7.3
 */
export function CommanderDamage({
  dialogRef,
  onClose,
  opponentColor,
  damage,
  onAdjust,
}: CommanderDamageProps) {
  /* Swipe-close on the overlay content (§7.2) */
  const contentRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => {
    dialogRef.current?.close();
  }, [dialogRef]);

  useSwipe(contentRef as React.RefObject<HTMLElement | null>, {
    onSwipeLeft: close,
    onSwipeRight: close,
  });

  /* + button with hold acceleration — reuses useLifeAdjustment */
  const adjustment = useLifeAdjustment(onAdjust);

  const isLethal = damage >= 21;
  const { background: pillBg, textColor: pillFg } = zoneStylesFor(opponentColor);

  return (
    <DialogShell
      dialogRef={dialogRef}
      ariaLabelledBy="commander-damage-title"
      onClose={onClose}
    >
      <div
        ref={contentRef}
        className="flex flex-1 flex-col items-center justify-center gap-8 px-6 bg-ui-overlay"
      >
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

            {/* Damage total */}
            <span
              className="text-display font-black tabular-nums leading-tight"
              style={{ color: isLethal ? UI.danger : pillFg }}
              aria-live="polite"
              aria-atomic="true"
            >
              {damage}
            </span>

            {/* [+] button — tap=+1, hold=+10 after 1s */}
            <button
              type="button"
              aria-label="+1 commander damage"
              className="flex size-14 items-center justify-center rounded-lg text-4xl font-bold leading-none transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white select-none touch-manipulation"
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
            Lethal — Player loses
          </p>
        )}
      </div>
    </DialogShell>
  );
}
