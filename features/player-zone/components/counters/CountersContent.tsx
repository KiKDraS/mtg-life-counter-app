"use client";

import { useCallback, useEffect } from "react";
import { UI } from "@/shared/lib/constants/colors";
import { CounterRow } from "./CounterRow";
import { usePlayerStateContext } from "@/features/player-zone/state/hooks";
import { adjustCounter } from "@/features/player-zone/state/actions";
import { cn } from "@/shared/lib/cn";

interface CountersContentProps {
  readonly dialogId: string;
  readonly customCounterId: string;
}

/**
 * Client leaf inside the Counters overlay.
 * Reads counters from PlayerStateContext.
 * [+] button opens the CustomCounterModal via DOM ID.
 */
export function CountersContent({
  dialogId,
  customCounterId,
}: CountersContentProps) {
  const { state, playerZoneRotation, dispatch } = usePlayerStateContext();

  /*
   * Rotation-matched touch-action on the dialog (Chromium resolves it in
   * screen space, ignoring the zone's rotate transform). Without this, the
   * swipe-close axis ends up as a claimable/aborted pan and the browser
   * swallows the gesture with a (0,0) pointercancel.
   */
  useEffect(() => {
    const dialog = document.getElementById(
      dialogId,
    ) as HTMLDialogElement | null;
    if (!dialog) return;
    const isSideways = playerZoneRotation === 90 || playerZoneRotation === -90;
    dialog.style.touchAction = isSideways ? "pan-x" : "pan-y";
  }, [dialogId, playerZoneRotation]);

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

      <div
        className={cn(
          "flex w-full max-w-lg flex-wrap items-center justify-start",
          "gap-[10cqmin] p-2.25",
        )}
      >
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
          "fixed z-40",
          "right-[clamp(0.5rem,4cqmin,1.5rem)] bottom-[clamp(0.5rem,4cqmin,1.5rem)]",
          "flex aspect-square items-center justify-center rounded-full",
          "w-[clamp(1.8rem,8cqmin,2.8rem)] text-[clamp(1.5rem,6cqmin,2.25rem)]",
          "font-black leading-none",
          "bg-white/10 backdrop-blur-md",
          "select-none touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
        )}
        style={{ color: UI.textLight }}
        onClick={handleOpenCustom}
      >
        +
      </button>
    </>
  );
}
