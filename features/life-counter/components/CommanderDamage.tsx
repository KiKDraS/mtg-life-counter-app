"use client";

import { useCallback, useRef } from "react";
import { DialogShell } from "@/shared/components/DialogShell";
import { useLifeAdjustment } from "@/features/life-counter/hooks/use-life-adjustment";
import { INCREMENT_LIFE } from "@/features/life-counter/constants/life";
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
 *
 * Close via:
 * - Tap background (non-button area) → close
 * - Swipe (handled by zone's useSwipe + closeOverlays)
 * - Escape (handled by DialogShell)
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
  const close = useCallback(() => {
    dialogRef.current?.close();
  }, [dialogRef]);

  /*
   * Tap-to-close: close when tapping background, not when tapping [+] or
   * other interactive elements.
   * Swipe-to-close is handled by the parent zone's useSwipe + closeOverlays().
   *
   * We use the pointerdown target (not click target) to determine whether the
   * tap started on a button. This prevents layout shifts during hold&release
   * (e.g. damage text widening) from closing the dialog when the click target
   * has shifted away from the button.
   */
  const pointerDownOnButtonRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownOnButtonRef.current = !!(e.target as HTMLElement).closest(
      "button",
    );
  }, []);

  const handleClick = useCallback(
    (_e: React.MouseEvent) => {
      if (!pointerDownOnButtonRef.current) {
        close();
      }
    },
    [close],
  );

  /* + button with hold acceleration — reuses useLifeAdjustment */
  const adjustment = useLifeAdjustment(onAdjust);

  const isLethal = damage >= 21;
  const { background: pillBg, textColor: pillFg } =
    zoneStylesFor(opponentColor);

  return (
    <DialogShell
      dialogRef={dialogRef}
      ariaLabelledBy="commander-damage-title"
      onClose={onClose}
    >
      {/*
       * z-30 ensures the overlay content stacks above the player zone's
       * gear icon (z-10) so the close-on-tap target isn't intercepted.
       */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions — ponytail: intentional tap-to-close on the overlay background. Keyboard users can close via Escape (DialogShell). */}
      <div
        className="relative z-30 flex flex-1 flex-col items-center justify-center gap-8 px-6 bg-ui-overlay"
        onPointerDown={handlePointerDown}
        onClick={handleClick}
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

            {/* [+] button — tap=+1, hold=+10 after 1s. Borderless — matches §4.2 zone buttons. */}
            <button
              type="button"
              aria-label="+1 commander damage"
              className="flex size-14 items-center justify-center text-4xl font-bold leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white select-none touch-manipulation"
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
    </DialogShell>
  );
}
