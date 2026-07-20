"use client";

import { useState } from "react";
import { MANA, UI, type ManaColor } from "@/lib/constants/colors";
import { textColorFor } from "@/lib/utils";
import { useLifeAdjustment } from "@/hooks/use-life-adjustment";

interface PlayerZoneProps {
  playerNumber: 1 | 2 | 3 | 4 | 5 | 6;
  color: ManaColor;
  rotation?: 0 | 90 | -90 | 180;
  initialLife?: number;
}

/**
 * §4.2 Player Zone — solid mana-color block with the life total as the hero.
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

  const buttonClass =
    "flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-current " +
    "px-4 text-4xl font-bold leading-none select-none touch-manipulation " +
    "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current";

  return (
    <div
      className="h-full w-full"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <section
        aria-label={`Player ${playerNumber}: ${life} life`}
        className="flex h-full w-full flex-col items-center justify-center gap-6"
        style={{ backgroundColor: background, color: textColor }}
      >
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-life leading-none font-black tabular-nums"
          style={{ color: isLethal ? UI.danger : textColor }}
        >
          {life}
        </p>
        <div className="flex items-center gap-10">
          <button
            type="button"
            aria-label="-1 life"
            className={buttonClass}
            {...adjustment(-1)}
          >
            −
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
    </div>
  );
}
