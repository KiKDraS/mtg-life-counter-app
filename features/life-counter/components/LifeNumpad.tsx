"use client";

import { useCallback, useState } from "react";

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
 */
export function LifeNumpad({ dialogRef, onConfirm }: LifeNumpadProps) {
  const [value, setValue] = useState(0);

  const handleDigit = useCallback((digit: number) => {
    setValue((prev) => Math.min(prev * 10 + digit, 9999));
  }, []);

  const handleBackspace = useCallback(() => {
    setValue((prev) => Math.floor(prev / 10));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(value);
    dialogRef.current?.close();
  }, [value, onConfirm, dialogRef]);

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
  }, [dialogRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="numpad-title"
      onClose={() => setValue(0)}
      className="absolute top-0 left-0 m-0 w-full h-full open:flex flex-col border-0 rounded-none bg-black/80 text-ui-textLight"
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
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            type="button"
            aria-label={`${d}`}
            onClick={() => handleDigit(d)}
            className="flex h-14 items-center justify-center rounded-lg text-2xl font-bold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {d}
          </button>
        ))}

        {[0].map((d) => (
          <button
            key={d}
            type="button"
            aria-label={`${d}`}
            onClick={() => handleDigit(d)}
            className="flex h-14 items-center justify-center rounded-lg text-2xl font-bold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {d}
          </button>
        ))}

        <button
          type="button"
          aria-label="Backspace"
          onClick={handleBackspace}
          className="flex h-14 items-center justify-center rounded-lg text-xl font-bold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          ⌫
        </button>

        <button
          type="button"
          aria-label="Confirm"
          onClick={handleConfirm}
          className="flex h-14 items-center justify-center rounded-lg bg-white/20 text-2xl font-bold transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
    </dialog>
  );
}
