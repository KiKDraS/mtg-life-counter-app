"use client";

import { useRef, useCallback } from "react";
import { cn } from "@/shared/lib/cn";
import { UI } from "@/shared/lib/constants/colors";
import { useLifeAdjustment } from "@/features/life-counter/hooks/use-life-adjustment";
import {
  INCREMENT_LIFE,
  DECREMENT_LIFE,
} from "@/features/life-counter/constants/life";
import {
  usePlayerState,
  adjustLife,
  setLife,
  setColor,
  adjustCommanderDamage,
  adjustCounter,
  addCounter,
  removeCounter,
} from "@/features/life-counter/hooks/use-player-state";
import { POISON_LETHAL } from "@/features/life-counter/types/counter";
import { useSwipe } from "@/features/life-counter/hooks/use-swipe";
import { zoneStylesFor } from "@/features/life-counter/utils/zone-styles";
import { ColorPicker } from "./ColorPicker";
import { LifeNumpad } from "./LifeNumpad";
import { CommanderDamage } from "./CommanderDamage";
import { Counters } from "./Counters";
import type { PlayerColor } from "@/features/life-counter/types/player";
import ColorSettings from "@/shared/components/icons/player-actions/Settings";

interface PlayerZoneProps {
  readonly playerNumber: 1 | 2 | 3 | 4 | 5 | 6;
  readonly color: PlayerColor;
  readonly opponentColor: PlayerColor;
  readonly rotation?: 0 | 90 | -90 | 180;
  readonly initialLife?: number;
}

const buttonClass = cn(
  "flex h-full w-full items-center justify-center text-4xl font-bold leading-none",
  "select-none touch-manipulation",
  "transition-shadow duration-150 active:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.08)]",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current",
);

/**
 * §4.2 Player Zone — three-column grid: [-] | life | [+].
 * Rotation is applied to the outer wrapper (§4.3) so the interior layout is
 * identical for every orientation.
 *
 * @see DESIGN.md §4 — Player Zone
 */
export function PlayerZone({
  playerNumber,
  color,
  opponentColor,
  rotation = 0,
  initialLife = 40,
}: PlayerZoneProps) {
  const [state, dispatch] = usePlayerState(initialLife, color);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const numpadRef = useRef<HTMLDialogElement | null>(null);
  const commanderRef = useRef<HTMLDialogElement | null>(null);
  const countersRef = useRef<HTMLDialogElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);

  const adjustment = useLifeAdjustment((delta) => dispatch(adjustLife(delta)));

  const handleNumpadConfirm = useCallback(
    (value: number) => dispatch(setLife(value)),
    [dispatch],
  );

  const handleColorSelect = useCallback(
    (result: PlayerColor) => {
      dispatch(setColor(result));
      dialogRef.current?.close();
    },
    [dispatch],
  );

  /* Helper shared by both swipe directions — closes both overlays if any is open */
  const closeOverlays = () => {
    if (commanderRef.current?.open || countersRef.current?.open) {
      commanderRef.current?.close();
      countersRef.current?.close();
      return true;
    }
    return false;
  };

  const handleSwipeLeft = useCallback(() => {
    if (closeOverlays()) return;
    commanderRef.current?.show();
  }, []);

  const handleSwipeRight = useCallback(() => {
    if (closeOverlays()) return;
    countersRef.current?.show();
  }, []);

  /* §7.2 — full-zone swipe gestures */
  useSwipe(zoneRef as React.RefObject<HTMLElement | null>, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });

  /* §7.3/§7.4 — lethal if life ≤ 0 OR commander damage ≥ 21 OR poison ≥ 10 */
  const poisonCounter = state.counters.find((c) => c.type === "poison");
  const isPoisonLethal = (poisonCounter?.value ?? 0) >= POISON_LETHAL;
  const isLethal =
    state.life <= 0 || state.commanderDamage >= 21 || isPoisonLethal;
  const isCommanderLethal = state.commanderDamage >= 21;
  const { background, textColor } = zoneStylesFor(state.color);

  return (
    <div
      ref={zoneRef}
      className="relative h-full w-full"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <section
        aria-label={`Player ${playerNumber}: ${state.life} life`}
        className="grid h-full w-full grid-cols-3"
        style={{ background, color: textColor }}
      >
        <button
          type="button"
          aria-label="-1 life"
          className={buttonClass}
          {...adjustment(DECREMENT_LIFE)}
        >
          −
        </button>

        {/*
         * §4.2 life total — native <button> for a11y compliance.
         * tabIndex={-1}: not in sequential Tab order because single Enter/Space
         * does nothing (the gesture is double-click/tap). Keyboard users reach
         * exact life entry via the +/- buttons (hold → accelerate), so no
         * functionality is lost.
         */}
        <button
          type="button"
          tabIndex={-1}
          className="flex h-full flex-col items-center justify-center"
          onClick={(e) => {
            const isDoubleClick = e.detail === 2;
            if (isDoubleClick) numpadRef.current?.show();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              numpadRef.current?.show();
              e.preventDefault();
            }
          }}
        >
          <p
            aria-live="polite"
            aria-atomic="true"
            className="text-life leading-none font-black tabular-nums"
            style={{ color: isLethal ? UI.danger : textColor }}
          >
            {state.life}
          </p>
          {isCommanderLethal && state.life > 0 && (
            <span
              className="text-caption font-bold uppercase tracking-wider leading-tight"
              style={{ color: UI.danger }}
            >
              Commander Damage Lethal
            </span>
          )}
          {isPoisonLethal && state.life > 0 && (
            <span
              className="text-caption font-bold uppercase tracking-wider leading-tight"
              style={{ color: UI.danger }}
            >
              Poison Lethal
            </span>
          )}
        </button>

        <div className="relative flex h-full">
          {/* §4.2 gear icon — top-right, outside the + button hit area */}
          <button
            type="button"
            aria-label="Change color"
            onClick={() => dialogRef.current?.show()}
            className="absolute top-1 right-1 z-10 flex size-11 items-center justify-center rounded-full transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
          >
            <ColorSettings size={24} fill="currentColor" />
          </button>

          <button
            type="button"
            aria-label="+1 life"
            className={buttonClass}
            {...adjustment(INCREMENT_LIFE)}
          >
            +
          </button>
        </div>
      </section>

      {/*
       * §6.5 — Color Picker modal.
       * One dialog per player zone — each zone manages its own color locally.
       */}
      <ColorPicker dialogRef={dialogRef} onSelect={handleColorSelect} />
      <LifeNumpad dialogRef={numpadRef} onConfirm={handleNumpadConfirm} />

      {/*
       * §7.3 — Commander Damage overlay.
       * §7.4 — Counters overlay.
       * Each manages its own `useSwipe` to support close-on-swipe.
       */}
      <CommanderDamage
        dialogRef={commanderRef}
        opponentColor={opponentColor}
        damage={state.commanderDamage}
        onAdjust={(delta) => dispatch(adjustCommanderDamage(delta))}
        onClose={() => {
          /* ponytail: no cleanup needed yet */
        }}
      />
      <Counters
        dialogRef={countersRef}
        counters={state.counters}
        onAdjust={(id, delta) => dispatch(adjustCounter(id, delta))}
        onAdd={(id, name) => dispatch(addCounter(id, name))}
        onRemove={(id) => dispatch(removeCounter(id))}
        onClose={() => {
          /* ponytail: no cleanup needed yet */
        }}
      />
    </div>
  );
}
