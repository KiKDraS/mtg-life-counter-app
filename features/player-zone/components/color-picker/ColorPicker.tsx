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
 * Portaled to <body> (portalToBody) so the dialog box escapes the rotated
 * player-zone div that would otherwise become its containing block: the dark
 * overlay is full-viewport and unrotated — no overflow, backdrop dismiss
 * works across the whole screen.
 *
 * The wheel content is wrapped in a rotate(playerZoneRotation) div so the
 * circular layout stays player-upright (same orientation as before, when the
 * zone transform rotated the whole dialog). The wrapper holds only absolute
 * children (0×0 box) → no hit area → taps on empty overlay reach the dialog.
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
      className="items-center justify-center"
      portalToBody
    >
      <h2 id="color-picker-title" className="sr-only">
        Color Picker
      </h2>
      <div
        className="relative"
        style={{ transform: `rotate(${playerZoneRotation}deg)` }}
      >
        <ManaWheel id={id} />
        <ConfirmButton id={id} />
      </div>
    </DialogShell>
  );
}
