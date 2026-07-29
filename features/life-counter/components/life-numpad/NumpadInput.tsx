"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { UI } from "@/shared/lib/constants/colors";
import {
  usePlayerStateContext,
  setLife,
} from "@/features/life-counter/state/player-state-context";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const digitBtnClass = cn(
  "flex h-14 items-center justify-center rounded-lg font-bold",
  "transition-colors hover:bg-white/10",
  "text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
);

interface NumpadInputProps {
  readonly dialogId: string;
}

/** Convenience accessor for the dialog element by ID. */
function dialogEl(id: string): HTMLDialogElement | null {
  return document.getElementById(id) as HTMLDialogElement | null;
}

/**
 * Client leaf for the life-numpad digit entry.
 * Has local state for the entered value.
 * Resets value whenever the dialog closes (any method).
 */
export function NumpadInput({ dialogId }: NumpadInputProps) {
  const { dispatch } = usePlayerStateContext();
  const [value, setValue] = useState("");

  /* Reset input state when the dialog closes (escape, backdrop, cancel button). */
  useEffect(() => {
    const el = dialogEl(dialogId);
    if (!el) return;

    const handleClose = () => setValue("");
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [dialogId]);

  const handleDigit = useCallback((digit: number) => {
    setValue((prev) => (prev + digit).slice(0, 4));
  }, []);

  const handleBackspace = useCallback(() => {
    setValue((prev) => prev.slice(0, -1));
  }, []);

  const handleConfirm = useCallback(() => {
    dispatch(setLife(Number(value)));
    dialogEl(dialogId)?.close();
  }, [value, dispatch, dialogId]);

  const handleCancel = useCallback(() => {
    dialogEl(dialogId)?.close();
  }, [dialogId]);

  return (
    <>
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
          onClick={handleCancel}
          className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ color: UI.textLight }}
        >
          ✕
        </button>
      </div>
    </>
  );
}
