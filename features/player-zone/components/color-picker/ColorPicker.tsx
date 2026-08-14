"use client";

import { DialogShell } from "@/shared/components/DialogShell";
import { ManaWheel } from "./color-wheels/ManaWheel";
import { ConfirmButton } from "./color-wheels/ConfirmButton";
import { usePlayerStateContext } from "@/features/player-zone/state/hooks";

interface ColorPickerProps {
  readonly id: string;
}

/**
 * §6.5 Color Picker Modal.
 *
 * Fit-content dialog (§6.5: "Width = fit-content"), bound to the player's
 * zone — the opener (PlayerZoneInteractive) calls showModal() and centers the
 * box on the zone's screen rect, so the picker belongs to that player and
 * never spans the window. Native `::backdrop` (rgba(0,0,0,0.35), §6.1) dims
 * the rest; backdrop tap / Escape close.
 *
 * The wheel content is wrapped in a rotate(playerZoneRotation) div so the
 * circular layout stays player-upright. The wrapper is sized to the wheel
 * extent (slot-scaled via cq units) so the dialog box hugs the wheel.
 *
 * Multi-select toggles dispatch live (`ManaActionButton`); ✓ / Colorless /
 * backdrop / Escape close only.
 *
 * @see DESIGN.md §6.5, SPEC.md §8.5.1
 */
export function ColorPicker({ id }: ColorPickerProps) {
  const { playerZoneRotation } = usePlayerStateContext();

  return (
    <DialogShell
      id={id}
      ariaLabelledBy="color-picker-title"
      className="-translate-x-1/2 -translate-y-1/2"
      fitContent
    >
      <h2 id="color-picker-title" className="sr-only">
        Color Picker
      </h2>
      <div
        className="relative aspect-square w-[max(72cqmin,15rem)]"
        style={{ transform: `rotate(${playerZoneRotation}deg)` }}
      >
        <ManaWheel id={id} />
        <ConfirmButton id={id} />
      </div>
    </DialogShell>
  );
}
