"use client";

import { useRef, useCallback, type PropsWithChildren } from "react";
import { cn } from "@/shared/lib/cn";
import {
  INCREMENT_LIFE,
  DECREMENT_LIFE,
} from "@/features/player-zone/constants/life";
import {
  PlayerState,
  usePlayerStateContext,
} from "@/features/player-zone/state/player-state-context";
import { POISON_LETHAL } from "@/features/player-zone/constants/counter";
import { COMMANDER_LETHAL_DAMAGE } from "@/features/player-zone/constants/commander";
import { useSwipe } from "@/features/player-zone/hooks/use-swipe";
import { zoneStylesFor } from "@/features/player-zone/utils/zone-styles";
import ColorSettings from "@/shared/components/icons/player-actions/Settings";
import { LifeAdjustmentButton } from "./LifeAdjustemntButton";
import { LifeTotalDisplay } from "./LifeTotalDisplay";
import { Counter } from "@/features/player-zone/types/counter";
import { CommanderDamage } from "@/features/player-zone/types/CommanderDamage";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface PlayerZoneIds {
  readonly colorPicker: string;
  readonly numpad: string;
  readonly commanderDmg: string;
  readonly counters: string;
}

interface PlayerZoneInteractiveProps extends PropsWithChildren {
  readonly ids: PlayerZoneIds;
}

// ============================================================================
// Calculation Helpers
// ============================================================================

const getDialog = (id: string) =>
  document.getElementById(id) as HTMLDialogElement | null;

const getDimensionClasses = (rotation: number) => {
  const isSideways = rotation === 90 || rotation === -90;
  return isSideways ? "w-[100cqh] h-[100cqw]" : "w-[100cqw] h-[100cqh]";
};

const getGearPositionClasses = (isOnBottomSlot: boolean, rotation: number) => {
  return (isOnBottomSlot && rotation === -90) ||
    (!isOnBottomSlot && rotation === 90)
    ? "right-6"
    : "";
};

const checkLethality = (state: PlayerState) => {
  const isPoisonLethal =
    (state.counters.find((c: Counter) => c.type === "poison")?.value ?? 0) >=
    POISON_LETHAL;
  const isCommanderLethal = state.commanderDamage.some(
    (cd: CommanderDamage) => cd.value >= COMMANDER_LETHAL_DAMAGE,
  );

  return {
    isPoisonLethal,
    isCommanderLethal,
    isLethal: state.life <= 0 || isCommanderLethal || isPoisonLethal,
  };
};

/**
 * @description
 * Client leaf that wraps the interactive player zone content.
 */
export function PlayerZoneInteractive({
  ids,
  children,
}: Readonly<PlayerZoneInteractiveProps>) {
  const {
    state,
    playerZoneRotation: rotation,
    isOnBottomSlot,
  } = usePlayerStateContext();
  const zoneRef = useRef<HTMLDivElement>(null);

  /* 
    ======================
      Gestures & Modals
    ====================== 
  */
  const openDialog = useCallback((dialogId: string) => {
    getDialog(dialogId)?.show();
  }, []);

  const handleSwipe = useCallback(
    (targetDialogId: string) => {
      if (getDialog(ids.colorPicker)?.open) return;

      const commander = getDialog(ids.commanderDmg);
      const counters = getDialog(ids.counters);

      if (commander?.open || counters?.open) {
        commander?.close();
        counters?.close();
        return; // Salida temprana si cerramos un modal
      }

      openDialog(targetDialogId);
    },
    [ids, openDialog],
  );

  useSwipe(zoneRef, {
    onSwipeLeft: useCallback(
      () => handleSwipe(ids.commanderDmg),
      [handleSwipe, ids],
    ),
    onSwipeRight: useCallback(
      () => handleSwipe(ids.counters),
      [handleSwipe, ids],
    ),
    rotation,
  });

  /* 
    =================
      Derived UI 
    ================= 
  */
  const { background, textColor } = zoneStylesFor(state.color);
  const { isPoisonLethal, isCommanderLethal, isLethal } = checkLethality(state);

  return (
    <div
      ref={zoneRef}
      className={cn(
        "relative top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        getDimensionClasses(rotation),
      )}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <section
        aria-label={`Player ${state.playerId + 1}: ${state.life} life`}
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
              "absolute right-1 top-1 z-10 flex w-[18cqmin] h-[18cqmin] max-w-11 max-h-11 items-center justify-center rounded-full transition-colors cursor-pointer",
              "hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current",
              getGearPositionClasses(isOnBottomSlot, rotation),
            )}
          >
            <ColorSettings className="w-full h-full" fill="currentColor" />
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
