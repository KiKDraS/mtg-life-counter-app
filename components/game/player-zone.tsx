"use client";

import { useState } from "react";
import { MANA, UI, type ManaColor } from "@/lib/constants/colors";
import { textColorFor } from "@/lib/utils";
import { useLifeAdjustment } from "@/hooks/use-life-adjustment";

interface PlayerZoneProps {
  readonly playerNumber: 1 | 2 | 3 | 4 | 5 | 6;
  readonly color: ManaColor;
  readonly rotation?: 0 | 90 | -90 | 180;
  readonly initialLife?: number;
}

const buttonClass =
  "flex h-full w-full items-center justify-center text-4xl font-bold leading-none " +
  "select-none touch-manipulation " +
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
  // ponytail: zone-local state; lifted to game state machine with the board feature
  const [life, setLife] = useState(initialLife);
  const adjustment = useLifeAdjustment((delta) =>
    setLife((prev) => prev + delta),
  );

  const background = MANA[color];
  const textColor = textColorFor(background);
  const isLethal = life <= 0;

  return (
    <div
      className="h-full w-full"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* §4.2 swipe gestures: deferred to overlays feature */}
      <section
        aria-label={`Player ${playerNumber}: ${life} life`}
        className="grid h-full w-full grid-cols-3"
        style={{ backgroundColor: background, color: textColor }}
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
            {life}
          </p>
        </div>

        <div className="relative flex h-full">
          {/* §4.2 gear icon: deferred to color picker feature */}
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
    </div>
  );
}
