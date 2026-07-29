"use client";

import { useLifeAdjustment } from "@/features/player-zone/hooks/use-life-adjustment";
import {
  INCREMENT_COUNTER,
  DECREMENT_COUNTER,
  POISON_LETHAL,
  COUNTER_TYPE_CUSTOM,
} from "@/features/player-zone/constants/counter";
import { UI, MANA } from "@/shared/lib/constants/colors";
import PoisonSymbol from "@/shared/components/icons/counters/PoisonSymbol";
import EnergySymbol from "@/shared/components/icons/counters/EnergySymbol";
import ExperienceSymbol from "@/shared/components/icons/counters/ExperienceSymbol";
import TimeSymbol from "@/shared/components/icons/counters/TimeSymbol";
import type { Counter } from "@/features/player-zone/types/counter";

interface CounterRowProps {
  readonly counter: Counter;
  readonly onAdjust: (id: string, delta: number) => void;
}

/*
 * Shared Tailwind classes for layout elements.
 * Extracted to a constant to maintain JSX clean.
 */
const BORDERLESS_BTN_CLASS =
  "flex size-14 items-center justify-center text-4xl font-bold leading-none select-none touch-manipulation focus-visible:outline-none";

/*
 * Static style objects hoisted outside the component.
 * This prevents React from allocating new memory objects on every render.
 */
const CUSTOM_PILL_STYLE = { backgroundColor: MANA.c, color: UI.iconDark };
const LIGHT_TEXT_STYLE = { color: UI.textLight };

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
 * @description
 * §7.4 — A single counter row inside the Counters overlay.
 *
 * Context & Architecture:
 * - Hoists static style objects to module scope to reduce memory pressure.
 * - Eliminates Immediately Invoked Function Expressions (IIFEs) in JSX for cleaner rendering.
 * - Pre-computes derived states (e.g., accessible names) to avoid inline evaluation overhead.
 */
export function CounterRow({ counter, onAdjust }: CounterRowProps) {
  const adjustment = useLifeAdjustment((delta) => onAdjust(counter.id, delta));

  /* Self-documenting pre-computed values */
  const isCustom = counter.type === COUNTER_TYPE_CUSTOM;
  const accessibleName = counter.name ?? counter.type;
  const isLethal = counter.type === "poison" && counter.value >= POISON_LETHAL;

  /*
   * Sub-render function for the Icon/Pill.
   * Keeps the main return statement flat, declarative, and easy to read.
   */
  const renderIcon = () => {
    if (isCustom) {
      const initial = counter.name?.charAt(0).toUpperCase() ?? "?";
      return (
        <span
          className="flex size-14 items-center justify-center rounded-full text-2xl font-bold leading-none"
          style={CUSTOM_PILL_STYLE}
          aria-label={`${accessibleName} counter`}
        >
          {initial}
        </span>
      );
    }

    const iconData = COUNTER_ICON[counter.type];
    if (!iconData) return null;

    const { Component, label } = iconData;
    return <Component size={28} aria-label={label} />;
  };

  return (
    <div className="flex items-center gap-3">
      {renderIcon()}

      {/* Value */}
      <span
        className="min-w-[2ch] text-center text-display font-black tabular-nums leading-tight"
        style={{ color: isLethal ? UI.danger : UI.textLight }}
        aria-live="polite"
        aria-atomic="true"
      >
        {counter.value}
      </span>

      {/* [-] button */}
      <button
        type="button"
        aria-label={`-1 ${accessibleName} counter`}
        className={BORDERLESS_BTN_CLASS}
        style={LIGHT_TEXT_STYLE}
        {...adjustment(DECREMENT_COUNTER)}
      >
        −
      </button>

      {/* [+] button */}
      <button
        type="button"
        aria-label={`+1 ${accessibleName} counter`}
        className={BORDERLESS_BTN_CLASS}
        style={LIGHT_TEXT_STYLE}
        {...adjustment(INCREMENT_COUNTER)}
      >
        +
      </button>
    </div>
  );
}
