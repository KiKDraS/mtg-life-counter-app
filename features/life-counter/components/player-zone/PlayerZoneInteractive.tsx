"use client";

import { useRef, useCallback, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { UI } from "@/shared/lib/constants/colors";
import { useLifeAdjustment } from "@/features/life-counter/hooks/use-life-adjustment";
import {
  INCREMENT_LIFE,
  DECREMENT_LIFE,
} from "@/features/life-counter/constants/life";
import {
  usePlayerStateContext,
  adjustLife,
} from "@/features/life-counter/state/player-state-context";
import { POISON_LETHAL } from "@/features/life-counter/constants/counter";
import { useSwipe } from "@/features/life-counter/hooks/use-swipe";
import { zoneStylesFor } from "@/features/life-counter/utils/zone-styles";
import ColorSettings from "@/shared/components/icons/player-actions/Settings";

interface PlayerZoneIds {
  readonly colorPicker: string;
  readonly numpad: string;
  readonly commanderDmg: string;
  readonly counters: string;
}

interface PlayerZoneInteractiveProps {
  readonly playerId: 0 | 1 | 2 | 3 | 4 | 5;
  readonly rotation: 0 | 90 | -90 | 180;
  readonly ids: PlayerZoneIds;
  readonly children?: ReactNode;
}

const buttonClass = cn(
  "flex h-full w-full items-center justify-center text-4xl font-bold leading-none",
  "select-none touch-manipulation",
  "transition-shadow duration-150 active:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.08)]",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current",
);

/**
 * Client leaf that wraps the interactive zone content.
 *
 * Handles:
 * - Swipe gestures (open/close commander damage / counters overlays)
 * - Life adjustment (+/- buttons with hold acceleration)
 * - Life total display with double-tap for numpad
 * - Gear icon to open color picker
 *
 * Modals are rendered as siblings from the RSC PlayerZone shell.
 */
export function PlayerZoneInteractive({
  playerId,
  rotation,
  ids,
  children,
}: PlayerZoneInteractiveProps) {
  const { state, dispatch } = usePlayerStateContext();
  const zoneRef = useRef<HTMLDivElement | null>(null);

  const adjustment = useLifeAdjustment((delta) => dispatch(adjustLife(delta)));

  /* Open a dialog by ID — show() keeps it in DOM flow, bound to the zone div */
  const open = useCallback((dialogId: string) => {
    (document.getElementById(dialogId) as HTMLDialogElement | null)?.show();
  }, []);

  /* Close overlays if any are open — returns true if something was closed */
  const closeOverlays = useCallback(() => {
    const commander = document.getElementById(
      ids.commanderDmg,
    ) as HTMLDialogElement | null;
    const counters = document.getElementById(
      ids.counters,
    ) as HTMLDialogElement | null;

    if (commander?.open || counters?.open) {
      commander?.close();
      counters?.close();
      return true;
    }
    return false;
  }, [ids.commanderDmg, ids.counters]);

  const handleSwipeLeft = useCallback(() => {
    if (closeOverlays()) return;
    open(ids.commanderDmg);
  }, [closeOverlays, open, ids.commanderDmg]);

  const handleSwipeRight = useCallback(() => {
    if (closeOverlays()) return;
    open(ids.counters);
  }, [closeOverlays, open, ids.counters]);

  /* §7.2 — full-zone swipe gestures */
  useSwipe(zoneRef as React.RefObject<HTMLElement | null>, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });

  /* §7.3/§7.4 — lethal if life ≤ 0 OR commander damage ≥ 21 OR poison ≥ 10 */
  const poisonCounter = state.counters.find((c) => c.type === "poison");
  const isPoisonLethal = (poisonCounter?.value ?? 0) >= POISON_LETHAL;
  const isCommanderLethal = state.commanderDamage >= 21;
  const isLifeZeroOrBelow = state.life <= 0;
  const isLethal = isLifeZeroOrBelow || isCommanderLethal || isPoisonLethal;
  const { background, textColor } = zoneStylesFor(state.color);

  const handleLifeDoubleClick = useCallback(() => {
    open(ids.numpad);
  }, [open, ids.numpad]);

  const handleLifeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        open(ids.numpad);
        e.preventDefault();
      }
    },
    [open, ids.numpad],
  );

  const handleOpenColorPicker = useCallback(() => {
    open(ids.colorPicker);
  }, [open, ids.colorPicker]);

  return (
    <div
      ref={zoneRef}
      className="relative h-full w-full"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <section
        aria-label={`Player ${playerId + 1}: ${state.life} life`}
        className="grid h-full w-full grid-cols-3"
        style={{ background, color: textColor }}
      >
        <button
          type="button"
          aria-label="-1 life"
          className={buttonClass}
          {...adjustment(DECREMENT_LIFE)}
        >
          −
        </button>

        {/*
         * §4.2 life total — native <button> for a11y compliance.
         * tabIndex={-1}: not in sequential Tab order because single Enter/Space
         * does nothing (the gesture is double-click/tap). Keyboard users reach
         * exact life entry via the +/- buttons (hold → accelerate), so no
         * functionality is lost.
         */}
        <button
          type="button"
          tabIndex={-1}
          className="flex h-full flex-col items-center justify-center"
          onClick={(e) => {
            if (e.detail === 2) handleLifeDoubleClick();
          }}
          onKeyDown={handleLifeKeyDown}
        >
          <p
            aria-live="polite"
            aria-atomic="true"
            className="text-life leading-none font-black tabular-nums"
            style={{ color: isLethal ? UI.danger : textColor }}
          >
            {state.life}
          </p>
          {isCommanderLethal && state.life > 0 && (
            <span
              className="text-caption font-bold uppercase tracking-wider leading-tight"
              style={{ color: UI.danger }}
            >
              Commander Damage Lethal
            </span>
          )}
          {isPoisonLethal && state.life > 0 && (
            <span
              className="text-caption font-bold uppercase tracking-wider leading-tight"
              style={{ color: UI.danger }}
            >
              Poison Lethal
            </span>
          )}
        </button>

        <div className="relative flex h-full">
          {/* §4.2 gear icon — top-right, outside the + button hit area */}
          <button
            type="button"
            aria-label="Change color"
            onClick={handleOpenColorPicker}
            className="absolute top-1 right-1 z-10 flex size-11 items-center justify-center rounded-full transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
          >
            <ColorSettings size={24} fill="currentColor" />
          </button>

          <button
            type="button"
            aria-label="+1 life"
            className={buttonClass}
            {...adjustment(INCREMENT_LIFE)}
          >
            +
          </button>
        </div>
      </section>

      {/* Modal shells — passed as children from RSC PlayerZone, rendered inside
          the zone div so `absolute` positioning in DialogShell anchors here. */}
      {children}
    </div>
  );
}
