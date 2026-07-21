"use client";

import { useReducer, useRef, useCallback } from "react";
import { MANA, UI } from "@/shared/lib/constants/colors";
import type { ManaColor } from "@/shared/lib/constants/colors";
import { textColorFor } from "@/shared/lib/text-color-for";
import { useLifeAdjustment } from "@/features/life-counter/hooks/use-life-adjustment";
import { ColorPicker } from "./color-picker";
import type { PlayerColor } from "./color-picker";
import ColorSettings from "@/shared/components/icons/player-actions/Settings";

type PlayerState = {
  life: number;
  color: PlayerColor;
};

type PlayerAction =
  | { type: "ADJUST_LIFE"; delta: number }
  | { type: "SET_COLOR"; color: PlayerColor };

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "ADJUST_LIFE":
      return { ...state, life: state.life + action.delta };
    case "SET_COLOR":
      return { ...state, color: action.color };
  }
}

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

/* §6.5 — hard-stop diagonal bands: W 0‑20%, U 20‑40%, B 40‑60%, R 60‑80%, G 80‑100% */
const WUBRG_GRADIENT = `linear-gradient(to bottom right, ${MANA.w} 0%,${MANA.w} 20%,${MANA.u} 20%,${MANA.u} 40%,${MANA.b} 40%,${MANA.b} 60%,${MANA.r} 60%,${MANA.r} 80%,${MANA.g} 80%,${MANA.g} 100%)`;

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
  const [state, dispatch] = useReducer(playerReducer, {
    life: initialLife,
    color,
  });

  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const adjustment = useLifeAdjustment((delta) =>
    dispatch({ type: "ADJUST_LIFE", delta }),
  );

  const handleColorSelect = useCallback((result: PlayerColor) => {
    dispatch({ type: "SET_COLOR", color: result });
    dialogRef.current?.close();
  }, []);

  const isLethal = state.life <= 0;

  // Narrow the union: state.color is ManaColor in the else branch
  let background: string;
  let textColor: string;

  if (state.color === "wubrg") {
    background = WUBRG_GRADIENT;
    textColor = UI.textDark;
  } else {
    background = MANA[state.color];
    textColor = textColorFor(MANA[state.color]);
  }

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
          {...adjustment(-1)}
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
            onClick={() => dialogRef.current?.showModal()}
            className="absolute top-1 right-1 z-10 flex size-11 items-center justify-center rounded-full transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
          >
            <ColorSettings size={24} fill="currentColor" />
          </button>

          <button
            type="button"
            aria-label="+1 life"
            className={buttonClass}
            {...adjustment(1)}
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
