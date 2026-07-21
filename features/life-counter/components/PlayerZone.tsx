"use client";

import { useRef, useCallback } from "react";
import { UI } from "@/shared/lib/constants/colors";
import { useLifeAdjustment } from "@/features/life-counter/hooks/use-life-adjustment";
import {
  INCREMENT_LIFE,
  DECREMENT_LIFE,
} from "@/features/life-counter/constants/life";
import {
  usePlayerState,
  adjustLife,
  setColor,
} from "@/features/life-counter/hooks/use-player-state";
import { zoneStylesFor } from "@/features/life-counter/utils/zone-styles";
import { ColorPicker } from "./ColorPicker";
import type { PlayerColor } from "@/features/life-counter/types/player";
import ColorSettings from "@/shared/components/icons/player-actions/Settings";

interface PlayerZoneProps {
  readonly playerNumber: 1 | 2 | 3 | 4 | 5 | 6;
  readonly color: PlayerColor;
  readonly rotation?: 0 | 90 | -90 | 180;
  readonly initialLife?: number;
}

const buttonClass =
  "flex h-full w-full items-center justify-center text-4xl font-bold leading-none " +
  "select-none touch-manipulation " +
  "transition-shadow duration-150 active:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.08)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current";

/**
 * §4.2 Player Zone — three-column grid: [-] | life | [+].
 * Rotation is applied to the outer wrapper (§4.3) so the interior layout is
 * identical for every orientation.
 */
export function PlayerZone({
  playerNumber,
  color,
  rotation = 0,
  initialLife = 40,
}: PlayerZoneProps) {
  const [state, dispatch] = usePlayerState(initialLife, color);

  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const adjustment = useLifeAdjustment((delta) => dispatch(adjustLife(delta)));

  const handleColorSelect = useCallback(
    (result: PlayerColor) => {
      dispatch(setColor(result));
      dialogRef.current?.close();
    },
    [dispatch],
  );

  const isLethal = state.life <= 0;
  const { background, textColor } = zoneStylesFor(state.color);

  return (
    <div
      className="relative h-full w-full"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* §4.2 swipe gestures: deferred to overlays feature */}
      <section
        aria-label={`Player ${playerNumber}: ${state.life} life`}
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

        <div className="flex h-full items-center justify-center">
          <p
            aria-live="polite"
            aria-atomic="true"
            className="text-life leading-none font-black tabular-nums"
            style={{ color: isLethal ? UI.danger : textColor }}
          >
            {state.life}
          </p>
        </div>

        <div className="relative flex h-full">
          {/* §4.2 gear icon — top-right, outside the + button hit area */}
          <button
            type="button"
            aria-label="Change color"
            onClick={() => dialogRef.current?.show()}
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

      {/*
       * §6.5 — Color Picker modal.
       * One dialog per player zone — each zone manages its own color locally.
       */}
      <ColorPicker dialogRef={dialogRef} onSelect={handleColorSelect} />
    </div>
  );
}
