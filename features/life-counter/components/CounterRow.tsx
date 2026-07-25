"use client";

import { useLifeAdjustment } from "@/features/life-counter/hooks/use-life-adjustment";
import {
  INCREMENT_COUNTER,
  DECREMENT_COUNTER,
} from "@/features/life-counter/constants/counter";
import { UI } from "@/shared/lib/constants/colors";
import PoisonSymbol from "@/shared/components/icons/counters/PoisonSymbol";
import EnergySymbol from "@/shared/components/icons/counters/EnergySymbol";
import ExperienceSymbol from "@/shared/components/icons/counters/ExperienceSymbol";
import TimeSymbol from "@/shared/components/icons/counters/TimeSymbol";
import type { Counter } from "@/features/life-counter/types/counter";

interface CounterRowProps {
  readonly counter: Counter;
  readonly onAdjust: (id: string, delta: number) => void;
  readonly onRemove: (id: string) => void;
}

/* Map counter type to its icon component + label */
const COUNTER_ICON: Record<
  string,
  {
    Component: typeof PoisonSymbol;
    label: string;
  }
> = {
  poison: { Component: PoisonSymbol, label: "Poison counter" },
  energy: { Component: EnergySymbol, label: "Energy counter" },
  experience: { Component: ExperienceSymbol, label: "Experience counter" },
  time: { Component: TimeSymbol, label: "Time counter" },
};

/**
 * §7.4 — A single counter row inside the Counters overlay.
 *
 * Layout: [icon] [value] [−] [+] [✕]
 *
 * - Default counters show their SVG icon (no pill). Custom counters show the
 *   first letter of their name in a `#CAC5C0` pill with `iconDark` text.
 * - [-]/[+] are borderless with hold acceleration (useLifeAdjustment).
 * - [✕] removes custom counters / resets defaults to 0.
 *
 * @see DESIGN.md §7.4
 */
export function CounterRow({
  counter,
  onAdjust,
  onRemove,
}: CounterRowProps) {
  const adjustment = useLifeAdjustment((delta) =>
    onAdjust(counter.id, delta),
  );
  const isCustom = counter.type === "custom";

  /* - / + button shared — borderless, matches §4.2 / §7.3 / §7.4 */
  const borderlessBtn =
    "flex size-14 items-center justify-center text-4xl font-bold leading-none select-none touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <div className="flex items-center gap-3">
      {/* Icon / pill */}
      {isCustom ? (
        <span
          className="flex size-14 items-center justify-center rounded-full text-2xl font-bold leading-none"
          style={{
            backgroundColor: "#CAC5C0",
            color: UI.iconDark,
          }}
          aria-label={`${counter.name} counter`}
        >
          {counter.name?.charAt(0).toUpperCase() ?? "?"}
        </span>
      ) : (
        (() => {
          const icon = COUNTER_ICON[counter.type];
          if (!icon) return null;
          const { Component, label } = icon;
          return <Component size={28} aria-label={label} />;
        })()
      )}

      {/* Value */}
      <span
        className="min-w-[3ch] text-center text-display font-black tabular-nums leading-tight"
        style={{ color: UI.textLight }}
        aria-live="polite"
        aria-atomic="true"
      >
        {counter.value}
      </span>

      {/* [-] button — borderless */}
      <button
        type="button"
        aria-label={`-1 ${counter.name ?? counter.type} counter`}
        className={borderlessBtn}
        style={{ color: UI.textLight }}
        {...adjustment(DECREMENT_COUNTER)}
      >
        −
      </button>

      {/* [+] button — borderless */}
      <button
        type="button"
        aria-label={`+1 ${counter.name ?? counter.type} counter`}
        className={borderlessBtn}
        style={{ color: UI.textLight }}
        {...adjustment(INCREMENT_COUNTER)}
      >
        +
      </button>

      {/* [✕] delete — removes custom, resets default to 0 */}
      <button
        type="button"
        aria-label={`Remove ${counter.name ?? counter.type} counter`}
        className="flex size-10 items-center justify-center text-xl leading-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ color: UI.textLight }}
        onClick={() => onRemove(counter.id)}
      >
        ✕
      </button>
    </div>
  );
}
