"use client";

import { useRef, useCallback, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import {
  INCREMENT_LIFE,
  DECREMENT_LIFE,
} from "@/features/player-zone/constants/life";
import { usePlayerStateContext } from "@/features/player-zone/state/player-state-context";
import { POISON_LETHAL } from "@/features/player-zone/constants/counter";
import { useSwipe } from "@/features/player-zone/hooks/use-swipe";
import { zoneStylesFor } from "@/features/player-zone/utils/zone-styles";
import ColorSettings from "@/shared/components/icons/player-actions/Settings";
import { LifeAdjustmentButton } from "./LifeAdjustemntButton";
import { LifeTotalDisplay } from "./LifeTotalDisplay";

interface PlayerZoneIds {
  readonly colorPicker: string;
  readonly numpad: string;
  readonly commanderDmg: string;
  readonly counters: string;
}

interface PlayerZoneInteractiveProps {
  readonly playerId: 0 | 1 | 2 | 3 | 4 | 5;
  readonly rotation: 0 | 90 | -90 | 180;
  readonly ids: PlayerZoneIds;
  readonly children?: ReactNode;
}

/**
 * @description
 * Client leaf that wraps the interactive player zone content.
 *
 * Context & Architecture:
 * - Acts as an orchestrator for gestures and layout.
 * - Sub-components handle their specific DOM events and context interactions.
 */
export function PlayerZoneInteractive({
  playerId,
  rotation,
  ids,
  children,
}: PlayerZoneInteractiveProps) {
  const { state } = usePlayerStateContext();
  const zoneRef = useRef<HTMLDivElement>(null);

  /* 
    =================
      DOM Utilities 
    ================= 
  */

  const getDialog = (id: string) =>
    document.getElementById(id) as HTMLDialogElement | null;

  const openDialog = useCallback((dialogId: string) => {
    getDialog(dialogId)?.show();
  }, []);

  const closeOverlays = useCallback(() => {
    const commander = getDialog(ids.commanderDmg);
    const counters = getDialog(ids.counters);

    if (commander?.open || counters?.open) {
      commander?.close();
      counters?.close();
      return true;
    }
    return false;
  }, [ids.commanderDmg, ids.counters]);

  /* 
    ======================
      Gestures Handlers 
    ====================== 
  */
  const handleSwipe = useCallback(
    (targetDialogId: string) => {
      const isColorPickerOpen = getDialog(ids.colorPicker)?.open;
      if (isColorPickerOpen) return;

      const didCloseAnOverlay = closeOverlays();
      if (didCloseAnOverlay) return;

      openDialog(targetDialogId);
    },
    [ids.colorPicker, closeOverlays, openDialog],
  );

  const handleSwipeLeft = useCallback(() => {
    handleSwipe(ids.commanderDmg);
  }, [handleSwipe, ids.commanderDmg]);

  const handleSwipeRight = useCallback(() => {
    handleSwipe(ids.counters);
  }, [handleSwipe, ids.counters]);

  useSwipe(zoneRef, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });

  /* 
    =================
      Derived State 
    ================= 
  */
  const poisonCounter = state.counters.find((c) => c.type === "poison");
  const isPoisonLethal = (poisonCounter?.value ?? 0) >= POISON_LETHAL;
  const isCommanderLethal = state.commanderDamage.some(
    (cd) => cd.value >= 21,
  );
  const isLifeZeroOrBelow = state.life <= 0;
  const isLethal = isLifeZeroOrBelow || isCommanderLethal || isPoisonLethal;

  const { background, textColor } = zoneStylesFor(state.color);

  return (
    <div
      ref={zoneRef}
      className="relative h-full w-full"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <section
        aria-label={`Player ${playerId + 1}: ${state.life} life`}
        className="grid h-full w-full grid-cols-3"
        style={{ background, color: textColor }}
      >
        {/* Left Column */}
        <LifeAdjustmentButton
          delta={DECREMENT_LIFE}
          label="−"
          ariaLabel="-1 life"
        />

        {/* Center Column */}
        <LifeTotalDisplay
          life={state.life}
          textColor={textColor}
          isLethal={isLethal}
          isCommanderLethal={isCommanderLethal}
          isPoisonLethal={isPoisonLethal}
          onOpenNumpad={() => openDialog(ids.numpad)}
        />

        {/* Right Column */}
        <div className="relative flex h-full">
          <button
            type="button"
            aria-label="Change color"
            onClick={() => openDialog(ids.colorPicker)}
            className={cn(
              "absolute right-1 top-1 z-10 flex size-11 items-center justify-center rounded-full transition-colors",
              "hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current",
            )}
          >
            <ColorSettings size={24} fill="currentColor" />
          </button>

          <LifeAdjustmentButton
            delta={INCREMENT_LIFE}
            label="+"
            ariaLabel="+1 life"
          />
        </div>
      </section>

      {/* Heavy Modal shells */}
      {children}
    </div>
  );
}
