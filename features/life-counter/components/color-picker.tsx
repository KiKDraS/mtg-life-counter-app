"use client";

import { useState } from "react";
import { MANA, UI } from "@/shared/lib/constants/colors";
import type { ManaColor } from "@/shared/lib/constants/colors";
import ManaSelector from "@/shared/components/icons/ManaSelector";

export type PlayerColor = ManaColor | "wubrg";

interface ColorPickerProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onSelect: (color: PlayerColor) => void;
}

const COLORS: { color: ManaColor; label: string }[] = [
  { color: "w", label: "White" },
  { color: "u", label: "Blue" },
  { color: "b", label: "Black" },
  { color: "r", label: "Red" },
  { color: "g", label: "Green" },
];

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

type Tab = "mana";

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
  const [tab] = useState<Tab>("mana");

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="color-picker-title"
      className="flex w-[min(90vw,26rem)] max-h-[80vh] flex-col border-0 rounded-none bg-[#1A1A1A] text-[#FAF8F5] open:flex backdrop:bg-black/35"
    >
      {/* 80% — color selection area */}
      <div className="relative flex-1 min-h-0">
        {tab === "mana" && (
          <div className="absolute inset-0 flex items-center justify-center">
            {COLORS.map(({ color, label }, i) => (
              <button
                key={color}
                type="button"
                aria-label={label}
                onClick={() => onSelect(color)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                style={{ left: polarLeft(i), top: polarTop(i) }}
              >
                <ManaSelector color={color} size={56} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 20% — filter strip (§6.5) */}
      <div className="flex h-14 shrink-0 items-center justify-around border-t border-white/10 px-4">
        <span
          className="rounded px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: UI.textLight,
            color: UI.textDark,
          }}
        >
          mana
        </span>

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
