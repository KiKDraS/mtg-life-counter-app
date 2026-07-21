"use client";

import type { ManaColor } from "@/shared/lib/constants/colors";
import { MANA } from "@/shared/lib/constants/colors";
import { MANA_LABELS } from "@/shared/lib/constants/labels";
import ManaSelector from "@/shared/components/icons/ManaSelector";

export type PlayerColor = ManaColor | "wubrg";

interface ColorPickerProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onSelect: (color: PlayerColor) => void;
}

/* MANA keys are in WUBRG order — slice off Colorless for the 5-color wheel. */
const MANA_KEYS = Object.keys(MANA).slice(0, 5) as ManaColor[];

/*
 * §6.5 — Mana wheel: 5 symbols in WUBRG order arranged clockwise
 * starting from the top (-90°), spaced 72° apart.
 */
const RADIUS_PCT = 32;

function polarLeft(index: number): string {
  const angle = ((index * 72 - 90) * Math.PI) / 180;
  return `${50 + RADIUS_PCT * Math.cos(angle)}%`;
}

function polarTop(index: number): string {
  const angle = ((index * 72 - 90) * Math.PI) / 180;
  return `${50 + RADIUS_PCT * Math.sin(angle)}%`;
}

/**
 * §6.5 Color Picker Modal.
 *
 * Native `<dialog>` with an 80/20 vertical split:
 *   - 80% — mana symbol wheel (WUBRG order, circular layout)
 *   - 20% — filter strip with mana tab, WUBRG action, Colorless action
 *
 * Tap any mana symbol / button → calls onSelect(result) which the
 * parent handles (dispatch + dialog.close()).
 */
export function ColorPicker({ dialogRef, onSelect }: ColorPickerProps) {
  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="color-picker-title"
      className="absolute top-0 left-0 m-0 w-full h-full open:flex flex-col border-0 rounded-none bg-black/80 text-ui-textLight"
    >
      {/* 80% — color selection area */}
      <div className="relative flex items-center justify-center w-100 h-full m-auto ">
        {MANA_KEYS.map((color, i) => (
          <button
            key={color}
            type="button"
            aria-label={MANA_LABELS[color]}
            onClick={() => onSelect(color)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            style={{ left: polarLeft(i), top: polarTop(i) }}
          >
            <ManaSelector color={color} size={72} />
          </button>
        ))}
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
    </dialog>
  );
}
