"use client";

import { useCallback, useEffect } from "react";
import { UI } from "@/shared/lib/constants/colors";
import { CounterRow } from "./CounterRow";
import { usePlayerStateContext } from "@/features/player-zone/state/hooks";
import { adjustCounter } from "@/features/player-zone/state/actions";
import { cn } from "@/shared/lib/cn";
import type { PlayerZoneRotation } from "@/features/player-zone/types/player";

interface CountersContentProps {
  readonly dialogId: string;
  readonly customCounterId: string;
}

/*
 * §7.4 — [+] corner anchoring per zone rotation.
 * The dialog renders inside the zone div, which carries `transform:
 * rotate(θ)` (§4.3, PlayerZoneInteractive). Absolute/fixed children anchor in
 * that rotated space, so the local corner that maps to the dialog's
 * screen-space bottom-right differs per rotation — and the button must
 * counter-rotate so its glyph stays upright on screen. Sideways zones
 * (90/−90) are sized w-[100cqh] h-[100cqw], so the mapping is not the
 * rotation's naive transpose.
 */
const ADD_BUTTON_POSITION: Record<PlayerZoneRotation, string> = {
  0: "right-[clamp(0.5rem,4cqmin,1.5rem)] bottom-[clamp(0.5rem,4cqmin,1.5rem)]",
  90: "right-[clamp(0.5rem,4cqmin,1.5rem)] top-[clamp(0.5rem,4cqmin,1.5rem)] rotate-[-90deg]",
  180: "left-[clamp(0.5rem,4cqmin,1.5rem)] top-[clamp(0.5rem,4cqmin,1.5rem)] rotate-180",
  "-90": "left-[clamp(0.5rem,4cqmin,1.5rem)] bottom-[clamp(0.5rem,4cqmin,1.5rem)] rotate-90",
};

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
          "gap-[6cqmin]",
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

      {/* [+] button — bottom-right of the dialog (§7.4), ≥44×44 (§8.3) */}
      <button
        type="button"
        aria-label="Add custom counter"
        className={cn(
          "absolute z-40",
          ADD_BUTTON_POSITION[playerZoneRotation],
          "flex items-center justify-center rounded-full",
          "w-[clamp(2.75rem,8cqmin,3.5rem)] h-[clamp(2.75rem,8cqmin,3.5rem)]",
          "text-[clamp(1.5rem,6cqmin,2.25rem)]",
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
