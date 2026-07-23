"use client";

import { useCallback, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { DialogShell } from "@/shared/components/DialogShell";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/* Repeated 10× across numpad buttons — extracted per "extract 3+ repeats" rule. */
const digitBtnClass = cn(
  "flex h-14 items-center justify-center rounded-lg font-bold",
  "transition-colors hover:bg-white/10",
  "text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
);

interface LifeNumpadProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onConfirm: (value: number) => void;
}

/**
 * §7.1 — Numpad for exact life entry.
 *
 * Native `<dialog>` with a 3×4 phone-style keypad.
 * Double-tap the life total → call `dialogRef.show()` to open.
 * Confirm (✓) → calls `onConfirm(enteredValue)`.
 *
 * @see DESIGN.md §7.1
 */
export function LifeNumpad({ dialogRef, onConfirm }: LifeNumpadProps) {
  const [value, setValue] = useState("");

  const handleDigit = useCallback((digit: number) => {
    setValue((prev) => (prev + digit).slice(0, 4));
  }, []);

  const handleBackspace = useCallback(() => {
    setValue((prev) => prev.slice(0, -1));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(Number(value));
    dialogRef.current?.close();
  }, [value, onConfirm, dialogRef]);

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
  }, [dialogRef]);

  return (
    <DialogShell
      dialogRef={dialogRef}
      ariaLabelledBy="numpad-title"
      onClose={() => setValue("")}
    >
      {/* Title (sr-only) */}
      <h2 id="numpad-title" className="sr-only">
        Set life total
      </h2>

      {/* Display */}
      <div className="flex flex-1 items-center justify-center">
        <output
          aria-live="polite"
          className="text-display font-black tabular-nums opacity-70"
        >
          {value || "\u2014"}
        </output>
      </div>

      {/* Numpad grid */}
      <div className="mx-auto grid w-64 grid-cols-3 gap-3 pb-6">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            aria-label={`${d}`}
            onClick={() => handleDigit(d)}
            className={digitBtnClass}
          >
            {d}
          </button>
        ))}

        <button
          key={0}
          type="button"
          aria-label="0"
          onClick={() => handleDigit(0)}
          className={digitBtnClass}
        >
          0
        </button>

        <button
          type="button"
          aria-label="Backspace"
          onClick={handleBackspace}
          className={cn(digitBtnClass, "text-xl")}
        >
          ⌫
        </button>

        <button
          type="button"
          aria-label="Confirm"
          onClick={handleConfirm}
          className={cn(digitBtnClass, "bg-white/20", "hover:bg-white/30")}
        >
          ✓
        </button>
      </div>

      {/* Close */}
      <div className="flex justify-center pb-4">
        <button
          type="button"
          aria-label="Cancel"
          onClick={handleClose}
          className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          ✕
        </button>
      </div>
    </DialogShell>
  );
}
