"use client";

import { useCallback } from "react";
import { UI } from "@/shared/lib/constants/colors";
import { CounterRow } from "./CounterRow";
import {
  usePlayerStateContext,
  adjustCounter,
} from "@/features/life-counter/state/player-state-context";
interface CountersContentProps {
  readonly customCounterId: string;
}

/**
 * Client leaf inside the Counters overlay.
 * Reads counters from PlayerStateContext.
 * [+] button opens the CustomCounterModal via DOM ID.
 */
export function CountersContent({
  customCounterId,
}: CountersContentProps) {
  const { state, dispatch } = usePlayerStateContext();

  const handleOpenCustom = useCallback(() => {
    (document.getElementById(customCounterId) as HTMLDialogElement | null)
      ?.show();
  }, [customCounterId]);

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-8">
      <h2
        id="counters-title"
        className="text-heading font-bold text-ui-textLight"
      >
        Counters
      </h2>

      <div className="grid w-full max-w-lg grid-cols-2 gap-x-10 gap-y-6 px-4">
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
        className="absolute right-4 bottom-4 z-40 flex size-14 select-none touch-manipulation items-center justify-center rounded-full bg-white/10 text-4xl font-bold leading-none focus-visible:outline-none"
        style={{ color: UI.textLight }}
        onClick={handleOpenCustom}
      >
        +
      </button>
    </div>
  );
}
