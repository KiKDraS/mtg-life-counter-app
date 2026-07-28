"use client";

import type { ManaColor } from "@/shared/lib/constants/colors";
import { MANA } from "@/shared/lib/constants/colors";
import { MANA_LABELS } from "@/shared/lib/constants/labels";
import { cn } from "@/shared/lib/cn";
import { DialogShell } from "@/shared/components/DialogShell";
import ManaSelector from "@/shared/components/icons/ManaSelector";
import type { PlayerColor } from "@/features/life-counter/types/player";

interface ColorPickerProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onSelect: (color: PlayerColor) => void;
}

/* MANA keys are in WUBRG order — slice off Colorless for the 5-color wheel. */
const MANA_KEYS = Object.keys(MANA).slice(0, 5) as ManaColor[];

/* Repeated 5 times on the mana wheel. */
const manaWheelBtnClass = cn(
  "absolute rounded-full",
  "transition-transform",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
);

/**
 * §6.5 Color Picker Modal.
 *
 * Native `<dialog>` with an 80/20 vertical split:
 *   - 80% — mana symbol wheel (WUBRG order, circular layout via CSS transforms)
 *   - 20% — filter strip with mana tab, WUBRG action, Colorless action
 *
 * Symbols arranged in a circle using CSS transforms:
 *   translate(-50%,-50%) rotate(θ) translateY(-R) rotate(-θ)
 * Position at center → rotate to orbital angle → translate outward →
 * counter-rotate to keep upright. No JS trig needed.
 *
 * Tap any mana symbol / button → calls onSelect(result) which the
 * parent handles (dispatch + dialog.close()).
 *
 * @see DESIGN.md §6.5
 */
export function ColorPicker({ dialogRef, onSelect }: ColorPickerProps) {
  return (
    <DialogShell dialogRef={dialogRef} ariaLabelledBy="color-picker-title">
      {/* 80% — color selection area */}
      {/* keep: w-81.25 constrains wheel diameter for translateY radius */}
      <div className="relative flex items-center justify-center w-81.25 h-full m-auto">
        {MANA_KEYS.map((color, i) => {
          /* 5 symbols, 72° apart, WUBRG clockwise from top (i=0) */
          const angle = i * 72;
          return (
            <button
              key={color}
              type="button"
              aria-label={MANA_LABELS[color]}
              onClick={() => onSelect(color)}
              className={manaWheelBtnClass}
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-6.5rem) rotate(-${angle}deg)`,
              }}
            >
              <ManaSelector color={color} size={72} />
            </button>
          );
        })}
      </div>

      {/* 20% — filter strip (§6.5) */}
      <div className="flex h-14 shrink-0 items-center justify-around border-t border-white/10 px-4">
        <button
          type="button"
          aria-label="Apply all-five-colors gradient"
          onClick={() => onSelect("wubrg")}
          className="rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          WUBRG
        </button>

        <button
          type="button"
          aria-label="Apply Colorless"
          onClick={() => onSelect("c")}
          className="rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Colorless
        </button>
      </div>
    </DialogShell>
  );
}
