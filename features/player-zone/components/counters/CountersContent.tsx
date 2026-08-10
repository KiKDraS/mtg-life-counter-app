"use client";

import { useCallback } from "react";
import { UI } from "@/shared/lib/constants/colors";
import { CounterRow } from "./CounterRow";
import {
  usePlayerStateContext,
  adjustCounter,
} from "@/features/player-zone/state/player-state-context";
import { cn } from "@/shared/lib/cn";
import { TEXT_CLASSES } from "../../constants/counter";
interface CountersContentProps {
  readonly customCounterId: string;
}

/**
 * Client leaf inside the Counters overlay.
 * Reads counters from PlayerStateContext.
 * [+] button opens the CustomCounterModal via DOM ID.
 */
export function CountersContent({ customCounterId }: CountersContentProps) {
  const { state, dispatch } = usePlayerStateContext();

  const handleOpenCustom = useCallback(() => {
    (
      document.getElementById(customCounterId) as HTMLDialogElement | null
    )?.show();
  }, [customCounterId]);

  return (
    <>
      <h2 id="counters-title" className="sr-only">
        Counters
      </h2>

      <div className="grid w-full max-w-lg grid-cols-1 grid-rows-3 @[250px]/zone:grid-cols-2 @[250px]/zone:grid-rows-none gap-6">
        {state.counters.map((counter) => (
          <CounterRow
            key={counter.id}
            counter={counter}
            onAdjust={(id, delta) => dispatch(adjustCounter(id, delta))}
          />
        ))}
      </div>

      {/* [+] button — fixed bottom-right */}
      <button
        type="button"
        aria-label="Add custom counter"
        className={cn(
          TEXT_CLASSES,
          "p-1.5 fixed right-2 bottom-2 @[250px]/zone:right-4 @[250px]/zone:bottom-4 z-40",
          "flex select-none touch-manipulation items-center justify-center rounded-full bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
          "zone-max-h-150-top",
        )}
        style={{ color: UI.textLight }}
        onClick={handleOpenCustom}
      >
        +
      </button>
    </>
  );
}
